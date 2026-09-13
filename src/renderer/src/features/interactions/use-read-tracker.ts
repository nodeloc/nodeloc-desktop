import { useEffect, type RefObject } from 'react'
import { apiRequest } from '../../api/client'
import { useIsSignedIn } from '../account/use-session'

const TICK_MS = 1000
/** Discourse's web client flushes more often; 30 s keeps the API key budget in check. */
const FLUSH_MS = 30_000
const VISIBLE_RATIO = 0.5

/**
 * Reports reading time (`POST /topics/timings`) for posts at least half on
 * screen while the window has focus. Posts are found by `data-post-number`
 * inside the container, including ones the virtual list mounts later.
 */
export function useReadTracker(topicId: number, container: RefObject<HTMLElement | null>): void {
  const signedIn = useIsSignedIn()

  useEffect(() => {
    const root = container.current
    if (!signedIn || !root || !Number.isInteger(topicId)) return

    const visible = new Set<number>()
    let timings = new Map<number, number>()
    let topicTime = 0

    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const postNumber = Number((entry.target as HTMLElement).dataset.postNumber)
          if (!Number.isInteger(postNumber)) continue
          if (entry.intersectionRatio >= VISIBLE_RATIO) visible.add(postNumber)
          else visible.delete(postNumber)
        }
      },
      { threshold: [0, VISIBLE_RATIO] }
    )

    const observed = new WeakSet<Element>()
    const observeAll = (): void => {
      root.querySelectorAll('[data-post-number]').forEach((element) => {
        if (observed.has(element)) return
        observed.add(element)
        intersection.observe(element)
      })
    }
    observeAll()
    const mutations = new MutationObserver(observeAll)
    mutations.observe(root, { childList: true, subtree: true })

    const tick = window.setInterval(() => {
      if (document.hidden || !document.hasFocus() || visible.size === 0) return
      topicTime += TICK_MS
      for (const postNumber of visible) timings.set(postNumber, (timings.get(postNumber) ?? 0) + TICK_MS)
    }, TICK_MS)

    const flush = (): void => {
      if (topicTime === 0 || timings.size === 0) return
      const form: Array<[string, number]> = [
        ['topic_id', topicId],
        ['topic_time', topicTime]
      ]
      for (const [postNumber, ms] of timings) form.push([`timings[${postNumber}]`, ms])
      topicTime = 0
      timings = new Map()
      // Background bookkeeping: a failure just loses this slice of reading time.
      void apiRequest({ method: 'POST', path: '/topics/timings', form, priority: 'background' }).catch(() => undefined)
    }
    const flushTimer = window.setInterval(flush, FLUSH_MS)

    return () => {
      window.clearInterval(tick)
      window.clearInterval(flushTimer)
      intersection.disconnect()
      mutations.disconnect()
      flush()
    }
  }, [signedIn, topicId, container])
}
