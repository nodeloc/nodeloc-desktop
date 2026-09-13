const zhCN = {
  nav: {
    home: '首页',
    back: '后退',
    forward: '前进',
    gallery: '设计系统',
    nodes: '节点',
    browseNodes: '浏览节点',
    search: '搜索',
    searchPlaceholder: '搜索 NodeLoc（Ctrl+Shift+F）',
    inbox: '收件箱',
    chat: '聊天',
    resizeSidebar: '调整第二栏和第三栏宽度',
    resizeTopicColumns: '调整帖子列表和详情栏宽度'
  },
  feed: {
    feeds: '信息流',
    personal: '我的',
    filters: {
      latest: '最新',
      joined: '已加入',
      hot: '热门',
      new: '新话题',
      top: '排行',
      featured: '精华',
      unread: '未读',
      bookmarks: '书签'
    },
    period: {
      label: '时间范围',
      daily: '今日',
      weekly: '本周',
      monthly: '本月',
      quarterly: '本季',
      yearly: '今年',
      all: '全部'
    },
    readingMode: {
      label: '阅读模式',
      compact: '紧凑',
      expanded: '展开',
      card: '卡片'
    },
    latest: '最新',
    refresh: '刷新',
    pinned: '置顶',
    featured: '精华',
    replies: '{{count}} 条回复',
    views: '{{count}} 次浏览',
    empty: '暂时还没有话题',
    emptyUnread: '没有未读话题',
    emptyTag: '这个标签下还没有话题',
    signInRequired: '登录后才能查看',
    end: '没有更多了',
    loadMoreFailed: '加载更多失败',
    openInBrowser: '在浏览器中打开',
    previousImage: '上一张',
    nextImage: '下一张'
  },
  vote: {
    up: '赞',
    down: '踩',
    vote: '投票',
    signInToVote: '登录后才能投票',
    cannotDownvote: '你所在的用户组暂时不能踩'
  },
  lottery: {
    open: '抽奖中',
    drawn: '已开奖',
    closed: '抽奖已关闭'
  },
  sidebar: {
    guest: '游客',
    guestHint: '正在以游客身份浏览',
    theme: '外观',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色'
  },
  recentTopics: {
    title: '最近浏览',
    clear: '清除',
    empty: '还没有浏览过的话题'
  },
  topicStats: {
    likes: '{{count}} 赞',
    replies: '{{count}} 回复',
    newReplies: '{{count}} 条新回复'
  },
  common: {
    retry: '重试',
    cancel: '取消',
    confirm: '确定',
    save: '保存',
    loading: '正在加载',
    notFound: '页面不存在',
    comingSoon: '即将推出',
    close: '关闭',
    copyLink: '复制链接',
    copied: '已复制',
    openInBrowser: '在浏览器中打开',
    showMore: '显示更多',
    showLess: '收起'
  },
  errors: {
    unauthorized: '登录已失效，请重新登录',
    forbidden: '没有权限执行此操作',
    notFound: '内容不存在或已被删除',
    conflict: '内容已被修改，请刷新后重试',
    invalidRequest: '请求无效，请检查后重试',
    unprocessable: '操作未能完成，请检查后重试',
    tooLarge: '文件太大了',
    rateLimited: '操作太频繁，请稍后再试',
    server: '服务器开小差了，请稍后再试',
    challenged: '请求被站点安全防护拦截，请稍后再试',
    offline: '网络不可用，请检查网络连接',
    timeout: '连接超时，请稍后重试',
    decode: '数据加载出错，请稍后重试',
    unknown: '出了点问题，请稍后再试',
    viewCrashed: '这个页面出了点问题'
  }
}

export type Messages = typeof zhCN
export default zhCN
