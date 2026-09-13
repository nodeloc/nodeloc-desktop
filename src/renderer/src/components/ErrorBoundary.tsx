import { Bug } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Changing this (e.g. the route path) clears a caught error. */
  resetKey?: unknown
  /** Render nothing on error instead of the retry panel (for side content). */
  quiet?: boolean
}

interface ErrorBoundaryState {
  error: Error | null
  resetKey: unknown
}

/**
 * Keeps one broken view from taking down the whole window. Resets when
 * `resetKey` changes, so navigating away recovers without a reload.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] view crashed', error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    if (this.props.quiet) return null
    return <CrashPanel onRetry={() => this.setState({ error: null })} />
  }
}

function CrashPanel({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={<Bug />}
      title={t('errors.viewCrashed')}
      action={
        <Button variant="primary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    />
  )
}
