import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    signIn: '登录',
    signInTitle: '登录 NodeLoc',
    signInIntro: '将在浏览器中打开 NodeLoc 的授权页面。登录并同意授权后，浏览器会自动回到应用。',
    signInPrivacy: '应用只保存授权密钥（加密存储在本机），不会接触你的密码。',
    openBrowser: '在浏览器中登录',
    waitingTitle: '请在浏览器中完成授权',
    waitingIntro: '已在浏览器中打开授权页面。完成登录并点击“授权”后，这里会自动完成。',
    reopenBrowser: '重新打开浏览器',
    cancel: '取消登录',
    pasteHint: '浏览器没有自动返回应用？把地址栏或提示中以 nodeloc://auth_redirect 开头的链接粘贴到这里：',
    pastePlaceholder: 'nodeloc://auth_redirect?payload=…',
    complete: '完成登录',
    devProtocolHint: '开发版默认不注册 nodeloc:// 协议；需要以 NODELOC_REGISTER_PROTOCOL=1 启动，或使用下方的粘贴方式。',
    signedIn: '已登录为 {{username}}',
    expiredTitle: '登录已过期',
    expiredIntro: '授权已失效或被撤销，请重新登录。',
    signInAgain: '重新登录',
    signOut: '退出登录',
    signOutConfirmTitle: '退出登录？',
    signOutConfirm: '将在服务器上撤销本机的授权密钥。',
    signedOut: '已退出登录',
    myProfile: '我的主页',
    menu: '账户菜单',
    energy: '{{value}} 能量',
    waiting: '等待浏览器授权…',
    errors: {
      noPending: '没有正在进行的登录，请重新点击“在浏览器中登录”',
      invalidCallback: '回调链接无效，请确认复制了完整链接',
      nonceMismatch: '回调与当前登录请求不匹配，请重新发起登录',
      rejected: '授权密钥无效，请重新登录',
      network: '无法连接 NodeLoc，请检查网络后重试'
    },
    checkin: {
      action: '签到',
      done: '已签到',
      success: '签到成功，获得 {{points}} 能量',
      already: '今天已经签到过了',
      failed: '签到失败：{{message}}'
    },
    signInRequired: '登录后才能进行此操作'
  },
  en: {
    signIn: 'Sign in',
    signInTitle: 'Sign in to NodeLoc',
    signInIntro: 'NodeLoc’s authorization page opens in your browser. After you sign in and approve, the browser returns to the app.',
    signInPrivacy: 'The app stores only the authorization key (encrypted on this device) and never sees your password.',
    openBrowser: 'Sign in with browser',
    waitingTitle: 'Finish authorizing in your browser',
    waitingIntro: 'The authorization page is open in your browser. Once you sign in and approve, this completes automatically.',
    reopenBrowser: 'Open browser again',
    cancel: 'Cancel sign-in',
    pasteHint: 'Browser didn’t return to the app? Paste the link starting with nodeloc://auth_redirect here:',
    pastePlaceholder: 'nodeloc://auth_redirect?payload=…',
    complete: 'Finish sign-in',
    devProtocolHint: 'Development builds don’t register nodeloc:// by default; start with NODELOC_REGISTER_PROTOCOL=1 or paste the link below.',
    signedIn: 'Signed in as {{username}}',
    expiredTitle: 'Session expired',
    expiredIntro: 'The authorization was revoked or expired. Please sign in again.',
    signInAgain: 'Sign in again',
    signOut: 'Sign out',
    signOutConfirmTitle: 'Sign out?',
    signOutConfirm: 'This revokes this device’s key on the server.',
    signedOut: 'Signed out',
    myProfile: 'My profile',
    menu: 'Account menu',
    energy: '{{value}} energy',
    waiting: 'Waiting for browser…',
    errors: {
      noPending: 'No sign-in in progress. Start again with “Sign in with browser”.',
      invalidCallback: 'That link isn’t valid. Make sure you copied all of it.',
      nonceMismatch: 'That link belongs to a different sign-in attempt. Start again.',
      rejected: 'The authorization key was rejected. Please sign in again.',
      network: 'Couldn’t reach NodeLoc. Check your connection and try again.'
    },
    checkin: {
      action: 'Check in',
      done: 'Checked in',
      success: 'Checked in: +{{points}} energy',
      already: 'Already checked in today',
      failed: 'Check-in failed: {{message}}'
    },
    signInRequired: 'Sign in to do this'
  }
})
