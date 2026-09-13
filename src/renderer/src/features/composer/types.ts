import type { Post } from '../../api/types'

/** `GET /posts/{id}.json` includes the Markdown source. */
export interface EditablePost extends Post {
  raw?: string
}

/** `GET /drafts/{key}.json`. `draft` is the JSON string the composer saved. */
export interface DraftShowResponse {
  draft: string | null
  draft_sequence: number
}

/** `POST /drafts.json`. */
export interface DraftSaveResponse {
  success?: string | boolean
  draft_sequence?: number
}

/** `GET /u/search/users.json`. `groups` only with a group flag and a term. */
export interface UserSearchResponse {
  users: Array<{ id?: number; username: string; name?: string | null; avatar_template: string }>
  groups?: Array<{ name: string; full_name?: string | null }>
}

/** `GET /hashtags/search.json`. Insert `#` + `ref`. */
export interface HashtagSearchResponse {
  results: Array<{ text: string; ref: string; type: string; description?: string | null; relative_url?: string }>
}

/** `GET /tags/filter/search.json`. */
export interface TagSearchResponse {
  results: Array<{ id?: number; name: string; text?: string; count?: number }>
}

/** `POST /posts.json` when the post was published. Only the fields the composer uses. */
export interface CreatedPost {
  id: number
  post_number: number
  topic_id: number
  topic_slug?: string
}

/** `POST /posts.json` when the post went to the review queue instead. */
export interface EnqueuedPost {
  success?: boolean
  action: 'enqueued'
  pending_count?: number
}

export type CreatePostResponse = CreatedPost | EnqueuedPost

export function isEnqueued(response: CreatePostResponse): response is EnqueuedPost {
  return 'action' in response && response.action === 'enqueued'
}
