import { Copy, Ellipsis, Link, Pencil, Trash2 } from 'lucide-react'
import { SITE_ORIGIN } from '@shared/site'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button, IconButton } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import { paths } from '../../lib/routes'
import { useIsSignedIn } from '../account/use-session'
import { CustomFeedDialog, type CustomFeedDialogMode } from './CustomFeedDialog'
import styles from './CustomFeeds.module.css'
import { useCustomFeedDetail, useDeleteCustomFeed } from './use-custom-feeds'

/** The "…" menu on a custom feed page: edit, copy, copy link, delete. */
export function CustomFeedActions({ username, slug }: { username: string; slug: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signedIn = useIsSignedIn()
  const detail = useCustomFeedDetail(username, slug)
  const remove = useDeleteCustomFeed()
  const [dialog, setDialog] = useState<CustomFeedDialogMode | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const feed = detail.data
  if (!feed) return null

  const url = `${SITE_ORIGIN}${feed.url ?? paths.customFeed(feed.username, feed.slug)}`
  const items: Array<MenuItem | 'separator'> = []
  if (feed.can_edit) {
    items.push({ key: 'edit', label: t('customFeeds.edit'), icon: <Pencil />, onSelect: () => setDialog({ mode: 'edit', feed }) })
  } else if (signedIn) {
    items.push({ key: 'copy', label: t('customFeeds.copy'), icon: <Copy />, onSelect: () => setDialog({ mode: 'copy', source: feed }) })
  }
  items.push({
    key: 'link',
    label: t('customFeeds.copyLink'),
    icon: <Link />,
    onSelect: () => {
      void window.nodeloc.shell.copyText(url).then(() => showToast(t('customFeeds.linkCopied'), 'success'))
    }
  })
  if (feed.can_edit) {
    items.push('separator', {
      key: 'delete',
      label: t('customFeeds.delete'),
      icon: <Trash2 />,
      danger: true,
      onSelect: () => setConfirmDelete(true)
    })
  }

  return (
    <>
      <DropdownMenu
        items={items}
        trigger={({ toggle }) => (
          <IconButton label={t('customFeeds.manage')} onClick={toggle}>
            <Ellipsis strokeWidth={2.5} />
          </IconButton>
        )}
      />
      <CustomFeedDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onSaved={(saved) => {
          if (dialog?.mode === 'copy') navigate(paths.customFeed(saved.username, saved.slug))
        }}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('customFeeds.deleteTitle')}
        width={400}
        dismissible={!remove.isPending}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              className={cx(styles.dangerSolid)}
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(feed, {
                  onSuccess: () => {
                    setConfirmDelete(false)
                    navigate(paths.home(), { replace: true })
                  }
                })
              }
            >
              {t('customFeeds.delete')}
            </Button>
          </>
        }
      >
        <p>{t('customFeeds.deleteConfirm', { name: feed.name })}</p>
      </Dialog>
    </>
  )
}
