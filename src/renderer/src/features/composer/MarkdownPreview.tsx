import { useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { PostContent } from '../content/PostContent'
import styles from './MarkdownEditor.module.css'
import { createPreviewRenderer } from './markdown-preview'

interface MarkdownPreviewProps {
  raw: string
  size: 'body' | 'reply'
  className?: string
  style?: CSSProperties
}

/** The draft rendered locally through `PostContent`, so it looks like a published post. Approximate by nature. */
export function MarkdownPreview({ raw, size, className, style }: MarkdownPreviewProps): React.JSX.Element {
  const { t } = useTranslation()
  const render = useMemo(
    () =>
      createPreviewRenderer({
        video: (name) => t('composer.editor.video', { name }),
        audio: (name) => t('composer.editor.audio', { name })
      }),
    [t]
  )
  const html = useMemo(() => render(raw), [render, raw])

  return (
    <div className={cx(styles.preview, className)} style={style}>
      {raw.trim() ? (
        <PostContent html={html} size={size} />
      ) : (
        <p className={styles.previewEmpty}>{t('composer.editor.previewEmpty')}</p>
      )}
      <p className={styles.previewNote}>{t('composer.editor.previewNote')}</p>
    </div>
  )
}
