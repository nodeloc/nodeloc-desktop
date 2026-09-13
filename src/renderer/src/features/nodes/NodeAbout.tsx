import { Calendar, Crown } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { formatCount } from '../../lib/format'
import { paths } from '../../lib/routes'
import styles from './NodeAbout.module.css'
import { normalizeRules } from './node-text'
import type { NodeCategory } from './types'

/** A node's stats, rules and moderators, in its sidebar below the header. */
export function NodeAbout({ category }: { category: NodeCategory }): React.JSX.Element {
  return (
    <>
      <AboutBlock category={category} />
      <RulesBlock category={category} />
      <ModeratorsBlock category={category} />
    </>
  )
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <h2 className={styles.blockTitle}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function AboutBlock({ category }: { category: NodeCategory }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const stats = [
    ['members', category.member_count ?? 0],
    ['topics', category.topic_count],
    ['posts', category.post_count]
  ] as const
  const owner = category.owner_username && category.owner_username !== 'system' ? category.owner_username : null
  const created = category.created_at
    ? new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }).format(
        new Date(category.created_at)
      )
    : null

  return (
    <Block title={t('nodes.about.title')}>
      <dl className={styles.stats}>
        {stats.map(([key, value]) => (
          <div key={key} className={styles.stat}>
            <dt>{t(`nodes.about.${key}`)}</dt>
            <dd>{formatCount(value, i18n.language)}</dd>
          </div>
        ))}
      </dl>
      {(created || owner) && (
        <ul className={styles.facts}>
          {created && (
            <li>
              <Calendar />
              <time dateTime={category.created_at ?? undefined}>{t('nodes.about.created', { date: created })}</time>
            </li>
          )}
          {owner && (
            <li>
              <Crown />
              <span>{t('nodes.about.owner')}</span>
              <Link to={paths.user(owner)} className={styles.ownerLink}>
                {owner}
              </Link>
            </li>
          )}
        </ul>
      )}
    </Block>
  )
}

function RulesBlock({ category }: { category: NodeCategory }): React.JSX.Element | null {
  const { t } = useTranslation()
  const rules = useMemo(() => normalizeRules(category.community_rules), [category.community_rules])
  if (rules.length === 0) return null

  return (
    <Block title={t('nodes.about.rules')}>
      <ol className={styles.rules}>
        {rules.map((rule, index) => (
          <li key={index} className={styles.rule}>
            <span className={styles.ruleIndex}>{index + 1}</span>
            <div className={styles.ruleText}>
              <p className={styles.ruleTitle}>{rule.title}</p>
              {rule.body && <p className={styles.ruleBody}>{rule.body}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Block>
  )
}

function ModeratorsBlock({ category }: { category: NodeCategory }): React.JSX.Element | null {
  const { t, i18n } = useTranslation()
  const moderators = category.moderators ?? []
  if (moderators.length === 0) return null
  const count = Math.max(category.moderator_count ?? 0, moderators.length)

  return (
    <Block title={t('nodes.about.moderators')} action={<span className={styles.count}>{formatCount(count, i18n.language)}</span>}>
      <ul className={styles.moderators}>
        {moderators.map((moderator) => (
          <li key={moderator.id}>
            <Link to={paths.user(moderator.username)} className={styles.moderator}>
              <Avatar template={moderator.avatar_template} username={moderator.username} size={28} />
              <span className={styles.moderatorNames}>
                <span className={styles.username}>{moderator.username}</span>
                {moderator.name && <span className={styles.fullName}>{moderator.name}</span>}
              </span>
              {moderator.app_bot && <span className={styles.bot}>{t('nodes.about.bot')}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Block>
  )
}
