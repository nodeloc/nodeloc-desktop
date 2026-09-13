import { Coins, LockKeyhole, LogIn, MessageSquareText } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Post } from '../../../api/types'
import { PayUnlockButton } from '../../interactions/PayUnlock'
import styles from './HiddenContent.module.css'

type HiddenKind = 'reply' | 'login' | 'pay' | 'payClosed' | 'trust'

const ICONS: Record<HiddenKind, ReactNode> = {
  reply: <MessageSquareText />,
  login: <LogIn strokeWidth={2.5} />,
  pay: <Coins />,
  payClosed: <Coins />,
  trust: <LockKeyhole />
}

/** discourse-permission / read-permission placeholders for content the reader can't see yet. */
export function HiddenPlaceholder({
  kind,
  amount,
  text,
  post,
  contentId
}: {
  kind: HiddenKind
  amount?: number
  text?: string
  /** For `pay`: the post it belongs to, which enables the unlock button. */
  post?: Post
  contentId?: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const label = kind === 'trust' && text ? text : t(`content.hidden.${kind}`, { amount: amount ?? 0 })
  return (
    <span className={styles.placeholder} data-kind={kind}>
      {ICONS[kind]}
      {label}
      {kind === 'pay' && post && amount ? <PayUnlockButton post={post} amount={amount} contentId={contentId} /> : null}
    </span>
  )
}

/** Hidden content the reader has unlocked, shown with a small label so it's clear why it was hidden. */
export function UnlockedContent({ type, children }: { type?: string; children: ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const label =
    type === 'login' ? t('content.hidden.unlockedLogin') : type === 'reply' ? t('content.hidden.unlockedReply') : t('content.hidden.unlockedPay')
  return (
    <div className={styles.unlocked}>
      <div className={styles.unlockedLabel}>{label}</div>
      {children}
    </div>
  )
}
