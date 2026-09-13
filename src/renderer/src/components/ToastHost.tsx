import { CircleAlert, CircleCheck } from 'lucide-react'
import { useToastStore } from './toast-store'
import styles from './ToastHost.module.css'

export function ToastHost(): React.JSX.Element {
  const toast = useToastStore((state) => state.toast)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toast && (
        <button key={toast.id} type="button" className={styles.toast} data-tone={toast.tone} onClick={dismiss}>
          {toast.tone === 'success' && <CircleCheck />}
          {toast.tone === 'danger' && <CircleAlert />}
          <span>{toast.message}</span>
        </button>
      )}
    </div>
  )
}
