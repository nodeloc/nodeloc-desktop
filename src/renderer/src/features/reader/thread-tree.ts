import type { Post } from '../../api/types'

/** Replies loaded on demand for one parent, replacing its preloaded children. */
export interface ChildState {
  posts: Post[]
  /** Next page to request, or null when the parent's replies are all loaded. */
  nextPage: number | null
  loading: boolean
  failed: boolean
}

export type ThreadRow =
  | {
      type: 'post'
      key: string
      post: Post
      depth: number
      /** Post ids of the ancestors, outermost first; their lines collapse them. */
      ancestorIds: number[]
      /**
       * One entry per level from 1 to `depth`: whether the post on this row's
       * path at that level has siblings below it. Drives the thread lines: a
       * pass-through line for ancestor levels, and whether this row's own
       * connector continues down (the last entry).
       */
      continues: boolean[]
      /** Replies are shown beneath it, so its line runs down from the avatar. */
      hasChildren: boolean
      collapsed: boolean
      lowScore: boolean
    }
  | {
      type: 'more'
      key: string
      parent: Post
      depth: number
      ancestorIds: number[]
      continues: boolean[]
      remaining: number
      loading: boolean
      failed: boolean
    }

export interface FlattenOptions {
  /** Explicit collapse choices by post id; unset posts fall back to the low-score rule. */
  toggles: ReadonlyMap<number, boolean>
  childState: Readonly<Record<number, ChildState>>
  /** `vote_collapse_score_threshold`; posts at or below it start collapsed. */
  collapseThreshold?: number
  /** Depth of the first level of posts (non-zero when showing a sub-thread). */
  baseDepth?: number
  baseAncestors?: number[]
  /** `continues` for the first level of posts (all false under a single ancestor chain). */
  baseContinues?: boolean[]
}

export function isLowScore(post: Post, threshold: number | undefined): boolean {
  return threshold !== undefined && post.vote_score !== undefined && post.vote_score <= threshold
}

/**
 * Walks the server's reply tree depth-first into flat rows for the virtual
 * list. Collapsed posts hide their whole subtree; parents with more direct
 * replies than are loaded get a "N more replies" row, drawn as their last child.
 */
export function flattenThread(roots: Post[], options: FlattenOptions): ThreadRow[] {
  const rows: ThreadRow[] = []
  const { toggles, childState, collapseThreshold } = options

  const visit = (post: Post, depth: number, ancestorIds: number[], continues: boolean[]): void => {
    const state = childState[post.id]
    const children = state ? state.posts : (post.children ?? [])
    const lowScore = isLowScore(post, collapseThreshold)
    const collapsed = toggles.get(post.id) ?? lowScore

    const total = post.direct_reply_count ?? children.length
    const remaining = state ? (state.nextPage === null ? 0 : Math.max(total - children.length, 1)) : Math.max(total - children.length, 0)
    const showMore = !collapsed && (remaining > 0 || Boolean(state?.loading) || Boolean(state?.failed))
    const hasChildren = !collapsed && (children.length > 0 || showMore)

    rows.push({ type: 'post', key: `p${post.id}`, post, depth, ancestorIds, continues, hasChildren, collapsed, lowScore })
    if (collapsed) return

    const childAncestors = [...ancestorIds, post.id]
    children.forEach((child, index) => {
      const isLast = index === children.length - 1 && !showMore
      visit(child, depth + 1, childAncestors, [...continues, !isLast])
    })

    if (showMore) {
      rows.push({
        type: 'more',
        key: `m${post.id}`,
        parent: post,
        depth: depth + 1,
        ancestorIds: childAncestors,
        continues: [...continues, false],
        remaining,
        loading: state?.loading ?? false,
        failed: state?.failed ?? false
      })
    }
  }

  const baseDepth = options.baseDepth ?? 0
  const baseContinues = options.baseContinues ?? Array.from({ length: baseDepth }, () => false)
  for (const root of roots) visit(root, baseDepth, options.baseAncestors ?? [], baseContinues)
  return rows
}

/** Merges a fetched page into the replies already shown, keeping order and dropping duplicates. */
export function mergePosts(existing: Post[], incoming: Post[]): Post[] {
  const seen = new Set(existing.map((post) => post.id))
  return [...existing, ...incoming.filter((post) => !seen.has(post.id))]
}
