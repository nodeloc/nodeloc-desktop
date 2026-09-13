import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    help: {
      title: '键盘快捷键',
      hint: '光标在输入框或编辑器中时，单键快捷键不生效。',
      then: '然后',
      groups: {
        general: '通用',
        navigation: '跳转',
        reading: '阅读'
      }
    },
    keys: {
      quickSwitcher: '快速切换器',
      search: '聚焦搜索框',
      searchSite: '全站搜索',
      newTopic: '发布新话题',
      settings: '设置',
      help: '显示快捷键列表',
      goHome: '前往首页',
      goInbox: '前往收件箱',
      goChat: '前往聊天',
      next: '下一个话题或楼层',
      previous: '上一个话题或楼层',
      open: '打开选中的话题',
      reply: '回复当前话题（或选中的楼层）'
    },
    switcher: {
      label: '快速切换',
      placeholder: '跳转到节点、话题、聊天频道或页面…',
      empty: '没有匹配的结果',
      searchFor: '搜索“{{query}}”',
      directMessage: '私聊',
      section: '分区',
      groups: {
        pages: '页面',
        topics: '最近浏览的话题',
        joined: '已加入的节点',
        recentNodes: '最近访问的节点',
        channels: '聊天频道',
        feeds: '自定义 Feed',
        nodes: '节点',
        search: '搜索'
      },
      pages: {
        home: '首页',
        inbox: '收件箱',
        messages: '私信',
        chat: '聊天',
        nodes: '浏览节点',
        apps: '应用',
        search: '搜索',
        settings: '设置'
      },
      footer: {
        navigate: '选择',
        open: '打开',
        close: '关闭'
      }
    }
  },
  en: {
    help: {
      title: 'Keyboard shortcuts',
      hint: 'Single-key shortcuts are off while typing in a field or editor.',
      then: 'then',
      groups: {
        general: 'General',
        navigation: 'Go to',
        reading: 'Reading'
      }
    },
    keys: {
      quickSwitcher: 'Quick switcher',
      search: 'Focus search',
      searchSite: 'Search the site',
      newTopic: 'New topic',
      settings: 'Settings',
      help: 'Show shortcuts',
      goHome: 'Go home',
      goInbox: 'Go to inbox',
      goChat: 'Go to chat',
      next: 'Next topic or post',
      previous: 'Previous topic or post',
      open: 'Open selected topic',
      reply: 'Reply to the topic (or selected post)'
    },
    switcher: {
      label: 'Quick switcher',
      placeholder: 'Jump to a node, topic, channel or page…',
      empty: 'Nothing matches',
      searchFor: 'Search for “{{query}}”',
      directMessage: 'Direct message',
      section: 'Section',
      groups: {
        pages: 'Pages',
        topics: 'Recent topics',
        joined: 'Joined nodes',
        recentNodes: 'Recently visited nodes',
        channels: 'Chat channels',
        feeds: 'Custom feeds',
        nodes: 'Nodes',
        search: 'Search'
      },
      pages: {
        home: 'Home',
        inbox: 'Inbox',
        messages: 'Messages',
        chat: 'Chat',
        nodes: 'Browse nodes',
        apps: 'Apps',
        search: 'Search',
        settings: 'Settings'
      },
      footer: {
        navigate: 'Select',
        open: 'Open',
        close: 'Close'
      }
    }
  }
})
