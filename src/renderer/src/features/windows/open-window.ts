import { showToast } from '../../components/toast-store'
import i18n from '../../i18n'

/** Opens an in-app route (`paths.topic(id)` …) in its own compact window. */
export async function openInNewWindow(route: string): Promise<void> {
  const opened = await window.nodeloc.windows.open(route).catch(() => false)
  if (!opened) showToast(i18n.t('windows.openFailed'), 'danger')
}
