import { create } from 'zustand'
import type { Boost, Post, VoteDirection } from '../../api/types'

export interface VoteSnapshot {
  score: number
  count: number
  direction: VoteDirection
  canVoteUp: boolean
  canVoteDown: boolean
}

/**
 * Changes made to one fetched copy of a post: a delete, a recover, a boost,
 * unlocked paid content. Replies loaded on demand live outside the query
 * cache and aren't refetched, so these stay until a refetch hands the view a
 * new copy of the post, which already carries the server's state.
 */
export interface LocalPostState {
  base: Post
  deleted?: boolean
  cooked?: string
  boosts?: Boost[]
  canBoost?: boolean
}

/**
 * Local state that wins over cached server data for a post: the result of a
 * vote or bookmark the user just made. A post appears in several caches
 * (topic lists, nested pages, context views); one override keeps them all
 * consistent without rewriting each cache.
 */
export interface PostOverride {
  vote?: VoteSnapshot
  bookmarked?: boolean
  local?: LocalPostState
}

interface PostOverridesState {
  overrides: Record<number, PostOverride>
  patch: (postId: number, partial: Omit<PostOverride, 'local'>) => void
  /** Merges into the local state for this copy of the post, replacing state kept for an older copy. */
  patchLocal: (post: Post, partial: Omit<LocalPostState, 'base'>) => void
  reset: () => void
}

export const usePostOverrides = create<PostOverridesState>((set) => ({
  overrides: {},
  patch: (postId, partial) =>
    set((state) => ({ overrides: { ...state.overrides, [postId]: { ...state.overrides[postId], ...partial } } })),
  patchLocal: (post, partial) =>
    set((state) => {
      const current = state.overrides[post.id]
      const local: LocalPostState =
        current?.local?.base === post ? { ...current.local, ...partial } : { base: post, ...partial }
      return { overrides: { ...state.overrides, [post.id]: { ...current, local } } }
    }),
  reset: () => set({ overrides: {} })
}))

export function usePostOverride(postId: number | undefined): PostOverride | undefined {
  return usePostOverrides((state) => (postId === undefined ? undefined : state.overrides[postId]))
}

export interface ResolvedPost {
  /** Shown as the deleted placeholder. */
  deleted: boolean
  /** Deleted in this session, so the post's own `can_recover` is out of date. */
  deletedHere: boolean
  cooked: string
  boosts: Boost[] | undefined
  canBoost: boolean
}

function resolve(post: Post, local: LocalPostState | undefined): ResolvedPost {
  const fresh = local?.base === post ? local : undefined
  return {
    deleted: fresh?.deleted ?? Boolean(post.deleted_post_placeholder || post.deleted_at || post.user_deleted),
    deletedHere: fresh?.deleted === true,
    cooked: fresh?.cooked ?? post.cooked ?? '',
    boosts: fresh?.boosts ?? post.boosts,
    canBoost: fresh?.canBoost ?? post.can_boost ?? false
  }
}

/** The post as the reader should see it right now: server data plus this session's changes. */
export function useLocalPost(post: Post): ResolvedPost {
  const local = usePostOverrides((state) => state.overrides[post.id]?.local)
  return resolve(post, local)
}

/** Non-reactive read for event handlers. */
export function readLocalPost(post: Post): ResolvedPost {
  return resolve(post, usePostOverrides.getState().overrides[post.id]?.local)
}
