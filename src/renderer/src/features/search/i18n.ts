import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    title: '搜索',
    placeholder: '搜索帖子、节点、用户和应用',
    clear: '清除',
    scopeLabel: '搜索范围',
    tooShort: '至少输入 2 个字才能搜索',
    rateLimitedHint: '搜索有频率限制，稍等几秒再试',
    scopes: {
      all: '全部',
      nodes: '节点',
      topics: '帖子',
      users: '用户',
      apps: '应用',
      media: '媒体'
    },
    history: {
      title: '最近搜索',
      clear: '清空',
      remove: '删除“{{query}}”',
      empty: '输入至少 2 个字开始搜索'
    },
    filters: {
      toggle: '高级筛选',
      reset: '重置',
      syntax: '搜索语法',
      node: '节点',
      anyNode: '全部节点',
      tags: '标签',
      tagsPlaceholder: '多个标签用逗号分隔',
      author: '作者',
      authorPlaceholder: '用户名',
      after: '起始日期',
      before: '截止日期',
      status: '状态',
      order: '排序',
      statuses: {
        any: '不限',
        open: '未关闭',
        closed: '已关闭',
        archived: '已归档',
        noreplies: '无人回复'
      },
      orders: {
        relevance: '相关度',
        latest: '最新发布',
        likes: '最多点赞',
        views: '最多浏览',
        latest_topic: '最新话题'
      }
    },
    results: {
      header: '“{{term}}” 的搜索结果',
      count: '{{value}} 条',
      countMore: '{{value}}+ 条',
      viewAll: '查看全部',
      loadMore: '加载更多',
      loadMoreFailed: '加载更多失败',
      end: '没有更多了',
      empty: '没有找到相关内容',
      emptyHint: '换个关键词或调整筛选条件试试',
      floor: '{{value}} 楼',
      likes: '{{value}} 个赞',
      topics: '{{value}} 个话题',
      installs: '{{value}} 次安装'
    },
    appKinds: {
      game: '游戏',
      applet: '小程序',
      bot: '机器人'
    }
  },
  en: {
    title: 'Search',
    placeholder: 'Search posts, nodes, users and apps',
    clear: 'Clear',
    scopeLabel: 'Search scope',
    tooShort: 'Type at least 2 characters to search',
    rateLimitedHint: 'Search is rate limited. Wait a few seconds and try again.',
    scopes: {
      all: 'All',
      nodes: 'Nodes',
      topics: 'Posts',
      users: 'Users',
      apps: 'Apps',
      media: 'Media'
    },
    history: {
      title: 'Recent searches',
      clear: 'Clear',
      remove: 'Remove "{{query}}"',
      empty: 'Type at least 2 characters to start searching'
    },
    filters: {
      toggle: 'Advanced filters',
      reset: 'Reset',
      syntax: 'Search syntax',
      node: 'Node',
      anyNode: 'All nodes',
      tags: 'Tags',
      tagsPlaceholder: 'Separate tags with commas',
      author: 'Author',
      authorPlaceholder: 'Username',
      after: 'From',
      before: 'Until',
      status: 'Status',
      order: 'Sort by',
      statuses: {
        any: 'Any',
        open: 'Open',
        closed: 'Closed',
        archived: 'Archived',
        noreplies: 'No replies'
      },
      orders: {
        relevance: 'Relevance',
        latest: 'Latest post',
        likes: 'Most liked',
        views: 'Most viewed',
        latest_topic: 'Latest topic'
      }
    },
    results: {
      header: 'Results for "{{term}}"',
      count: '{{value}} found',
      countMore: '{{value}}+ found',
      viewAll: 'View all',
      loadMore: 'Load more',
      loadMoreFailed: 'Couldn’t load more',
      end: 'No more results',
      empty: 'Nothing found',
      emptyHint: 'Try other keywords or adjust the filters',
      floor: 'Reply #{{value}}',
      likes: '{{value}} likes',
      topics: '{{value}} topics',
      installs: '{{value}} installs'
    },
    appKinds: {
      game: 'Game',
      applet: 'Applet',
      bot: 'Bot'
    }
  }
})
