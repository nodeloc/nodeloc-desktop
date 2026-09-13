import { useEffect, useRef } from 'react'
import { useIsSignedIn, useRequireSignIn } from '../account/use-session'
import { useComposer, type ComposerSession } from './composer-store'
import { EditComposer } from './EditComposer'
import { FollowUpDialog } from './FollowUpDialog'
import { MessageDialog } from './MessageDialog'
import { NewTopicDialog } from './NewTopicDialog'
import { ReplyDock } from './ReplyDock'

/**
 * Renders the active composer session (reply or edit dock, new-topic,
 * first-post edit or message dialog), plus retries for red envelopes and
 * lotteries that didn't attach. Writing needs an account: a session opened
 * while signed out asks for sign-in and closes; signing out closes an open
 * one quietly.
 */
export function ComposerHost(): React.JSX.Element {
  const session = useComposer((state) => state.session)
  const close = useComposer((state) => state.close)
  const signedIn = useIsSignedIn()
  const requireSignIn = useRequireSignIn()
  const checked = useRef<ComposerSession | null>(null)

  useEffect(() => {
    if (!session) {
      checked.current = null
      return
    }
    if (checked.current === session) {
      if (!signedIn) close()
      return
    }
    checked.current = session
    if (!requireSignIn()) close()
  }, [session, signedIn, requireSignIn, close])

  return (
    <>
      {session && signedIn && <ActiveSession session={session} />}
      <FollowUpDialog />
    </>
  )
}

function ActiveSession({ session }: { session: ComposerSession }): React.JSX.Element {
  switch (session.kind) {
    case 'reply':
      return <ReplyDock target={session.target} />
    case 'topic':
      return <NewTopicDialog options={session.options} />
    case 'edit':
      return <EditComposer key={session.target.postId} target={session.target} />
    case 'message':
      return <MessageDialog options={session.options} />
  }
}
