import { useCallback, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isApiErrorKind } from '../../api/client'
import { useCategoryIndex } from '../../api/site'
import type { NodeSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { useIsSignedIn, useRequireSignIn } from '../account/use-session'
import { HoverSwapButton } from '../social/HoverSwapButton'
import { toNodeSummary, useHasRequestedJoin, useJoinNode, useRequestJoin } from '../social/use-joined-nodes'
import styles from './JoinButton.module.css'
import type { NodeCategory } from './types'

interface JoinButtonProps {
  node: NodeSummary | NodeCategory
  size?: 'sm' | 'md'
}

/**
 * 加入 / 已加入 (hover: 退出) / 申请加入 for private nodes. Creators can't
 * leave, so theirs is a plain state label. The wrapper keeps clicks, including
 * those inside the portal dialog, from reaching a clickable card underneath.
 */
export function JoinButton({ node, size = 'md' }: JoinButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const requireSignIn = useRequireSignIn()
  const index = useCategoryIndex()
  const membership = useJoinNode()
  const requested = useHasRequestedJoin(node.id)
  const [requesting, setRequesting] = useState(false)
  const closeRequest = useCallback(() => setRequesting(false), [])

  const summary = toNodeSummary(node)
  const restricted = ('read_restricted' in node ? node.read_restricted : undefined) ?? index?.byId.get(node.id)?.read_restricted ?? false
  const joined = signedIn && summary.is_joined

  const toggle = (join: boolean): void => {
    if (membership.isPending) return
    membership.mutate({ node: summary, join })
  }

  let button: React.JSX.Element
  if (joined && summary.is_creator) {
    button = <HoverSwapButton size={size} label={t('nodes.joined')} title={t('nodes.creatorCannotLeave')} />
  } else if (joined) {
    button = (
      <HoverSwapButton
        size={size}
        label={t('nodes.joined')}
        hoverLabel={t('nodes.leave')}
        aria-busy={membership.isPending || undefined}
        onClick={() => toggle(false)}
      />
    )
  } else if (signedIn && restricted && requested) {
    button = <HoverSwapButton size={size} label={t('nodes.requested')} title={t('nodes.requestedHint')} />
  } else if (restricted) {
    button = (
      <Button
        size={size}
        variant="primary"
        onClick={() => {
          if (requireSignIn()) setRequesting(true)
        }}
      >
        {t('nodes.requestJoin')}
      </Button>
    )
  } else {
    button = (
      <Button
        size={size}
        variant="primary"
        aria-busy={membership.isPending || undefined}
        onClick={() => {
          if (requireSignIn()) toggle(true)
        }}
      >
        {t('nodes.join')}
      </Button>
    )
  }

  return (
    <span className={styles.wrap} onClick={(event) => event.stopPropagation()}>
      {button}
      {restricted && <RequestJoinDialog node={summary} open={requesting} onClose={closeRequest} />}
    </span>
  )
}

function RequestJoinDialog({ node, open, onClose }: { node: NodeSummary; open: boolean; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const formId = useId()
  const request = useRequestJoin()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!trimmed || request.isPending) return
    request.mutate(
      { node, reason: trimmed },
      {
        onSuccess: () => {
          setReason('')
          onClose()
        },
        // Already requested counts as done; other failures keep the text for another try.
        onError: (error) => {
          if (isApiErrorKind(error, 'conflict')) onClose()
        }
      }
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('nodes.request.title', { name: node.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={!trimmed || request.isPending}>
            {t('nodes.request.submit')}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        <p className={styles.intro}>{t('nodes.request.intro')}</p>
        <label className={styles.label} htmlFor={`${formId}-reason`}>
          {t('nodes.request.reasonLabel')}
        </label>
        <textarea
          id={`${formId}-reason`}
          className={styles.reason}
          value={reason}
          rows={4}
          placeholder={t('nodes.request.reasonPlaceholder')}
          onChange={(event) => setReason(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event)
          }}
        />
      </form>
    </Dialog>
  )
}
