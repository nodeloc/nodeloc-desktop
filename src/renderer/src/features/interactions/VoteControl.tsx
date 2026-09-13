import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useSite } from '../../api/site'
import type { Reaction } from '../../api/types'
import { useIsSignedIn } from '../account/use-session'
import { emojiUrl, useEmojiIndex } from '../content/use-emoji'
import { VoteRail } from '../vote/VoteRail'
import { usePostOverride, type VoteSnapshot } from './post-overrides'
import { ReactionSummary } from './ReactionSummary'
import { useVote } from './use-vote'
import styles from './VoteControl.module.css'

/** Resting on an arrow this long opens its reaction picker. */
const OPEN_DELAY_MS = 350
/** Grace period for crossing from an arrow into the picker (or back). */
const CLOSE_DELAY_MS = 220
/** Space between the rail and the picker, and the minimum distance from the window edge. */
const GAP = 6
const EDGE = 8

type PickerDirection = 'up' | 'down'
type Orientation = 'vertical' | 'horizontal'

interface VoteControlProps {
  postId: number
  /** Vote state as the server last sent it. */
  base: VoteSnapshot
  orientation?: Orientation
  reactions?: Reaction[]
  reactionUsersCount?: number
}

/**
 * Voting wired to the account: arrows vote with the default reaction, and
 * hovering an arrow opens a picker for a specific one. Signed-out clicks open sign-in.
 */
export function VoteControl({ postId, base, orientation = 'vertical', reactions, reactionUsersCount }: VoteControlProps): React.JSX.Element {
  const override = usePostOverride(postId)
  const snapshot = override?.vote ?? base
  const signedIn = useIsSignedIn()
  const site = useSite().data
  const vote = useVote()
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState<PickerDirection | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clearTimers = (): void => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
  }
  useEffect(() => clearTimers, [])

  const reactionsFor = (direction: PickerDirection): string[] =>
    (direction === 'up' ? site?.vote_upvote_reactions : site?.vote_downvote_reactions) ?? []

  const scheduleClose = (): void => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setPicker(null), CLOSE_DELAY_MS)
  }

  const onArrowHover = (direction: PickerDirection | null): void => {
    clearTimers()
    if (direction === null) {
      scheduleClose()
      return
    }
    if (reactionsFor(direction).length === 0) return
    // Already open: follow the pointer to the other arrow straight away.
    if (picker) setPicker(direction)
    else openTimer.current = setTimeout(() => setPicker(direction), OPEN_DELAY_MS)
  }

  const cast = async (direction: 'up' | 'down' | 'none', reaction?: string): Promise<void> => {
    clearTimers()
    setPicker(null)
    setBusy(true)
    await vote(postId, snapshot, direction, reaction)
    setBusy(false)
  }

  return (
    <div ref={anchor} className={styles.wrapper}>
      <VoteRail
        score={snapshot.score}
        count={snapshot.count}
        direction={snapshot.direction}
        canVoteUp={signedIn ? snapshot.canVoteUp : true}
        canVoteDown={signedIn ? snapshot.canVoteDown : true}
        orientation={orientation}
        busy={busy}
        reactionSummary={
          orientation === 'horizontal' && reactionUsersCount && reactions?.length ? (
            <ReactionSummary postId={postId} reactions={reactions} total={reactionUsersCount} />
          ) : undefined
        }
        onVote={(direction) => void cast(direction)}
        onArrowHover={signedIn ? onArrowHover : undefined}
      />
      {picker &&
        createPortal(
          <ReactionPicker
            anchor={anchor}
            direction={picker}
            orientation={orientation}
            reactions={reactionsFor(picker)}
            onSelect={(reaction) => void cast(picker, reaction)}
            onClose={() => {
              clearTimers()
              setPicker(null)
            }}
            onPointerEnter={() => clearTimeout(closeTimer.current)}
            onPointerLeave={scheduleClose}
          />,
          document.body
        )}
    </div>
  )
}

interface ReactionPickerProps {
  anchor: RefObject<HTMLDivElement | null>
  direction: PickerDirection
  orientation: Orientation
  reactions: string[]
  onSelect: (reaction: string) => void
  onClose: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}

/**
 * Rendered into the body with fixed positioning, so scroll containers
 * (topic lists, threads) can't clip it. Placed beside the rail, aligned with
 * the hovered arrow, and kept inside the window.
 */
function ReactionPicker({
  anchor,
  direction,
  orientation,
  reactions,
  onSelect,
  onClose,
  onPointerEnter,
  onPointerLeave
}: ReactionPickerProps): React.JSX.Element {
  const { t } = useTranslation()
  const emoji = useEmojiIndex()
  const root = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const rail = anchor.current?.getBoundingClientRect()
    const menu = root.current?.getBoundingClientRect()
    if (!rail || !menu) return
    const maxLeft = window.innerWidth - menu.width - EDGE
    const maxTop = window.innerHeight - menu.height - EDGE
    let top: number
    let left: number
    if (orientation === 'vertical') {
      left = rail.right + GAP <= maxLeft ? rail.right + GAP : rail.left - GAP - menu.width
      top = direction === 'up' ? rail.top : rail.bottom - menu.height
    } else {
      left = rail.left
      top = rail.top - GAP - menu.height >= EDGE ? rail.top - GAP - menu.height : rail.bottom + GAP
    }
    setPosition({ top: clamp(top, EDGE, maxTop), left: clamp(left, EDGE, maxLeft) })
  }, [anchor, direction, orientation, reactions.length])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) close.current()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close.current()
    }
    // A fixed picker would drift away from its rail; scrolling dismisses it instead.
    const onScroll = (event: Event): void => {
      if (!root.current?.contains(event.target as Node)) close.current()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close.current)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close.current)
    }
  }, [])

  return (
    <div
      ref={root}
      className={styles.picker}
      style={position ? { top: position.top, left: position.left } : { visibility: 'hidden', top: 0, left: 0 }}
      data-direction={direction}
      role="menu"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className={styles.pickerTitle}>{direction === 'up' ? t('interactions.vote.pickUp') : t('interactions.vote.pickDown')}</div>
      <div className={styles.grid}>
        {reactions.map((name) => (
          <button key={name} type="button" role="menuitem" title={`:${name}:`} className={styles.emoji} onClick={() => onSelect(name)}>
            <img src={emojiUrl(emoji, name)} alt={name} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
