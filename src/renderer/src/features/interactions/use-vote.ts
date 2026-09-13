import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiException, apiRequest } from '../../api/client'
import type { Post, VoteDirection } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { showToast } from '../../components/toast-store'
import { useRequireSignIn } from '../account/use-session'
import { usePostOverrides, type VoteSnapshot } from './post-overrides'

const weight = (direction: VoteDirection): number => (direction === 'up' ? 1 : direction === 'down' ? -1 : 0)
const counted = (direction: VoteDirection): number => (direction === 'none' ? 0 : 1)

/** The expected result of a vote, shown immediately; the server response replaces it. */
export function applyVote(current: VoteSnapshot, next: VoteDirection): VoteSnapshot {
  return {
    ...current,
    direction: next,
    score: current.score - weight(current.direction) + weight(next),
    count: Math.max(0, current.count - counted(current.direction) + counted(next))
  }
}

function snapshotFromPost(post: Partial<Post>, fallback: VoteSnapshot): VoteSnapshot {
  return {
    score: post.vote_score ?? fallback.score,
    count: post.vote_count ?? fallback.count,
    direction: post.vote_direction ?? fallback.direction,
    canVoteUp: post.can_vote_up ?? fallback.canVoteUp,
    canVoteDown: post.can_vote_down ?? fallback.canVoteDown
  }
}

/**
 * discourse-vote: `PUT /vote/posts/:id` with the direction to end in (so
 * repeating a request is harmless) and optionally which reaction. The
 * reactions toggle endpoint is deliberately not used: it skips the
 * downvote permission and daily limit checks.
 */
export function useVote(): (postId: number, current: VoteSnapshot, direction: VoteDirection, reaction?: string) => Promise<void> {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const requireSignIn = useRequireSignIn()
  const patch = usePostOverrides((state) => state.patch)

  return useCallback(
    async (postId, current, direction, reaction) => {
      if (!requireSignIn()) return
      patch(postId, { vote: applyVote(current, direction) })
      try {
        const post = await apiRequest<Partial<Post>>({
          method: 'PUT',
          path: `/vote/posts/${postId}.json`,
          form: reaction ? [['direction', direction], ['reaction', reaction]] : [['direction', direction]],
          priority: 'user'
        })
        patch(postId, { vote: snapshotFromPost(post ?? {}, applyVote(current, direction)) })
      } catch (error) {
        patch(postId, { vote: current })
        const limited = error instanceof ApiException && error.error.kind === 'rateLimited' && direction === 'down'
        showToast(limited ? t('interactions.vote.downvoteLimit') : errorMessage(error), 'danger')
      }
    },
    [requireSignIn, patch, errorMessage, t]
  )
}
