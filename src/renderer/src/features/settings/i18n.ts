import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    title: '设置',
    appearance: {
      title: '外观',
      language: '语言',
      languages: {
        system: '跟随系统',
        'zh-CN': '中文',
        en: 'English'
      },
      theme: '主题',
      readingMode: '话题列表阅读模式'
    },
    notifications: {
      title: '桌面通知',
      intro: '应用运行时（包括最小化到托盘时）通过 Windows 通知提醒你。窗口在前台时不弹出。',
      enabled: '启用桌面通知',
      sound: '播放提示音',
      categories: {
        replies: '回复与提及',
        likes: '点赞、回应与助力',
        messages: '私信',
        chat: '聊天',
        rewards: '打赏、抽奖与精华',
        system: '徽章与其他系统通知'
      }
    },
    window: {
      title: '窗口与启动',
      closeToTray: '关闭窗口时最小化到托盘',
      closeToTrayHint: '关闭后仍在后台接收通知，可从托盘图标重新打开',
      launchAtLogin: '开机自动启动',
      launchAtLoginHint: '启动后停留在托盘',
      devOnly: '仅安装版可用'
    },
    account: {
      title: '账户',
      signedInAs: '已登录为 {{username}}',
      signedOut: '尚未登录',
      sitePreferences: '在网站上管理账户偏好',
      signOut: '退出登录',
      signIn: '登录'
    },
    about: {
      title: '关于',
      version: '版本 {{version}}',
      website: '访问 NodeLoc 网站',
      checkForUpdates: '检查更新',
      downloadProgress: '更新下载进度 {{progress}}%',
      updateStatus: {
        idle: '打开应用时会自动检查更新',
        checking: '正在检查更新…',
        upToDate: '当前已是最新版本',
        downloading: '正在下载 {{version}}（{{progress}}%）',
        installing: '正在安装 {{version}}，NodeLoc 将自动重启…',
        unavailable: '开发版本不检查更新'
      },
      updateErrors: {
        network: '检查更新失败，请稍后重试',
        invalidRelease: '更新信息无效',
        download: '更新下载失败，请稍后重试',
        verification: '更新文件校验失败，已停止安装',
        installer: '无法启动更新安装程序'
      }
    },
    saved: '设置已保存'
  },
  en: {
    title: 'Settings',
    appearance: {
      title: 'Appearance',
      language: 'Language',
      languages: {
        system: 'System',
        'zh-CN': '中文',
        en: 'English'
      },
      theme: 'Theme',
      readingMode: 'Topic list reading mode'
    },
    notifications: {
      title: 'Desktop notifications',
      intro: 'While the app runs (including in the tray), Windows notifications keep you posted. Nothing pops up while the window is in front.',
      enabled: 'Enable desktop notifications',
      sound: 'Play a sound',
      categories: {
        replies: 'Replies and mentions',
        likes: 'Likes, reactions and boosts',
        messages: 'Private messages',
        chat: 'Chat',
        rewards: 'Tips, lotteries and featured topics',
        system: 'Badges and other system notices'
      }
    },
    window: {
      title: 'Window and startup',
      closeToTray: 'Minimize to tray when closing the window',
      closeToTrayHint: 'Keeps notifications coming; reopen from the tray icon',
      launchAtLogin: 'Launch at login',
      launchAtLoginHint: 'Starts in the tray',
      devOnly: 'Installed builds only'
    },
    account: {
      title: 'Account',
      signedInAs: 'Signed in as {{username}}',
      signedOut: 'Not signed in',
      sitePreferences: 'Manage account preferences on the website',
      signOut: 'Sign out',
      signIn: 'Sign in'
    },
    about: {
      title: 'About',
      version: 'Version {{version}}',
      website: 'Visit NodeLoc',
      checkForUpdates: 'Check for updates',
      downloadProgress: 'Update download progress: {{progress}}%',
      updateStatus: {
        idle: 'Updates are checked automatically when NodeLoc opens',
        checking: 'Checking for updates…',
        upToDate: 'You are up to date',
        downloading: 'Downloading {{version}} ({{progress}}%)',
        installing: 'Installing {{version}}. NodeLoc will restart…',
        unavailable: 'Updates are disabled in development builds'
      },
      updateErrors: {
        network: 'Could not check for updates. Try again later.',
        invalidRelease: 'The update information is invalid',
        download: 'Could not download the update. Try again later.',
        verification: 'The update failed verification and was not installed',
        installer: 'Could not start the update installer'
      }
    },
    saved: 'Settings saved'
  }
})
