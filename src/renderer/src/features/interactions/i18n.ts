import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    vote: {
      pickUp: '选择一个赞的表情',
      pickDown: '选择一个踩的表情',
      downvoteLimit: '今天的踩已用完，明天再来'
    },
    reactions: {
      open: '{{count}} 人回应，点击查看详情',
      title: '{{count}} 人回应',
      filter: '按表情筛选',
      all: '全部',
      loadMore: '加载更多',
      loadFailed: '回应详情加载失败',
      empty: '暂无回应'
    },
    bookmark: {
      add: '收藏',
      remove: '取消收藏',
      added: '已保存书签',
      removed: '已取消书签'
    },
    reward: {
      action: '打赏',
      title: '打赏 {{username}}',
      amount: '打赏金额',
      custom: '自定义金额',
      note: '留言（可选）',
      notePlaceholder: '说点什么…',
      balance: '当前能量 {{value}}',
      submit: '打赏 {{amount}} 能量',
      success: '已打赏 {{username}} {{amount}} 能量'
    },
    quote: '引用回复',
    more: '更多',
    lottery: {
      quantity: '购买票数',
      random: '随机票数',
      joined: '参与成功，你现在有 {{count}} 张票',
      signIn: '登录后参与抽奖'
    },
    poll: {
      voted: '投票成功',
      removed: '已撤销投票',
      submit: '提交投票'
    },
    manage: {
      edit: '编辑',
      history: '修订历史',
      delete: '删除',
      recover: '恢复',
      deleteTitle: '删除这条回复？',
      deleteMessage: '删除后仍可在一段时间内恢复。',
      deleteConfirm: '删除',
      deleted: '已删除',
      recovered: '已恢复'
    },
    revisions: {
      title: '修订历史',
      first: '最早的修订',
      previous: '上一次修订',
      next: '下一次修订',
      last: '最新的修订',
      position: '第 {{from}} 版 → 第 {{to}} 版 · 共 {{total}} 版',
      view: '差异显示方式',
      inline: '渲染',
      markdown: 'Markdown',
      editedBy: '{{username}} 编辑于 {{time}}',
      reason: '编辑原因：{{reason}}',
      titleLabel: '标题',
      node: '节点',
      tags: '标签',
      body: '正文',
      none: '无',
      hidden: '这次修订已被隐藏',
      tooComplex: '改动过大，无法显示差异'
    },
    flag: {
      action: '举报',
      topicAction: '举报话题',
      title: '举报帖子',
      topicTitle: '举报话题',
      type: '举报类型',
      message: '说明',
      messagePlaceholder: '说明具体的问题，帮助版主判断…',
      flagged: '已举报',
      submit: '提交举报',
      success: '举报已提交，感谢反馈',
      noTypes: '你暂时无法举报这个帖子'
    },
    boost: {
      action: '助力',
      placeholder: '给 @{{username}} 助力…',
      submit: '发送助力',
      remove: '删除助力',
      by: '@{{username}} 的助力',
      limit: '最多 {{length}} 个字、{{emoji}} 个表情',
      added: '已助力'
    },
    pay: {
      unlock: '支付解锁',
      title: '解锁付费内容',
      energy: '能量',
      summary: '支付后即可查看这段内容，能量扣除手续费后归 @{{username}} 所有。',
      balance: '当前能量 {{value}}',
      insufficient: '能量可能不足',
      confirm: '支付 {{amount}} 能量',
      success: '已解锁',
      alreadyPaid: '你已经购买过这段内容'
    },
    feature: {
      feature: '设为精华',
      unfeature: '取消精华',
      featureTitle: '设为精华话题',
      unfeatureTitle: '取消精华',
      featureDescription: '话题会显示精华标识，并出现在精华列表中。',
      unfeatureDescription: '话题将不再显示精华标识，设为精华时发放的奖励会被收回。',
      bonus: '奖励作者的能量（由系统发放）',
      bonusOwn: '奖励作者的能量（从你的能量中支付）',
      featured: '已设为精华',
      featuredWithPoints: '已设为精华，奖励作者 {{points}} 能量',
      unfeatured: '已取消精华'
    }
  },
  en: {
    vote: {
      pickUp: 'Pick an upvote reaction',
      pickDown: 'Pick a downvote reaction',
      downvoteLimit: 'You’ve used today’s downvotes'
    },
    reactions: {
      open: '{{count}} reactions — view details',
      title: '{{count}} reactions',
      filter: 'Filter by reaction',
      all: 'All',
      loadMore: 'Load more',
      loadFailed: 'Could not load reactions',
      empty: 'No reactions'
    },
    bookmark: {
      add: 'Bookmark',
      remove: 'Remove bookmark',
      added: 'Bookmarked',
      removed: 'Bookmark removed'
    },
    reward: {
      action: 'Tip',
      title: 'Tip {{username}}',
      amount: 'Amount',
      custom: 'Custom amount',
      note: 'Note (optional)',
      notePlaceholder: 'Say something…',
      balance: 'Balance: {{value}} energy',
      submit: 'Tip {{amount}} energy',
      success: 'Tipped {{username}} {{amount}} energy'
    },
    quote: 'Quote',
    more: 'More',
    lottery: {
      quantity: 'Tickets',
      random: 'Random amount',
      joined: 'Joined — you now hold {{count}} tickets',
      signIn: 'Sign in to join'
    },
    poll: {
      voted: 'Vote recorded',
      removed: 'Vote removed',
      submit: 'Submit vote'
    },
    manage: {
      edit: 'Edit',
      history: 'Edit history',
      delete: 'Delete',
      recover: 'Recover',
      deleteTitle: 'Delete this reply?',
      deleteMessage: 'You can still recover it for a while afterwards.',
      deleteConfirm: 'Delete',
      deleted: 'Deleted',
      recovered: 'Recovered'
    },
    revisions: {
      title: 'Edit history',
      first: 'First revision',
      previous: 'Previous revision',
      next: 'Next revision',
      last: 'Latest revision',
      position: 'Version {{from}} → {{to}} of {{total}}',
      view: 'Diff view',
      inline: 'Rendered',
      markdown: 'Markdown',
      editedBy: 'Edited by {{username}} {{time}}',
      reason: 'Reason: {{reason}}',
      titleLabel: 'Title',
      node: 'Node',
      tags: 'Tags',
      body: 'Post',
      none: 'None',
      hidden: 'This revision is hidden',
      tooComplex: 'This change is too large to show as a diff'
    },
    flag: {
      action: 'Flag',
      topicAction: 'Flag topic',
      title: 'Flag post',
      topicTitle: 'Flag topic',
      type: 'Reason',
      message: 'Details',
      messagePlaceholder: 'Describe the problem so moderators can act on it…',
      flagged: 'Flagged',
      submit: 'Submit flag',
      success: 'Flag submitted — thanks',
      noTypes: 'You can’t flag this post right now'
    },
    boost: {
      action: 'Boost',
      placeholder: 'Boost @{{username}}…',
      submit: 'Send boost',
      remove: 'Remove boost',
      by: 'Boost from @{{username}}',
      limit: 'Up to {{length}} characters and {{emoji}} emoji',
      added: 'Boosted'
    },
    pay: {
      unlock: 'Unlock',
      title: 'Unlock paid content',
      energy: 'energy',
      summary: 'Pay to see this content. @{{username}} receives the energy after a fee.',
      balance: 'Balance: {{value}} energy',
      insufficient: 'You may not have enough energy',
      confirm: 'Pay {{amount}} energy',
      success: 'Unlocked',
      alreadyPaid: 'You already bought this content'
    },
    feature: {
      feature: 'Feature topic',
      unfeature: 'Unfeature topic',
      featureTitle: 'Feature this topic',
      unfeatureTitle: 'Unfeature this topic',
      featureDescription: 'The topic gets the featured badge and appears in the featured list.',
      unfeatureDescription: 'The topic loses its featured badge, and any bonus paid for featuring it is taken back.',
      bonus: 'Bonus energy for the author (issued by the system)',
      bonusOwn: 'Bonus energy for the author (paid from your balance)',
      featured: 'Topic featured',
      featuredWithPoints: 'Topic featured; the author received {{points}} energy',
      unfeatured: 'Topic unfeatured'
    }
  }
})
