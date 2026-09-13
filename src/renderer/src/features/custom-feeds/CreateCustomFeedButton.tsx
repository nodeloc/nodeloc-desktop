import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from '../../lib/routes'
import { CustomFeedDialog, type CustomFeedDialogMode } from './CustomFeedDialog'
import styles from './CustomFeeds.module.css'

/** Sidebar row under the custom feeds list. Opens the new feed once created. */
export function CreateCustomFeedButton(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<CustomFeedDialogMode | null>(null)

  return (
    <>
      <button type="button" className={styles.createRow} onClick={() => setDialog({ mode: 'create' })}>
        <Plus />
        {t('customFeeds.create')}
      </button>
      <CustomFeedDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onSaved={(feed) => navigate(paths.customFeed(feed.username, feed.slug))}
      />
    </>
  )
}
