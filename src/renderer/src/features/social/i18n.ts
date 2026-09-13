import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    newTopic: '发布新话题',
    recentlyVisited: '最近访问',
    recentEmpty: '还没有访问过节点',
    customFeeds: '自定义 Feed',
    customFeedsEmpty: '还没有自定义 Feed',
    privateFeed: '私有 Feed',
    feedNodes: '{{value}} 个节点',
    loadFailed: '加载失败',
    recommended: '推荐',
    membership: {
      joined: '已加入 {{name}}',
      left: '已退出 {{name}}',
      requestSent: '申请已提交，请等待节点管理员审核',
      alreadyRequested: '你已经提交过申请，请耐心等待审核'
    }
  },
  en: {
    newTopic: 'New topic',
    recentlyVisited: 'Recently visited',
    recentEmpty: 'No nodes visited yet',
    customFeeds: 'Custom feeds',
    customFeedsEmpty: 'No custom feeds yet',
    privateFeed: 'Private feed',
    feedNodes: '{{value}} nodes',
    loadFailed: 'Couldn’t load',
    recommended: 'Picks',
    membership: {
      joined: 'Joined {{name}}',
      left: 'Left {{name}}',
      requestSent: 'Request sent. A node moderator will review it',
      alreadyRequested: 'You’ve already asked to join. Hang tight'
    }
  }
})
