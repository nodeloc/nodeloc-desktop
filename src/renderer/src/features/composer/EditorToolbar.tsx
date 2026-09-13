import { Bold, ChartColumn, Code, EyeOff, Heading, Italic, Link, List, ListOrdered, LockKeyhole, Paperclip, Quote, SquareCode, Strikethrough } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../components/Button'
import { DropdownMenu } from '../../components/DropdownMenu'
import styles from './MarkdownEditor.module.css'

export type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'heading'
  | 'quote'
  | 'code'
  | 'codeBlock'
  | 'link'
  | 'bulletList'
  | 'numberedList'
  | 'spoiler'
  | 'hiddenReply'
  | 'hiddenLogin'
  | 'hiddenPay'

export type EditorMode = 'write' | 'preview'

/** Button groups; each action's label is `composer.editor.{action}`. */
const GROUPS: Array<Array<{ action: ToolbarAction; icon: ReactNode }>> = [
  [
    { action: 'bold', icon: <Bold strokeWidth={2.5} /> },
    { action: 'italic', icon: <Italic /> },
    { action: 'strikethrough', icon: <Strikethrough /> },
    { action: 'heading', icon: <Heading /> }
  ],
  [
    { action: 'quote', icon: <Quote /> },
    { action: 'code', icon: <Code /> },
    { action: 'codeBlock', icon: <SquareCode /> },
    { action: 'link', icon: <Link /> }
  ],
  [
    { action: 'bulletList', icon: <List /> },
    { action: 'numberedList', icon: <ListOrdered /> }
  ],
  [{ action: 'spoiler', icon: <EyeOff /> }]
]

/** discourse-permission's hidden-content tags. */
const HIDDEN_ACTIONS: readonly ToolbarAction[] = ['hiddenReply', 'hiddenLogin', 'hiddenPay']

interface EditorToolbarProps {
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  onAction: (action: ToolbarAction) => void
  onUpload: () => void
  onInsertPoll: () => void
}

export function EditorToolbar({ mode, onModeChange, onAction, onUpload, onInsertPoll }: EditorToolbarProps): React.JSX.Element {
  const { t } = useTranslation()
  const previewing = mode === 'preview'

  return (
    <div
      className={styles.toolbar}
      // Keep focus and the selection in the textarea while clicking tools.
      onMouseDown={(event) => {
        if ((event.target as Element).closest('button')) event.preventDefault()
      }}
    >
      {GROUPS.map((group, index) => (
        <div key={index} className={styles.toolGroup}>
          {group.map(({ action, icon }) => (
            <IconButton
              key={action}
              size="sm"
              label={t(`composer.editor.${action}`)}
              disabled={previewing}
              onClick={() => onAction(action)}
            >
              {icon}
            </IconButton>
          ))}
        </div>
      ))}

      <div className={styles.toolGroup}>
        <DropdownMenu
          align="start"
          trigger={({ open, toggle }) => (
            <IconButton size="sm" label={t('composer.editor.hidden')} aria-expanded={open} disabled={previewing} onClick={toggle}>
              <LockKeyhole />
            </IconButton>
          )}
          items={HIDDEN_ACTIONS.map((action) => ({
            key: action,
            label: t(`composer.editor.${action}`),
            onSelect: () => onAction(action)
          }))}
        />
        <IconButton size="sm" label={t('composer.editor.poll')} disabled={previewing} onClick={onInsertPoll}>
          <ChartColumn />
        </IconButton>
        <IconButton size="sm" label={t('composer.editor.upload')} onClick={onUpload}>
          <Paperclip />
        </IconButton>
      </div>

      <span className={styles.spacer} />

      <div className={styles.modes} role="group">
        {(['write', 'preview'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={styles.mode}
            aria-pressed={mode === value}
            onClick={() => onModeChange(value)}
          >
            {t(`composer.editor.${value}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
