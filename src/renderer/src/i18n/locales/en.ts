import type { Messages } from './zh-CN'

const en: Messages = {
  nav: {
    home: 'Home',
    back: 'Back',
    forward: 'Forward',
    gallery: 'Design system',
    nodes: 'Nodes',
    browseNodes: 'Browse nodes',
    search: 'Search',
    searchPlaceholder: 'Search NodeLoc (Ctrl+Shift+F)',
    inbox: 'Inbox',
    chat: 'Chat',
    resizeSidebar: 'Resize the second and third columns',
    resizeTopicColumns: 'Resize the topic list and detail columns'
  },
  feed: {
    feeds: 'Feeds',
    personal: 'Mine',
    filters: {
      latest: 'Latest',
      joined: 'Joined',
      hot: 'Hot',
      new: 'New',
      top: 'Top',
      featured: 'Featured',
      unread: 'Unread',
      bookmarks: 'Bookmarks'
    },
    period: {
      label: 'Period',
      daily: 'Today',
      weekly: 'This week',
      monthly: 'This month',
      quarterly: 'This quarter',
      yearly: 'This year',
      all: 'All time'
    },
    readingMode: {
      label: 'Reading mode',
      compact: 'Compact',
      expanded: 'Expanded',
      card: 'Card'
    },
    latest: 'Latest',
    refresh: 'Refresh',
    pinned: 'Pinned',
    featured: 'Featured',
    replies: '{{count}} replies',
    views: '{{count}} views',
    empty: 'No topics yet',
    emptyUnread: 'No unread topics',
    emptyTag: 'No topics with this tag yet',
    signInRequired: 'Sign in to see this',
    end: 'You’re all caught up',
    loadMoreFailed: 'Couldn’t load more',
    openInBrowser: 'Open in browser',
    previousImage: 'Previous image',
    nextImage: 'Next image'
  },
  vote: {
    up: 'Upvote',
    down: 'Downvote',
    vote: 'Vote',
    signInToVote: 'Sign in to vote',
    cannotDownvote: 'Your group can’t downvote yet'
  },
  lottery: {
    open: 'Lottery open',
    drawn: 'Drawn',
    closed: 'Lottery closed'
  },
  sidebar: {
    guest: 'Guest',
    guestHint: 'Browsing as a guest',
    theme: 'Appearance',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark'
  },
  recentTopics: {
    title: 'Recently viewed',
    clear: 'Clear',
    empty: 'Topics you open will show up here'
  },
  topicStats: {
    likes: '{{count}} likes',
    replies: '{{count}} replies',
    newReplies: '{{count}} new'
  },
  common: {
    retry: 'Retry',
    cancel: 'Cancel',
    confirm: 'OK',
    save: 'Save',
    loading: 'Loading',
    notFound: 'Page not found',
    comingSoon: 'Coming soon',
    close: 'Close',
    copyLink: 'Copy link',
    copied: 'Copied',
    openInBrowser: 'Open in browser',
    showMore: 'Show more',
    showLess: 'Show less'
  },
  errors: {
    unauthorized: 'Your session has expired. Please sign in again.',
    forbidden: 'You don’t have permission to do that.',
    notFound: 'This content doesn’t exist or was deleted.',
    conflict: 'This was changed elsewhere. Refresh and try again.',
    invalidRequest: 'Invalid request. Check and try again.',
    unprocessable: 'That didn’t work. Check and try again.',
    tooLarge: 'The file is too large.',
    rateLimited: 'You’re doing that too often. Try again shortly.',
    server: 'The server is having trouble. Try again shortly.',
    challenged: 'The site’s security check blocked this request. Try again shortly.',
    offline: 'No network connection.',
    timeout: 'The connection timed out. Try again.',
    decode: 'Something went wrong loading this. Try again.',
    unknown: 'Something went wrong. Try again.',
    viewCrashed: 'Something went wrong on this page'
  }
}

export default en
