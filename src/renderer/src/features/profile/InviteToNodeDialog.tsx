import { Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import type { NodeSummary } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { EmptyState } from '../../components/EmptyState'
import { NodeIcon } from '../../components/NodeIcon'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import { useAuthState } from '../account/use-session'
import { useNodesByUser } from './use-profile'
import styles from './InviteToNodeDialog.module.css'

interface InviteResult {
  invited: string[]
  skipped: Array<{ username: string; reason: string }>
}

export function InviteToNodeDialog({ username, onClose }: { username: string; onClose: () => void }): React.JSX.Element {
  const me = useAuthState().username
  return (
    <Dialog open onClose={onClose} title={<InviteTitle username={username} />} width={440}>
      {me ? <InviteToNodeContent owner={me} username={username} onClose={onClose} /> : null}
    </Dialog>
  )
}

function InviteTitle({ username }: { username: string }): React.JSX.Element {
  const { t } = useTranslation()
  return <>{t('profile.invite.title', { username })}</>
}

function InviteToNodeContent({ owner, username, onClose }: { owner: string; username: string; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const nodes = useNodesByUser(owner)
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const owned = nodes.data?.owned ?? []
  const ids = new Set(owned.map((node) => node.id))
  const choices = [...owned, ...(nodes.data?.moderated ?? []).filter((node) => !ids.has(node.id))]
  const chosen = choices.find((node) => node.id === selected)

  const invite = async (): Promise<void> => {
    if (!chosen || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest<InviteResult>({
        method: 'POST',
        path: `/node/${chosen.id}/invite-members.json`,
        form: [['usernames', username]],
        priority: 'user'
      })
      if (!result.invited.some((value) => value.toLowerCase() === username.toLowerCase())) {
        const reason = result.skipped.find((entry) => entry.username.toLowerCase() === username.toLowerCase())?.reason
        setError(t(`profile.invite.skipped.${reason ?? 'unknown'}`))
        return
      }
      showToast(t('profile.invite.success', { username, node: chosen.name }), 'success')
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (nodes.isPending) {
    return <SkeletonGroup className={styles.skeleton}><SkeletonLine /><SkeletonLine width={0.8} /></SkeletonGroup>
  }

  if (nodes.isError) {
    return <EmptyState title={errorMessage(nodes.error)} action={<Button onClick={() => void nodes.refetch()}>{t('common.retry')}</Button>} />
  }

  if (choices.length === 0) return <EmptyState title={t('profile.invite.noNodes')} />

  return (
    <div className={styles.content}>
      <div className={styles.nodes} role="radiogroup" aria-label={t('profile.invite.chooseNode')}>
        {choices.map((node: NodeSummary) => (
          <button
            key={node.id}
            type="button"
            role="radio"
            aria-checked={selected === node.id}
            className={cx(styles.node, selected === node.id && styles.selected)}
            onClick={() => setSelected(node.id)}
          >
            <NodeIcon name={node.name} color={node.color} logo={node.uploaded_logo} logoDark={node.uploaded_logo_dark} size={32} />
            <span><strong>{node.name}</strong><small>n/{node.slug}</small></span>
          </button>
        ))}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" icon={<Send />} disabled={!chosen || busy} onClick={() => void invite()}>
          {t('profile.invite.action')}
        </Button>
      </div>
    </div>
  )
}
