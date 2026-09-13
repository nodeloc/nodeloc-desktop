import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { apiRequest } from '../../../api/client'
import type { BasicUser } from '../../../api/types'
import { useErrorMessage } from '../../../api/use-error-message'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { Spinner } from '../../../components/Spinner'
import { showToast } from '../../../components/toast-store'
import { cx } from '../../../lib/cx'
import { formatCount, formatRelativeTime } from '../../../lib/format'
import { paths } from '../../../lib/routes'
import { InlineRetry } from '../../nodes/NodeLoadError'
import { ModEmpty, ModIntro, ModPanel, ModUserRow, modStyles } from '../ModUi'
import type { ModSectionProps } from '../sections'
import type { ModDailyCount } from '../types'
import { nodeModKey } from '../use-mod-tools'
import styles from './overview.module.css'

const PERIODS = ['7d', '30d', '90d', 'all'] as const
type Period = (typeof PERIODS)[number]

/** `GET /node/:id/invites/stats` (NodeInvitesController#stats). */
interface InviteStats {
  period: string
  from?: string | null
  to?: string | null
  joined: number
  links_active: number
  leaderboard: LeaderboardRow[]
}

interface LeaderboardRow {
  user: BasicUser
  count: number
  rewards: { count: number; points: number }
}

/** `InviteRewards.serialize`. */
interface InviteReward {
  id: number
  kind: 'points' | 'other'
  points: number | null
  note: string | null
  period: string | null
  created_at: string
  user: BasicUser
  granted_by: BasicUser
}

interface RewardsResponse {
  rewards: InviteReward[]
  /** Ruby `defined?(::PointsService)`: a truthy string, or null. */
  points_available: string | boolean | null
}

/**
 * The mod tools front page (components/mod-tools/overview.gjs): the week's
 * numbers from `GET /node/:id/mod`, thirty-day trends, and the invite
 * leaderboard with rewards. Stats and history are open to moderators; giving
 * a reward (`POST /node/:id/invite-rewards`) is the owner's.
 */
