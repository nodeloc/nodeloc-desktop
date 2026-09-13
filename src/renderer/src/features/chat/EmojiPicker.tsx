import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { emojiUrl, useEmojiIndex } from '../content/use-emoji'
import styles from './EmojiPicker.module.css'

/** Reactions offered without a full picker, by their Discourse names. */
const COMMON_EMOJI = [
  '+1',
  'heart',
  'joy',
  'laughing',
  'open_mouth',
  'cry',
  'clap',
  'tada',
  'fire',
  'eyes',
  'thinking',
  'pray',
  '100',
  'rocket',
  'white_check_mark',
  'heart_eyes'
]

interface EmojiPickerProps {
  placement: 'top' | 'bottom'
  onSelect: (name: string) => void
  onClose: () => void
}

/**
 * A compact grid of common emoji, anchored to its parent element. Clicks
 * outside the parent (so its toggle button still toggles) and Esc close it.
 */
export function EmojiPicker({ placement, onSelect, onClose }: EmojiPickerProps): React.JSX.Element {
  const { t } = useTranslation()
  const emoji = useEmojiIndex()
  const root = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const anchor = root.current?.parentElement
      if (!anchor?.contains(event.target as Node)) close.current()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close.current()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div ref={root} className={cx(styles.picker, styles[placement])} role="menu">
      <div className={styles.title}>{t('chat.message.commonEmoji')}</div>
      <div className={styles.grid}>
        {COMMON_EMOJI.map((name) => (
          <button key={name} type="button" role="menuitem" title={`:${name}:`} className={styles.emoji} onClick={() => onSelect(name)}>
            <img src={emojiUrl(emoji, name)} alt={name} loading="lazy" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  )
}
