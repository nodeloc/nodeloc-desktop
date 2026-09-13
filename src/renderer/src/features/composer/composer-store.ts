import { create } from 'zustand'

/** What a reply answers. `replyToPostNumber` omitted = a reply to the topic itself. */
export interface ReplyTarget {
  topicId: number
  topicTitle: string
  replyToPostNumber?: number
  replyToUsername?: string
  /** Prefills a Discourse `[quote]` block. */
  quote?: { username: string; postNumber: number; text: string }
}

export interface NewTopicOptions {
  /** Preselected node. */
  categoryId?: number
}

/** Editing an existing post. The raw text is fetched by the composer (`GET /posts/{id}.json`). */
export interface EditTarget {
  topicId: number
  topicTitle: string
  postId: number
  postNumber: number
  /** The opening post: title, node and tags are editable too. */
  isFirstPost: boolean
}

/** A new private message. */
export interface MessageOptions {
  recipients?: string[]
  title?: string
}

export type ComposerSession =
  | { kind: 'reply'; target: ReplyTarget }
  | { kind: 'topic'; options: NewTopicOptions }
  | { kind: 'edit'; target: EditTarget }
  | { kind: 'message'; options: MessageOptions }

interface ComposerState {
  session: ComposerSession | null
  openReply: (target: ReplyTarget) => void
  openNewTopic: (options?: NewTopicOptions) => void
  openEdit: (target: EditTarget) => void
  openMessage: (options?: MessageOptions) => void
  close: () => void
}

/**
 * The one composer in the window. Other features open it through this store
 * (reply buttons, "new topic" buttons); `ComposerHost` renders it.
 */
export const useComposer = create<ComposerState>((set) => ({
  session: null,
  openReply: (target) => set({ session: { kind: 'reply', target } }),
  openNewTopic: (options = {}) => set({ session: { kind: 'topic', options } }),
  openEdit: (target) => set({ session: { kind: 'edit', target } }),
  openMessage: (options = {}) => set({ session: { kind: 'message', options } }),
  close: () => set({ session: null })
}))
