import { ArrowBigDown, ArrowBigUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoteDirection } from '../../api/types'
import { cx } from '../../lib/cx'
import { formatCount } from '../../lib/format'
import styles from './VoteRail.module.css'

interface VoteRailProps {
  score: number
  count: number
  direction: VoteDirection
  canVoteUp: boolean
  canVoteDown: boolean
  /** Omitted while voting isn't available; the buttons then stay disabled. */
  onVote?: (direction: VoteDirection) => void
  /** Pointer entering (a direction) or leaving (null) an enabled arrow; drives the reaction picker. */
  onArrowHover?: (direction: 'up' | 'down' | null) => void
  orientation?: 'vertical' | 'horizontal'
  busy?: boolean
  /** Compact reaction summary shown before the score in a horizontal rail. */
  reactionSummary?: ReactNode
}

/**
 * Reddit-style ▲ score ▼. Clicking the active arrow sends `none`, matching
 * discourse-vote, where `direction` is the state to end in.
 */
export function VoteRail({
  score,
  count,
  direction,
  canVoteUp,
  canVoteDown,
  onVote,
  onArrowHover,
  orientation = 'vertical',
  busy = false,
  reactionSummary
}: VoteRailProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const toggle = (target: Exclude<VoteDirection, 'none'>): void => onVote?.(direction === target ? 'none' : target)
  const upEnabled = canVoteUp && onVote !== undefined && !busy
  const downEnabled = canVoteDown && onVote !== undefined && !busy
  const hover = (target: 'up' | 'down', enabled: boolean) =>
    onArrowHover && enabled
      ? { onMouseEnter: () => onArrowHover(target), onMouseLeave: () => onArrowHover(null) }
      : {}
  // The picker replaces the tooltip while hovering is live.
  const title = (label: string): string | undefined => (onArrowHover ? undefined : label)

  return (
    <div className={cx(styles.rail, styles[orientation])} data-direction={direction}>
      <button
        type="button"
        className={cx(styles.arrow, styles.up)}
        aria-label={t('vote.up')}
        aria-pressed={direction === 'up'}
        title={onVote ? title(t('vote.up')) : t('vote.signInToVote')}
        disabled={!upEnabled}
        onClick={() => toggle('up')}
        {...hover('up', upEnabled)}
      >
        <ArrowBigUp fill={direction === 'up' ? 'currentColor' : 'none'} />
      </button>
      {reactionSummary && <span className={styles.reactionSummary}>{reactionSummary}</span>}
      <span className={styles.score}>{count === 0 ? t('vote.vote') : formatCount(score, i18n.language)}</span>
      <button
        type="button"
        className={cx(styles.arrow, styles.down)}
        aria-label={t('vote.down')}
        aria-pressed={direction === 'down'}
        title={onVote ? (canVoteDown ? title(t('vote.down')) : t('vote.cannotDownvote')) : t('vote.signInToVote')}
        disabled={!downEnabled}
        onClick={() => toggle('down')}
        {...hover('down', downEnabled)}
      >
        <ArrowBigDown fill={direction === 'down' ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
