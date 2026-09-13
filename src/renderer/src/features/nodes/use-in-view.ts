import { useEffect, useState } from 'react'

/**
 * Whether `element` is within `margin` of the scroll container `root`.
 * Takes elements (from callback refs) rather than ref objects, so it
 * re-subscribes when a conditionally rendered element appears.
 */
export function useInView(element: Element | null, root: Element | null, margin = '0px'): boolean {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!element || !root) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { root, rootMargin: margin })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, root, margin])

  return inView
}
