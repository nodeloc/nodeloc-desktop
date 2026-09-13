import { Menu, Tray, nativeImage } from 'electron'
import { strings } from './strings'

export interface TrayActions {
  show: () => void
  quit: () => void
}

export function createTray(iconPath: string, actions: TrayActions): Tray {
  const tray = new Tray(nativeImage.createFromPath(iconPath))
  updateTrayLanguage(tray, actions)
  tray.on('click', actions.show)
  return tray
}

export function updateTrayLanguage(tray: Tray, actions: TrayActions): void {
  tray.setToolTip(strings.appName)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: strings.trayOpen, click: actions.show },
      { type: 'separator' },
      { label: strings.trayQuit, click: actions.quit }
    ])
  )
}
