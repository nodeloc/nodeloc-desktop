import { useEffect } from 'react'
import { useNavigate } from 'react-router'

/**
 * Development-only handles for driving the app from automation (Playwright
 * over CDP): the memory router has no URL bar to type into.
 */
export function DevHooks(): null {
  const navigate = useNavigate()
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__nodelocNavigate = (to, options) => navigate(to, options)
    return () => {
      delete window.__nodelocNavigate
    }
  }, [navigate])
  return null
}
