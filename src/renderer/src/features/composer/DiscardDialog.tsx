import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import styles from './DiscardDialog.module.css'

interface DiscardDialogProps {
  open: boolean
  /** Back to the editor. Pass a stable callback: the dialog re-focuses when it changes. */
  onCancel: () => void
  /** Close and keep the draft. Leave out where there is no draft (editing). */
  onKeep?: () => void
  onDiscard: () => void
  title?: string
  body?: string
  discardLabel?: string
}

/** Asked when closing a composer that has text. Keeping the draft is the default. */
export function DiscardDialog({ open, onCancel, onKeep, onDiscard, title, body, discardLabel }: DiscardDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      width={400}
      title={title ?? t('composer.discard.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t('composer.discard.cancel')}
          </Button>
          <Button className={styles.danger} onClick={onDiscard}>
            {discardLabel ?? t('composer.discard.discard')}
          </Button>
          {onKeep && (
            <Button variant="primary" onClick={onKeep}>
              {t('composer.discard.keep')}
            </Button>
          )}
        </>
      }
    >
      <p className={styles.body}>{body ?? t('composer.discard.body')}</p>
    </Dialog>
  )
}
