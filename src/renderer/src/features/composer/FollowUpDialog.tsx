import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { showToast } from '../../components/toast-store'
import styles from './DiscardDialog.module.css'
import { useComposerErrorMessage } from './errors'
import { useFollowUps } from './follow-ups'

/** The post went out but its red envelope or lottery didn't: retry that part, or give up. */
export function FollowUpDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const describe = useComposerErrorMessage()
  const current = useFollowUps((state) => state.failed[0])
  const remove = useFollowUps((state) => state.remove)
  const update = useFollowUps((state) => state.update)
  const [retrying, setRetrying] = useState(false)

  const currentId = current?.id
  const dismiss = useCallback(() => {
    if (currentId !== undefined) remove(currentId)
  }, [currentId, remove])

  if (!current) return null

  const retry = async (): Promise<void> => {
    setRetrying(true)
    try {
      await current.run()
      remove(current.id)
      showToast(t(`composer.followUp.created.${current.kind}`), 'success')
    } catch (error) {
      update(current.id, describe(error))
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Dialog
      open
      onClose={dismiss}
      width={420}
      title={t('composer.followUp.title')}
      footer={
        <>
          <Button variant="ghost" disabled={retrying} onClick={dismiss}>
            {t('composer.followUp.dismiss')}
          </Button>
          <Button variant="primary" disabled={retrying} onClick={() => void retry()}>
            {retrying ? t('composer.followUp.retrying') : t('composer.followUp.retry')}
          </Button>
        </>
      }
    >
      <p className={styles.body} role="alert">
        {t(`composer.followUp.failed.${current.kind}`, { message: current.message })}
      </p>
    </Dialog>
  )
}