export function OverviewSection({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { stats, can_edit: canEdit } = mod
  const slug = category.slug
  const [period, setPeriod] = useState<Period | 'custom'>('30d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [rewarding, setRewarding] = useState<LeaderboardRow | null>(null)

  const custom = period === 'custom' && range !== null
  const inviteStats = useQuery({
    queryKey: [...nodeModKey(category.id), 'invite-stats', period, range?.from, range?.to],
    queryFn: () =>
      apiRequest<InviteStats>({
        path: `/node/${category.id}/invites/stats.json`,
        query: custom ? { from: range.from, to: range.to } : { period }
      }),
    placeholderData: keepPreviousData
  })

  // The web only reads the history for the owner, who can act on it.
  const rewards = useQuery({
    queryKey: [...nodeModKey(category.id), 'invite-rewards'],
    queryFn: () => apiRequest<RewardsResponse>({ path: `/node/${category.id}/invite-rewards.json` }),
    enabled: canEdit
  })

  // What a reward given off this ranking is filed under.
  const rewardPeriod = custom ? `${range.from.replaceAll('-', '')}-${range.to.replaceAll('-', '')}` : period

  const count = (value: number): string => formatCount(value, i18n.language)

  return (
    <>
      <ModIntro>{t('nodeMod.overview.lede')}</ModIntro>

      {mod.verification.expiring && (
        <VerificationNotice
          text={t('nodeMod.overview.verificationExpiring', { count: mod.verification.days_remaining ?? 0 })}
          to={canEdit ? paths.nodeMod(slug, 'settings') : undefined}
        />
      )}

      <h2 className={modStyles.sectionTitle}>{t('nodeMod.overview.lastSevenDays')}</h2>
      <div className={styles.cards}>
        <StatCard
          label={t('nodeMod.overview.pendingReview')}
          value={count(stats.pending_reviewables)}
          alert={stats.pending_reviewables > 0}
          to={paths.nodeMod(slug, 'queue')}
        />
        <StatCard
          label={t('nodeMod.overview.pendingRequests')}
          value={count(stats.pending_requests)}
          alert={stats.pending_requests > 0}
          to={canEdit ? paths.nodeMod(slug, 'members') : undefined}
        />
        <StatCard label={t('nodeMod.overview.newMembers')} value={count(stats.members_7d)} />
        <StatCard label={t('nodeMod.overview.activeMembers')} value={count(stats.active_members_7d)} />
        <StatCard label={t('nodeMod.overview.newTopics')} value={count(stats.topics_7d)} />
        <StatCard label={t('nodeMod.overview.newPosts')} value={count(stats.posts_7d)} />
      </div>

      <h2 className={modStyles.sectionTitle}>{t('nodeMod.overview.trend30d')}</h2>
      <div className={styles.trends}>
        <TrendChart label={t('nodeMod.overview.newMembers')} series={stats.series_30d.members} />
        <TrendChart label={t('nodeMod.overview.newTopics')} series={stats.series_30d.topics} />
        <TrendChart label={t('nodeMod.overview.newPosts')} series={stats.series_30d.posts} />
      </div>

      <h2 className={modStyles.sectionTitle}>{t('nodeMod.overview.invites')}</h2>
      <div className={styles.cards}>
        <StatCard
          label={t('nodeMod.overview.linksActive')}
          value={count(stats.invites.links_active)}
          to={canEdit ? paths.nodeMod(slug, 'invites') : undefined}
        />
        <StatCard label={t('nodeMod.overview.joined7d')} value={count(stats.invites.joined_7d)} />
        <StatCard label={t('nodeMod.overview.joined30d')} value={count(stats.invites.joined_30d)} />
      </div>

      <ModPanel title={t('nodeMod.overview.leaderboard')}>
        <p className={modStyles.lede}>{t('nodeMod.overview.leaderboardLede')}</p>
        <div className={modStyles.tabs} role="tablist">
          {PERIODS.map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={period === entry}
              className={cx(modStyles.tab, period === entry && modStyles.tabActive)}
              onClick={() => {
                setPeriod(entry)
                setFrom('')
                setTo('')
                setRange(null)
              }}
            >
              {t(`nodeMod.overview.periods.${entry}`)}
            </button>
          ))}
        </div>

        <form
          className={cx(modStyles.formRow, styles.range, custom && styles.rangeActive)}
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            if (!from || !to) return
            setRange({ from, to })
            setPeriod('custom')
          }}
        >
          <span className={modStyles.hint}>{t('nodeMod.overview.customRange')}</span>
          <input
            type="date"
            className={cx(modStyles.input, styles.date)}
            value={from}
            max={to || undefined}
            aria-label={t('nodeMod.overview.dateFrom')}
            onChange={(event) => setFrom(event.target.value)}
          />
          <span className={modStyles.hint}>–</span>
          <input
            type="date"
            className={cx(modStyles.input, styles.date)}
            value={to}
            min={from || undefined}
            aria-label={t('nodeMod.overview.dateTo')}
            onChange={(event) => setTo(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={!from || !to}>
            {t('nodeMod.overview.applyRange')}
          </Button>
        </form>

        {inviteStats.isPending ? (
          <ModEmpty>
            <Spinner size={20} />
          </ModEmpty>
        ) : inviteStats.isError ? (
          <InlineRetry error={inviteStats.error} onRetry={() => void inviteStats.refetch()} />
        ) : (
          <>
            <p className={styles.total}>{t('nodeMod.overview.joinedInPeriod', { count: inviteStats.data.joined })}</p>
            {inviteStats.data.leaderboard.length > 0 ? (
              <ol className={modStyles.list}>
                {inviteStats.data.leaderboard.map((row) => (
                  <ModUserRow
                    key={row.user.id}
                    user={row.user}
                    meta={[
                      t('nodeMod.overview.invitedPeople', { count: row.count }),
                      row.rewards.count > 0
                        ? t('nodeMod.overview.alreadyGiven', { count: row.rewards.count, points: row.rewards.points })
                        : null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    actions={
                      canEdit ? (
                        <Button size="sm" icon={<Gift />} onClick={() => setRewarding(row)}>
                          {t('nodeMod.overview.reward.button')}
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </ol>
            ) : (
              <ModEmpty>{t('nodeMod.overview.noInviters')}</ModEmpty>
            )}
          </>
        )}

        {rewards.data && rewards.data.rewards.length > 0 && (
          <>
            <h3 className={modStyles.sectionTitle}>{t('nodeMod.overview.history')}</h3>
            <ul className={modStyles.list}>
              {rewards.data.rewards.map((reward) => (
                <ModUserRow
                  key={reward.id}
                  user={reward.user}
                  meta={[
                    reward.kind === 'points' ? t('nodeMod.overview.givenPoints', { count: reward.points ?? 0 }) : null,
                    reward.note,
                    formatRelativeTime(reward.created_at, i18n.language)
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </ul>
          </>
        )}
      </ModPanel>

      {rewarding && (
        <RewardDialog
          categoryId={category.id}
          row={rewarding}
          period={rewardPeriod}
          pointsAvailable={Boolean(rewards.data?.points_available)}
          onClose={() => setRewarding(null)}
        />
      )}
    </>
  )
}

function VerificationNotice({ text, to }: { text: string; to?: string }): React.JSX.Element {
  const content = (
    <>
      <TriangleAlert />
      <span>{text}</span>
    </>
  )
  return to ? (
    <Link className={styles.notice} to={to}>
      {content}
    </Link>
  ) : (
    <div className={styles.notice}>{content}</div>
  )
}

function StatCard({ label, value, alert, to }: { label: string; value: string; alert?: boolean; to?: string }): React.JSX.Element {
  const className = cx(styles.card, alert && styles.cardAlert, to && styles.cardLink)
  const content = (
    <>
      <span className={styles.cardLabel}>{label}</span>
      <span className={styles.cardValue}>{value}</span>
    </>
  )
  return to ? (
    <Link className={className} to={to}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

/** One bar a day, scaled to the busiest day (components/mod-tools/trend-chart.gjs). */
function TrendChart({ label, series }: { label: string; series: ModDailyCount[] }): React.JSX.Element {
  const max = Math.max(1, ...series.map((point) => point.count))
  const total = series.reduce((sum, point) => sum + point.count, 0)
  return (
    <div className={styles.trend}>
      <div className={styles.trendHead}>
        <span className={styles.cardLabel}>{label}</span>
        <strong className={styles.trendTotal}>{total}</strong>
      </div>
      <div className={styles.bars} role="img" aria-label={`${label}: ${total}`}>
        {series.map((point) => (
          <span
            key={point.date}
            className={cx(styles.bar, point.count > 0 && styles.barFilled)}
            style={{ height: `${Math.max(Math.round((point.count / max) * 100), 2)}%` }}
            title={`${point.date} · ${point.count}`}
          />
        ))}
      </div>
    </div>
  )
}

/** The owner rewarding one inviter (modal/community-invite-reward.gjs). */
function RewardDialog({
  categoryId,
  row,
  period,
  pointsAvailable,
  onClose
}: {
  categoryId: number
  row: LeaderboardRow
  period: string
  pointsAvailable: boolean
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<'points' | 'other'>(pointsAvailable ? 'points' : 'other')
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !busy && (kind === 'points' ? Number(points) > 0 : note.trim().length > 0)

  const submit = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const form: Array<[string, string | number]> = [
        ['user_id', row.user.id],
        ['kind', kind],
        ['note', note],
        ['period', period]
      ]
      if (kind === 'points') form.push(['points', points])
      await apiRequest({ method: 'POST', path: `/node/${categoryId}/invite-rewards.json`, form, priority: 'user' })
      showToast(t('nodeMod.overview.reward.granted', { username: row.user.username }), 'success')
      void queryClient.invalidateQueries({ queryKey: [...nodeModKey(categoryId), 'invite-stats'] })
      void queryClient.invalidateQueries({ queryKey: [...nodeModKey(categoryId), 'invite-rewards'] })
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('nodeMod.overview.reward.title')}
      width={440}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!canSubmit}>
            {t('nodeMod.overview.reward.grant')}
          </Button>
        </>
      }
    >
      <form className={styles.rewardForm} onSubmit={(event) => void submit(event)}>
        <ul className={modStyles.list}>
          <ModUserRow user={row.user} meta={t('nodeMod.overview.invitedPeople', { count: row.count })} />
        </ul>
        <div className={styles.kinds} role="radiogroup">
          {pointsAvailable && (
            <label className={styles.kind}>
              <input type="radio" name="kind" checked={kind === 'points'} onChange={() => setKind('points')} />
              {t('nodeMod.overview.reward.kindPoints')}
            </label>
          )}
          <label className={styles.kind}>
            <input type="radio" name="kind" checked={kind === 'other'} onChange={() => setKind('other')} />
            {t('nodeMod.overview.reward.kindOther')}
          </label>
        </div>
        {kind === 'points' && (
          <label className={modStyles.field}>
            {t('nodeMod.overview.reward.points')}
            <input
              type="number"
              min={1}
              step={1}
              className={modStyles.input}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
            <span className={modStyles.hint}>{t('nodeMod.overview.reward.pointsHint')}</span>
          </label>
        )}
        <label className={modStyles.field}>
          {t('nodeMod.overview.reward.note')}
          <textarea
            className={modStyles.textarea}
            rows={2}
            maxLength={500}
            value={note}
            placeholder={t(kind === 'points' ? 'nodeMod.overview.reward.notePlaceholder' : 'nodeMod.overview.reward.otherPlaceholder')}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error && <p className={modStyles.error}>{error}</p>}
      </form>
    </Dialog>
  )
}
