import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    title: '个人资料',
    cardTitle: '@{{username}} 的资料',
    viewFullProfile: '查看完整资料',
    moreActions: '更多操作',
    report: '举报',
    screen: {
      action: '屏蔽',
      title: '屏蔽 @{{username}}',
      level: '屏蔽等级',
      save: '保存',
      duration: '忽略时长',
      levels: {
        normal: { label: '正常', description: '正常显示该用户的内容和通知' },
        mute: { label: '静音', description: '不接收该用户触发的通知' },
        ignore: { label: '忽略', description: '隐藏该用户的内容和通知' }
      },
      durations: { day: '1 天', week: '7 天', month: '30 天', forever: '永久' },
      saved: {
        normal: '已取消屏蔽 {{username}}',
        mute: '已静音 {{username}}',
        ignore: '已忽略 {{username}}'
      }
    },
    invite: {
      action: '邀请到节点',
      title: '邀请 @{{username}} 到节点',
      chooseNode: '选择节点',
      noNodes: '没有可邀请用户加入的节点',
      success: '已邀请 {{username}} 加入 {{node}}',
      skipped: {
        already_member: '该用户已经是节点成员',
        banned: '该用户已被该节点封禁',
        self: '不能邀请自己',
        not_found: '用户不存在',
        unknown: '无法邀请该用户加入节点'
      }
    },
    notFound: '用户不存在',
    notFoundDescription: '这个用户可能已改名或被删除',
    backHome: '返回首页',
    hidden: '该用户隐藏了个人资料',
    signInRequired: '登录后才能查看',
    follow: '关注',
    followingState: '已关注',
    unfollow: '取消关注',
    followed: '已关注 {{username}}',
    unfollowed: '已取消关注 {{username}}',
    message: '私信',
    editProfile: '编辑资料',
    admin: '管理员',
    moderator: '版主',
    trustLevels: {
      tl0: '新用户',
      tl1: '基本用户',
      tl2: '成员',
      tl3: '活跃用户',
      tl4: '领导者'
    },
    joined: '{{date}} 加入',
    lastSeen: '最近在线 {{time}}',
    followers: '粉丝',
    following: '关注',
    energy: '能量',
    stats: {
      topics: '主题',
      replies: '回复',
      likesReceived: '获赞',
      likesGiven: '点赞',
      daysVisited: '访问天数',
      readTime: '阅读时长',
      hours: '小时'
    },
    tabs: {
      activity: '动态',
      topics: '主题',
      replies: '回复',
      likes: '赞',
      points: '能量',
      badges: '徽章'
    },
    actions: {
      topic: '发布了主题',
      reply: '回复了',
      like: '赞了 {{username}}'
    },
    empty: {
      activity: '还没有动态',
      topics: '还没有发布主题',
      replies: '还没有回复',
      likes: '还没有点赞',
      points: '还没有能量记录',
      badges: '还没有获得徽章'
    },
    deleted: '已删除',
    loadMore: '加载更多',
    loadMoreFailed: '加载更多失败',
    end: '没有更多了',
    badgeGranted: '{{value}} 人获得',
    badgeTimes: '获得 {{value}} 次',
    side: {
      topNodes: '常去节点',
      nodes: '拥有/管理的节点',
      owner: '拥有',
      moderator: '管理',
      mostLikedBy: '最多赞他的人',
      topicsAndPosts: '{{topics}} 主题 · {{posts}} 回复',
      members: '{{value}} 成员',
      likesFrom: '{{username}} 赞了 {{value}} 次'
    }
  },
  en: {
    title: 'Profile',
    cardTitle: '@{{username}} profile',
    viewFullProfile: 'View full profile',
    moreActions: 'More actions',
    report: 'Report',
    screen: {
      action: 'Block',
      title: 'Block @{{username}}',
      level: 'Block level',
      save: 'Save',
      duration: 'Ignore for',
      levels: {
        normal: { label: 'Normal', description: 'Show this user’s content and notifications normally' },
        mute: { label: 'Mute', description: 'Do not receive notifications triggered by this user' },
        ignore: { label: 'Ignore', description: 'Hide this user’s content and notifications' }
      },
      durations: { day: '1 day', week: '7 days', month: '30 days', forever: 'Forever' },
      saved: {
        normal: 'No longer blocking {{username}}',
        mute: 'Muted {{username}}',
        ignore: 'Ignored {{username}}'
      }
    },
    invite: {
      action: 'Invite to node',
      title: 'Invite @{{username}} to a node',
      chooseNode: 'Choose a node',
      noNodes: 'You have no nodes that can invite this user',
      success: 'Invited {{username}} to {{node}}',
      skipped: {
        already_member: 'This user is already a node member',
        banned: 'This user is banned from this node',
        self: 'You cannot invite yourself',
        not_found: 'User not found',
        unknown: 'Could not invite this user to the node'
      }
    },
    notFound: 'User not found',
    notFoundDescription: 'This user may have been renamed or deleted',
    backHome: 'Back to home',
    hidden: 'This user has hidden their profile',
    signInRequired: 'Sign in to view',
    follow: 'Follow',
    followingState: 'Following',
    unfollow: 'Unfollow',
    followed: 'Following {{username}}',
    unfollowed: 'Unfollowed {{username}}',
    message: 'Message',
    editProfile: 'Edit profile',
    admin: 'Admin',
    moderator: 'Moderator',
    trustLevels: {
      tl0: 'New user',
      tl1: 'Basic user',
      tl2: 'Member',
      tl3: 'Regular',
      tl4: 'Leader'
    },
    joined: 'Joined {{date}}',
    lastSeen: 'Last seen {{time}}',
    followers: 'Followers',
    following: 'Following',
    energy: 'Energy',
    stats: {
      topics: 'Topics',
      replies: 'Replies',
      likesReceived: 'Likes received',
      likesGiven: 'Likes given',
      daysVisited: 'Days visited',
      readTime: 'Read time',
      hours: 'h'
    },
    tabs: {
      activity: 'Activity',
      topics: 'Topics',
      replies: 'Replies',
      likes: 'Likes',
      points: 'Energy',
      badges: 'Badges'
    },
    actions: {
      topic: 'Posted a topic',
      reply: 'Replied',
      like: 'Liked {{username}}'
    },
    empty: {
      activity: 'No activity yet',
      topics: 'No topics yet',
      replies: 'No replies yet',
      likes: 'No likes yet',
      points: 'No energy records yet',
      badges: 'No badges yet'
    },
    deleted: 'Deleted',
    loadMore: 'Load more',
    loadMoreFailed: 'Couldn’t load more',
    end: 'No more',
    badgeGranted: '{{value}} awarded',
    badgeTimes: 'Earned {{value}} times',
    side: {
      topNodes: 'Top nodes',
      nodes: 'Owned & moderated nodes',
      owner: 'Owner',
      moderator: 'Moderator',
      mostLikedBy: 'Most liked by',
      topicsAndPosts: '{{topics}} topics · {{posts}} replies',
      members: '{{value}} members',
      likesFrom: '{{username}} liked {{value}} times'
    }
  }
})
