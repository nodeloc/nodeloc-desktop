import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    title: '节点',
    join: '加入',
    joined: '已加入',
    leave: '退出',
    creatorCannotLeave: '你是节点创建者，不能退出',
    requestJoin: '申请加入',
    requested: '已申请',
    requestedHint: '申请已提交，等待节点管理员审核',
    request: {
      title: '申请加入 {{name}}',
      intro: '这是一个私有节点，加入需要节点管理员审核。',
      reasonLabel: '申请理由',
      reasonPlaceholder: '简单介绍一下自己，以及想加入的原因',
      submit: '提交申请'
    },
    notifications: '通知',
    notificationLevels: {
      current: '通知级别：{{level}}',
      watching: { label: '关注', description: '每个新话题和新回复都会通知你' },
      tracking: { label: '跟踪', description: '显示新回复数；有人 @ 你或回复你时通知' },
      watchingFirstPost: { label: '关注第一帖', description: '有新话题时通知你，回复不通知' },
      regular: { label: '常规', description: '只在有人 @ 你或回复你时通知' },
      muted: { label: '静音', description: '不接收任何通知，话题也不出现在最新列表' }
    },
    postInNode: '在此节点发帖',
    verified: '已认证节点',
    official: '官方',
    members: '{{value}} 成员',
    topics: '{{value}} 主题',
    noDescription: '这个节点还没有简介',
    expand: '展开',
    collapse: '收起',
    searchInNode: '在节点内搜索',
    emptyTopics: '这个节点还没有话题',
    loadMore: '加载更多',
    loadMoreFailed: '加载更多失败',
    browse: {
      subtitle: '发现感兴趣的节点，看看大家在聊什么',
      recommended: '推荐节点',
      empty: '暂时还没有推荐节点',
      viewAll: '查看全部 {{value}} 个节点',
      sectionEmpty: '这个分区还没有节点'
    },
    group: {
      back: '返回浏览节点',
      total: '共 {{value}} 个节点',
      empty: '这个分区还没有节点'
    },
    sidebar: {
      views: '视图'
    },
    about: {
      title: '关于节点',
      members: '成员',
      topics: '主题',
      posts: '帖子',
      created: '创建于 {{date}}',
      owner: '创建者',
      rules: '版规',
      moderators: '版主',
      bot: '机器人'
    }
  },
  en: {
    title: 'Nodes',
    join: 'Join',
    joined: 'Joined',
    leave: 'Leave',
    creatorCannotLeave: 'You created this node, so you can’t leave it',
    requestJoin: 'Request to join',
    requested: 'Requested',
    requestedHint: 'Request sent. Waiting for a node moderator',
    request: {
      title: 'Request to join {{name}}',
      intro: 'This node is private. A node moderator reviews each request.',
      reasonLabel: 'Why do you want to join?',
      reasonPlaceholder: 'Say a little about yourself and why you’d like to join',
      submit: 'Send request'
    },
    notifications: 'Notifications',
    notificationLevels: {
      current: 'Notifications: {{level}}',
      watching: { label: 'Watching', description: 'Get notified about every new topic and reply' },
      tracking: { label: 'Tracking', description: 'Show new reply counts; notify on mentions and replies to you' },
      watchingFirstPost: { label: 'Watching first post', description: 'Get notified about new topics, not replies' },
      regular: { label: 'Normal', description: 'Notify only when someone mentions or replies to you' },
      muted: { label: 'Muted', description: 'Never notify, and hide its topics from Latest' }
    },
    postInNode: 'Post in this node',
    verified: 'Verified node',
    official: 'Official',
    members: '{{value}} members',
    topics: '{{value}} topics',
    noDescription: 'No description yet',
    expand: 'Show more',
    collapse: 'Show less',
    searchInNode: 'Search this node',
    emptyTopics: 'No topics in this node yet',
    loadMore: 'Load more',
    loadMoreFailed: 'Couldn’t load more',
    browse: {
      subtitle: 'Find nodes you care about and see what people are talking about',
      recommended: 'Recommended',
      empty: 'No recommended nodes yet',
      viewAll: 'View all {{value}} nodes',
      sectionEmpty: 'No nodes in this section yet'
    },
    group: {
      back: 'Back to browse',
      total: '{{value}} nodes',
      empty: 'No nodes in this section yet'
    },
    sidebar: {
      views: 'Views'
    },
    about: {
      title: 'About',
      members: 'Members',
      topics: 'Topics',
      posts: 'Posts',
      created: 'Created {{date}}',
      owner: 'Owner',
      rules: 'Rules',
      moderators: 'Moderators',
      bot: 'Bot'
    }
  }
})
