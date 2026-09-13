import { Gift, Ticket, Trophy } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { apiRequest } from '../../api/client'
import type { Lottery } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { showToast } from '../../components/toast-store'
import { formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import { CURRENT_USER_KEY, useRequireSignIn } from '../account/use-session'
import styles from './LotteryCard.module.css'

const UNLIMITED = 1_000_000

interface ParticipateResponse {
  success: boolean
  user_tickets?: number
  error?: string
}

/**
 * A lottery attached to a post. Tickets cost 1 energy each; the server also
 * requires having replied to the topic and a minimum trust level, and
 * explains any refusal in its error message.
 */
export function LotteryCard({ lottery }: { lottery: Lottery }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const requireSignIn = useRequireSignIn()
  const drawAt = new Date(lottery.draw_at)

  const minimum = Math.max(lottery.min_tickets_per_user - lottery.user_tickets, 1)
  const remaining = Math.max(lottery.max_tickets_per_user - lottery.user_tickets, 0)
  const [quantity, setQuantity] = useState(Math.min(minimum, Math.max(remaining, 1)))
  const [random, setRandom] = useState(false)
  const [busy, setBusy] = useState(false)

  const participate = async (): Promise<void> => {
    if (!requireSignIn()) return
    setBusy(true)
    try {
      const form: Array<[string, string | number]> = [['quantity', quantity]]
      if (random) form.push(['random', 'true'])
      const response = await apiRequest<ParticipateResponse>({
        method: 'POST',
        path: `/lottery/${lottery.id}/participate`,
        form,
        priority: 'user'
      })
      if (!response.success) {
        showToast(response.error ?? t('errors.unknown'), 'danger')
        return
      }
      showToast(t('interactions.lottery.joined', { count: response.user_tickets ?? lottery.user_tickets + quantity }), 'success')
      void queryClient.invalidateQueries({ queryKey: ['topic'] })
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.card} data-status={lottery.status}>
      <header className={styles.header}>
        <span className={styles.icon}>
          <Gift />
        </span>
        <div className={styles.headline}>
          <span className={styles.kicker}>{t('reader.lottery.title')}</span>
          <h3 className={styles.title}>{lottery.title}</h3>
        </div>
        <span className={styles.status}>{t(`reader.lottery.${lottery.status}`)}</span>
      </header>

      <ul className={styles.levels} aria-label={t('reader.lottery.prizes')}>
        {lottery.levels.map((level) => (
          <li key={level.id}>
            <span className={styles.levelName}>{level.name}</span>
            <span className={styles.prize}>{level.prize}</span>
            <span className={styles.quantity}>×{level.quantity}</span>
          </li>
        ))}
      </ul>

      <dl className={styles.stats}>
        <div>
          <dt>{t('reader.lottery.participants', { count: lottery.participants_count })}</dt>
          <dd>{t('reader.lottery.minParticipants', { count: lottery.min_participants })}</dd>
        </div>
        <div>
          <dt>{t('reader.lottery.tickets', { count: lottery.tickets_count })}</dt>
          <dd>{t('reader.lottery.myTickets', { count: lottery.user_tickets })}</dd>
        </div>
        <div>
          <dt title={drawAt.toLocaleString(i18n.language)}>
            {t('reader.lottery.drawAt', { time: formatRelativeTime(lottery.draw_at, i18n.language) })}
          </dt>
          <dd>
            {lottery.min_trust_level > 0 ? t('reader.lottery.minTrust', { level: lottery.min_trust_level }) : null}
            {lottery.max_participants < UNLIMITED ? ` · ≤ ${lottery.max_participants}` : ''}
          </dd>
        </div>
      </dl>

      {lottery.status === 'drawn' && (
        <div className={styles.winners}>
          <h4>
            <Trophy /> {t('reader.lottery.winners')}
          </h4>
          {lottery.winners?.length ? (
            <ul>
              {lottery.winners.map((winner) => (
                <li key={`${winner.username}-${winner.level_name}`}>
                  <Link to={paths.user(winner.username)} className={styles.person}>
                    <Avatar template={winner.avatar_template} username={winner.username} size={20} />
                    {winner.username}
                  </Link>
                  <span className={styles.prize}>
                    {winner.level_name} · {winner.prize}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>{t('reader.lottery.noWinners')}</p>
          )}
        </div>
      )}

      {lottery.participants.length > 0 && (
        <div className={styles.participants}>
          {lottery.participants.slice(0, 16).map((participant) => (
            <Link key={participant.username} to={paths.user(participant.username)} title={`${participant.username} · ${participant.tickets}`}>
              <Avatar template={participant.avatar_template} username={participant.username} size={24} />
            </Link>
          ))}
          {lottery.participants_count > 16 && <span className={styles.muted}>+{lottery.participants_count - 16}</span>}
        </div>
      )}

      {lottery.status === 'open' && (
        <footer className={styles.footer}>
          <span className={styles.muted}>{t('reader.lottery.ticketCost')}</span>
          <div className={styles.join}>
            <label className={styles.quantityField}>
              <span>{t('interactions.lottery.quantity')}</span>
              <input
                type="number"
                min={1}
                max={Math.max(remaining, 1)}
                value={quantity}
                disabled={random || remaining === 0}
                onChange={(event) => setQuantity(Math.max(1, Math.min(Math.floor(Number(event.target.value)) || 1, Math.max(remaining, 1))))}
              />
            </label>
            <label className={styles.randomField}>
              <input type="checkbox" checked={random} onChange={(event) => setRandom(event.target.checked)} />
              {t('interactions.lottery.random')}
            </label>
            <Button
              variant="primary"
              size="sm"
              icon={<Ticket />}
              disabled={busy || remaining === 0}
              onClick={() => void participate()}
            >
              {t('reader.lottery.participate')}
            </Button>
          </div>
        </footer>
      )}
    </section>
  )
}
