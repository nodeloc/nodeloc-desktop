/**
 * `app.isPackaged` becomes true when Electron's development executable is
 * renamed for branding. electron-vite sets this variable before spawning the
 * app, so it remains the reliable development signal in both cases.
 */
export const isDevelopment = process.env.NODE_ENV_ELECTRON_VITE === 'development'

export const isPackagedBuild = !isDevelopment
