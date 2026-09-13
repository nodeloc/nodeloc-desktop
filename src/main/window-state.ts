import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface WindowState {
  bounds: Partial<Pick<Rectangle, 'x' | 'y'>> & Pick<Rectangle, 'width' | 'height'>
  maximized: boolean
}

const DEFAULT_STATE: WindowState = { bounds: { width: 1360, height: 860 }, maximized: false }
const SAVE_DELAY_MS = 500

function stateFile(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

/** Last size and position, or a centered default if the saved spot is now off-screen. */
export function loadWindowState(): WindowState {
  try {
    const saved = JSON.parse(readFileSync(stateFile(), 'utf8')) as WindowState
    const { x, y, width, height } = saved.bounds
    if (![x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return DEFAULT_STATE
    }
    const bounds = { x: x!, y: y!, width, height }
    return isOnScreen(bounds) ? { bounds, maximized: saved.maximized === true } : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

/** Saves bounds as the window moves; uses normal bounds so un-maximizing restores properly. */
export function trackWindowState(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined

  const save = (): void => {
    clearTimeout(timer)
    if (window.isDestroyed() || window.isMinimized()) return
    const state: WindowState = { bounds: window.getNormalBounds(), maximized: window.isMaximized() }
    try {
      writeFileSync(stateFile(), JSON.stringify(state))
    } catch (error) {
      console.error('[window-state] could not save', error)
    }
  }
  const saveSoon = (): void => {
    clearTimeout(timer)
    timer = setTimeout(save, SAVE_DELAY_MS)
  }

  window.on('resize', saveSoon)
  window.on('move', saveSoon)
  window.on('maximize', save)
  window.on('unmaximize', save)
  window.on('close', save)
}

/** At least a title-bar-sized strip must land inside some display's work area. */
function isOnScreen(bounds: Rectangle): boolean {
  const { workArea } = screen.getDisplayMatching(bounds)
  const overlapX = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x)
  const overlapY = Math.min(bounds.y + 40, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y)
  return overlapX >= 120 && overlapY >= 20
}
