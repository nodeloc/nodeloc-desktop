import type { AuthState } from '@shared/bridge'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { apiRequest } from '../../api/client'
import type { CurrentUser, CurrentUserResponse } from '../../api/types'
import { usePostOverrides } from '../interactions/post-overrides'
import { useSignInDialog } from './sign-in-store'

export const AUTH_STATE_KEY = ['auth-state'] as const
export const CURRENT_USER_KEY = ['current-user'] as const

/** Queries that don't depend on who is signed in and survive an account change. */
const ACCOUNT_INDEPENDENT = new Set(['auth-state', 'app-info', 'mobile-meta', 'about'])

const SIGNED_OUT: AuthState = { status: 'signedOut' }

export function useAuthState(): AuthState {
  return (
    useQuery({
      queryKey: AUTH_STATE_KEY,
      queryFn: () => window.nodeloc.auth.getState(),
      staleTime: Infinity
    }).data ?? SIGNED_OUT
  )
}

export function useIsSignedIn(): boolean {
  return useAuthState().status === 'signedIn'
}

/**
 * Mounted once: mirrors auth changes from the main process into the query
 * cache, and refetches everything user-specific (votes, bookmarks, read
 * state, private categories) when the signed-in account changes.
 */
export function useAuthSync(): void {
  const queryClient = useQueryClient()
  const account = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const apply = (state: AuthState): void => {
      queryClient.setQueryData(AUTH_STATE_KEY, state)
      const current = state.status === 'signedIn' ? (state.username ?? '') : null
      if (account.current !== undefined && account.current !== current && state.status !== 'pending') {
        usePostOverrides.getState().reset()
        void queryClient.resetQueries({ predicate: (query) => !ACCOUNT_INDEPENDENT.has(String(query.queryKey[0])) })
      }
      if (state.status !== 'pending') account.current = current
    }
    void window.nodeloc.auth.getState().then(apply)
    return window.nodeloc.events.onAuthChanged(apply)
  }, [queryClient])
}

export function useCurrentUser(): CurrentUser | undefined {
  const auth = useAuthState()
  return useQuery({
    queryKey: [...CURRENT_USER_KEY, auth.username],
    queryFn: async () => (await apiRequest<CurrentUserResponse>({ path: '/session/current.json' })).current_user,
    enabled: auth.status === 'signedIn',
    staleTime: 60_000
  }).data
}

/**
 * For write actions: returns true when signed in; otherwise opens the
 * sign-in dialog and returns false.
 */
export function useRequireSignIn(): () => boolean {
  const signedIn = useIsSignedIn()
  const show = useSignInDialog((state) => state.show)
  return useCallback(() => {
    if (signedIn) return true
    show()
    return false
  }, [signedIn, show])
}
