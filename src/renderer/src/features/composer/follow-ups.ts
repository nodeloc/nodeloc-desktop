import { create } from 'zustand'
import { showToast } from '../../components/toast-store'

export type FollowUpKind = 'redEnvelope' | 'lottery'

/** Work that attaches to a post after it's created (red envelope, lottery). */
export interface FollowUpTask {
  kind: FollowUpKind
  run: () => Promise<void>
}

export interface FailedFollowUp extends FollowUpTask {
  id: number
  message: string
}

interface FollowUpState {
  failed: FailedFollowUp[]
  add: (item: FailedFollowUp) => void
  update: (id: number, message: string) => void
  remove: (id: number) => void
}

let nextId = 0

/** Failed follow-ups waiting for the user to retry or give up; shown by `FollowUpDialog`. */
export const useFollowUps = create<FollowUpState>((set) => ({
  failed: [],
  add: (item) => set((state) => ({ failed: [...state.failed, item] })),
  update: (id, message) => set((state) => ({ failed: state.failed.map((item) => (item.id === id ? { ...item, message } : item)) })),
  remove: (id) => set((state) => ({ failed: state.failed.filter((item) => item.id !== id) }))
}))

/**
 * Runs follow-ups in order (red envelope first: it must exist before any
 * reply). Failures never re-post; they wait in the store for a retry.
 */
export async function runFollowUps(
  tasks: FollowUpTask[],
  messages: { describe: (error: unknown) => string; created: (kind: FollowUpKind) => string }
): Promise<void> {
  for (const task of tasks) {
    try {
      await task.run()
      showToast(messages.created(task.kind), 'success')
    } catch (error) {
      useFollowUps.getState().add({ ...task, id: ++nextId, message: messages.describe(error) })
    }
  }
}
