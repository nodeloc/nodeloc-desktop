import { Copy } from 'lucide-react'
import hljs from 'highlight.js/lib/common'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../../components/Button'
import { showToast } from '../../../components/toast-store'
import styles from './CodeBlock.module.css'

/** Auto-detection is costly on long code; past this, show plain text. */
const AUTO_DETECT_LIMIT = 4000
const PLAIN_LANGUAGES = new Set(['text', 'plaintext', 'txt', 'nohighlight'])

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** highlight.js output is escaped markup built from the code text, never from post HTML. */
function highlight(code: string, language: string | undefined): { html: string; label?: string } {
  try {
    if (language && !PLAIN_LANGUAGES.has(language) && language !== 'auto' && hljs.getLanguage(language)) {
      return { html: hljs.highlight(code, { language, ignoreIllegals: true }).value, label: language }
    }
    if ((!language || language === 'auto') && code.length <= AUTO_DETECT_LIMIT) {
      const result = hljs.highlightAuto(code)
      return { html: result.value, label: result.relevance > 5 ? result.language : undefined }
    }
  } catch {
    // Fall through to plain text.
  }
  return { html: escapeHtml(code), label: language && !PLAIN_LANGUAGES.has(language) && language !== 'auto' ? language : undefined }
}

export function CodeBlock({ code, language }: { code: string; language?: string }): React.JSX.Element {
  const { t } = useTranslation()
  const { html, label } = useMemo(() => highlight(code.replace(/\n$/, ''), language), [code, language])

  const copy = async (): Promise<void> => {
    await window.nodeloc.shell.copyText(code)
    showToast(t('content.codeCopied'), 'success')
  }

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <span className={styles.language}>{label ?? ''}</span>
        <IconButton label={t('content.copyCode')} size="sm" onClick={() => void copy()}>
          <Copy />
        </IconButton>
      </div>
      <pre className={styles.pre}>
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}
