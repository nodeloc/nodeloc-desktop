import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import styles from './PostDialogs.module.css'

/** Confirms a delete. The delete itself runs optimistically once confirmed. */
export function DeletePostDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('interactions.manage.deleteTitle')}
      width={400}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            className={styles.danger}
            icon={<Trash2 strokeWidth={2.5} />}
            onClick={() => {
              onClose()
              onConfirm()
            }}
          >
            {t('interactions.manage.deleteConfirm')}
          </Button>
        </>
      }
    >
      <p className={styles.text}>{t('interactions.manage.deleteMessage')}</p>
    </Dialog>
  )
}
