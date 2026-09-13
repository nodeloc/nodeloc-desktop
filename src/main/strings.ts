import type { AppLanguage, LanguagePreference } from '@shared/bridge'

interface MainStrings {
  appName: string
  miniApp: string
  trayOpen: string
  trayQuit: string
  trayUnread: (count: number) => string
  unreadOverlay: (count: number) => string
  browser: {
    navigation: string
    back: string
    forward: string
    reload: string
    openExternal: string
    copyLink: string
    close: string
    view: string
    zoomIn: string
    zoomOut: string
    actualSize: string
  }
  notification: {
    mentioned: (user: string) => string
    replied: (user: string) => string
    quoted: (user: string) => string
    liked: (user: string) => string
    privateMessage: (user: string) => string
    invitedToMessage: (user: string) => string
    posted: (user: string) => string
    groupMentioned: (user: string) => string
    watchingFirstPost: (user: string) => string
    chatMention: (user: string) => string
    chatMessage: (user: string) => string
    boost: (user: string) => string
    reward: (user: string) => string
    featured: string
    lottery: string
    badge: string
    generic: (user: string) => string
  }
}

const zhCN: MainStrings = {
  appName: 'NodeLoc',
  miniApp: 'NodeLoc 小程序',
  trayOpen: '打开 NodeLoc',
  trayQuit: '退出',
  trayUnread: (count) => `NodeLoc · ${count} 条未读`,
  unreadOverlay: (count) => `${count} 条未读通知`,
  browser: {
    navigation: '导航', back: '后退', forward: '前进', reload: '刷新', openExternal: '在系统浏览器中打开',
    copyLink: '复制链接', close: '关闭', view: '视图', zoomIn: '放大', zoomOut: '缩小', actualSize: '实际大小'
  },
  notification: {
    mentioned: (user) => `${user} 提到了你`, replied: (user) => `${user} 回复了你`, quoted: (user) => `${user} 引用了你的帖子`,
    liked: (user) => `${user} 赞了你的帖子`, privateMessage: (user) => `${user} 给你发了私信`, invitedToMessage: (user) => `${user} 邀请你加入私信`,
    posted: (user) => `${user} 发布了新回复`, groupMentioned: (user) => `${user} 在群组中提到了你`, watchingFirstPost: (user) => `${user} 发布了新话题`,
    chatMention: (user) => `${user} 在聊天中提到了你`, chatMessage: (user) => `${user} 发来聊天消息`, boost: (user) => `${user} 助力了你的帖子`,
    reward: (user) => `${user} 打赏了你`, featured: '你的话题被设为精华', lottery: '抽奖结果揭晓', badge: '你获得了新徽章',
    generic: (user) => (user ? `${user} 有新动态` : 'NodeLoc 新通知')
  }
}

const en: MainStrings = {
  appName: 'NodeLoc',
  miniApp: 'NodeLoc app',
  trayOpen: 'Open NodeLoc',
  trayQuit: 'Quit',
  trayUnread: (count) => `NodeLoc · ${count} unread`,
  unreadOverlay: (count) => `${count} unread notifications`,
  browser: {
    navigation: 'Navigation', back: 'Back', forward: 'Forward', reload: 'Reload', openExternal: 'Open in system browser',
    copyLink: 'Copy link', close: 'Close', view: 'View', zoomIn: 'Zoom in', zoomOut: 'Zoom out', actualSize: 'Actual size'
  },
  notification: {
    mentioned: (user) => `${user} mentioned you`, replied: (user) => `${user} replied to you`, quoted: (user) => `${user} quoted your post`,
    liked: (user) => `${user} liked your post`, privateMessage: (user) => `${user} sent you a private message`, invitedToMessage: (user) => `${user} invited you to a private message`,
    posted: (user) => `${user} posted a new reply`, groupMentioned: (user) => `${user} mentioned your group`, watchingFirstPost: (user) => `${user} posted a new topic`,
    chatMention: (user) => `${user} mentioned you in chat`, chatMessage: (user) => `${user} sent a chat message`, boost: (user) => `${user} boosted your post`,
    reward: (user) => `${user} sent you a reward`, featured: 'Your topic was featured', lottery: 'Lottery results are ready', badge: 'You earned a new badge',
    generic: (user) => (user ? `${user} has a new update` : 'New NodeLoc notification')
  }
}

export let strings: MainStrings = zhCN

export function setMainLanguage(preference: LanguagePreference, systemLocale: string): AppLanguage {
  const language: AppLanguage = preference === 'system' ? (systemLocale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en') : preference
  strings = language === 'zh-CN' ? zhCN : en
  return language
}
