import { defineMessages } from '../../i18n/define'

export default defineMessages({
  'zh-CN': {
    reply: {
      title: '回复 {{title}}',
      titleUser: '回复 @{{username}}',
      placeholder: '写下你的回复…',
      send: '发送',
      sending: '发送中…',
      sent: '回复已发布',
      minimize: '收起',
      expand: '展开',
      resize: '拖动调整高度，双击恢复'
    },
    topic: {
      title: '发布新主题',
      node: '节点',
      titleLabel: '标题',
      titlePlaceholder: '用一句话说明你的主题',
      bodyPlaceholder: '正文，支持 Markdown',
      publish: '发布',
      publishing: '发布中…',
      published: '主题已发布',
      nodeRequired: '请选择要发布到的节点',
      titleTooShort: '标题至少需要 {{count}} 个字'
    },
    nodePicker: {
      placeholder: '选择节点',
      search: '搜索节点',
      recent: '最近发帖',
      joined: '已加入',
      empty: '没有匹配的节点',
      loading: '正在加载节点…'
    },
    enqueued: '已提交，审核通过后显示',
    enqueuedExtras: '已提交审核。帖子审核通过前无法附加抽奖或红包。',
    emptyBody: '内容不能为空',
    bodyTooLong: '内容不能超过 {{count}} 个字',
    extrasInvalid: '请检查抽奖或红包设置',
    waitUploads: '请等待文件上传完成',
    shortcutCtrlEnter: 'Ctrl+Enter 发送',
    shortcutEnter: 'Enter 发送，Shift+Enter 换行',
    counter: '{{count}} 字',
    counterMax: '{{count}} / {{max}} 字',
    discard: {
      title: '关闭编辑器？',
      body: '内容已作为草稿保存在本机，下次打开时会自动恢复。',
      keep: '保留草稿',
      discard: '丢弃草稿',
      cancel: '继续编辑'
    },
    editor: {
      write: '编辑',
      preview: '预览',
      previewEmpty: '没有可预览的内容',
      previewNote: '预览仅供参考，以发布后的效果为准',
      bold: '粗体（Ctrl+B）',
      italic: '斜体（Ctrl+I）',
      strikethrough: '删除线',
      heading: '标题',
      quote: '引用',
      code: '行内代码',
      codeBlock: '代码块',
      link: '链接（Ctrl+K）',
      bulletList: '无序列表',
      numberedList: '有序列表',
      spoiler: '剧透',
      hidden: '隐藏内容',
      hiddenReply: '回复后可见',
      hiddenLogin: '登录后可见',
      hiddenPay: '付费可见（需站点开启）',
      poll: '插入投票',
      upload: '上传文件',
      dropHint: '松开以上传文件',
      sample: {
        bold: '粗体文字',
        italic: '斜体文字',
        strikethrough: '删除线文字',
        heading: '标题',
        quote: '引用内容',
        code: '代码',
        link: '链接文字',
        list: '列表项',
        spoiler: '剧透内容',
        hidden: '隐藏内容'
      },
      video: '视频：{{name}}',
      audio: '音频：{{name}}',
      pollPreview: '投票'
    },
    upload: {
      placeholder: '[上传中：{{name}}…]',
      uploading: '正在上传',
      queued: '等待上传',
      failed: '上传失败：{{message}}',
      failedToast: '{{name}} 上传失败：{{message}}',
      retry: '重试',
      dismiss: '移除'
    },
    poll: {
      title: '插入投票',
      insert: '插入',
      type: '类型',
      types: {
        regular: '单选',
        multiple: '多选',
        number: '数字评分',
        ranked_choice: '排序投票'
      },
      pollTitle: '投票标题（可选）',
      options: '选项（最多 {{count}} 个）',
      optionsHint: '每行一个选项',
      min: '最少',
      max: '最多',
      maxDefault: '选项数',
      step: '步长',
      results: '结果可见性',
      resultsOptions: {
        always: '始终可见',
        on_vote: '投票后可见',
        on_close: '结束后可见',
        staff_only: '仅管理人员可见'
      },
      chartType: '图表',
      charts: {
        bar: '柱状图',
        pie: '饼图'
      },
      close: '截止时间（可选）',
      public: '公开投票人',
      permissionHint: '创建投票需要达到站点要求的信任等级（默认 1 级）。',
      errors: {
        tooFewOptions: '至少需要 2 个选项',
        tooManyOptions: '最多只能有 {{count}} 个选项',
        duplicate: '选项不能重复',
        minMax: '最少/最多可选数量不合理：最少 ≥ 1、不大于最多，且少于选项数',
        number: '数字范围不合理：最小值 ≥ 0、最大值 ≥ 最小值、步长 > 0，且至少有 2 个可选值',
        closePast: '截止时间必须晚于现在'
      }
    },
    readPermission: {
      label: '阅读权限',
      everyone: '所有人可见',
      level0: '注册用户可见',
      level: '信任等级 {{level}} 及以上可见'
    },
    lottery: {
      title: '抽奖',
      add: '添加抽奖',
      remove: '移除抽奖',
      name: '抽奖名称',
      namePlaceholder: '留空则使用主题标题',
      drawAt: '开奖时间',
      minParticipants: '最少参与人数',
      maxParticipants: '最多参与人数（0 为不限）',
      minTickets: '每人最少票数',
      maxTickets: '每人最多票数',
      minTrustLevel: '参与门槛',
      trustLevel: '信任等级 {{level}}',
      levels: '奖项',
      levelName: '奖项名称，如 一等奖',
      prize: '奖品',
      quantity: '名额',
      addLevel: '添加奖项',
      removeLevel: '删除奖项',
      hint: '每张票消耗参与者 1 能量；参与前需先回复本主题。',
      capHint: '最少参与人数不能超过 {{cap}}。',
      errors: {
        drawAt: '开奖时间需在未来 30 天以内',
        participants: '最少参与人数需 ≥ 1，并小于最多参与人数（不限时填 0）',
        cap: '最少参与人数不能超过 {{cap}}',
        tickets: '每人最少票数需 ≥ 1，且不大于最多票数',
        trustLevel: '参与门槛需在 0–4 级之间',
        levels: '至少需要一个奖项',
        level: '请完整填写每个奖项的名称、奖品和名额',
        banned: '奖品不能包含现金、红包、实物等违禁内容（“{{word}}”）'
      }
    },
    redEnvelope: {
      title: '红包',
      add: '添加红包',
      remove: '移除红包',
      totalPoints: '总能量',
      totalCount: '红包个数',
      hint: '随机分配，每个红包平均不少于 10 能量；主题发布后自动创建，回复者自动领取。',
      balance: '当前余额 {{points}} 能量。',
      errors: {
        count: '红包个数需在 1–100 之间',
        points: '总能量需不少于 红包个数 × 10',
        balance: '能量余额不足'
      }
    },
    edit: {
      title: '编辑 #{{number}}',
      titleFirst: '编辑主题',
      reason: '编辑原因（可选）',
      save: '保存修改',
      saving: '保存中…',
      saved: '修改已保存',
      unchanged: '没有需要保存的修改',
      loading: '正在载入原文…',
      loadFailed: '原文载入失败：{{message}}',
      reload: '载入最新内容（覆盖当前修改）',
      bodySaved: '正文已保存，但标题、节点、标签或阅读权限未保存：{{message}}',
      discardTitle: '放弃修改？',
      discardBody: '尚未保存的修改将会丢失。',
      discard: '放弃修改'
    },
    message: {
      title: '发送私信',
      recipients: '收件人',
      recipientsPlaceholder: '输入用户名或群组名',
      recipientsRequired: '请至少添加一位收件人',
      removeRecipient: '移除 {{name}}',
      titleLabel: '标题',
      titlePlaceholder: '私信标题',
      titleTooShort: '标题至少需要 {{count}} 个字',
      bodyPlaceholder: '私信内容，支持 Markdown',
      send: '发送',
      sending: '发送中…',
      sent: '私信已发送'
    },
    tags: {
      label: '标签',
      placeholder: '搜索或添加标签',
      remove: '移除标签 {{name}}',
      max: '最多 {{count}} 个标签'
    },
    draft: {
      saving: '正在同步草稿…',
      saved: '草稿已同步',
      local: '草稿仅保存在本机',
      conflict: '草稿已在其他设备修改。',
      keepMine: '保留此设备的版本',
      loadTheirs: '载入另一设备的版本'
    },
    autocomplete: {
      group: '群组',
      category: '节点',
      tag: '标签'
    },
    followUp: {
      title: '主题已发布，附加内容未完成',
      failed: {
        lottery: '抽奖创建失败：{{message}}',
        redEnvelope: '红包创建失败：{{message}}'
      },
      created: {
        lottery: '抽奖已创建',
        redEnvelope: '红包已创建'
      },
      retry: '重试',
      retrying: '重试中…',
      dismiss: '放弃'
    }
  },
  en: {
    reply: {
      title: 'Reply to {{title}}',
      titleUser: 'Reply to @{{username}}',
      placeholder: 'Write your reply…',
      send: 'Send',
      sending: 'Sending…',
      sent: 'Reply posted',
      minimize: 'Minimize',
      expand: 'Expand',
      resize: 'Drag to resize, double-click to reset'
    },
    topic: {
      title: 'New topic',
      node: 'Node',
      titleLabel: 'Title',
      titlePlaceholder: 'Sum up your topic in one sentence',
      bodyPlaceholder: 'Body, Markdown supported',
      publish: 'Publish',
      publishing: 'Publishing…',
      published: 'Topic published',
      nodeRequired: 'Choose a node to post in',
      titleTooShort: 'The title needs at least {{count}} characters'
    },
    nodePicker: {
      placeholder: 'Choose a node',
      search: 'Search nodes',
      recent: 'Recently posted',
      joined: 'Joined',
      empty: 'No matching nodes',
      loading: 'Loading nodes…'
    },
    enqueued: 'Submitted. It appears once a moderator approves it.',
    enqueuedExtras: 'Submitted for review. A lottery or red envelope can’t be attached until the post is approved.',
    emptyBody: 'Write something first',
    bodyTooLong: 'The post can’t be longer than {{count}} characters',
    extrasInvalid: 'Check the lottery or red envelope settings',
    waitUploads: 'Wait for uploads to finish',
    shortcutCtrlEnter: 'Ctrl+Enter to send',
    shortcutEnter: 'Enter to send, Shift+Enter for a new line',
    counter: '{{count}} chars',
    counterMax: '{{count}} / {{max}} chars',
    discard: {
      title: 'Close the editor?',
      body: 'Your text is saved as a draft on this device and comes back next time.',
      keep: 'Keep draft',
      discard: 'Discard draft',
      cancel: 'Keep editing'
    },
    editor: {
      write: 'Write',
      preview: 'Preview',
      previewEmpty: 'Nothing to preview',
      previewNote: 'Approximate preview; the published post may differ',
      bold: 'Bold (Ctrl+B)',
      italic: 'Italic (Ctrl+I)',
      strikethrough: 'Strikethrough',
      heading: 'Heading',
      quote: 'Quote',
      code: 'Inline code',
      codeBlock: 'Code block',
      link: 'Link (Ctrl+K)',
      bulletList: 'Bulleted list',
      numberedList: 'Numbered list',
      spoiler: 'Spoiler',
      hidden: 'Hidden content',
      hiddenReply: 'Visible after replying',
      hiddenLogin: 'Visible when signed in',
      hiddenPay: 'Paid content (if enabled on the site)',
      poll: 'Insert poll',
      upload: 'Upload files',
      dropHint: 'Drop to upload',
      sample: {
        bold: 'bold text',
        italic: 'italic text',
        strikethrough: 'struck text',
        heading: 'Heading',
        quote: 'quoted text',
        code: 'code',
        link: 'link text',
        list: 'list item',
        spoiler: 'spoiler',
        hidden: 'hidden content'
      },
      video: 'Video: {{name}}',
      audio: 'Audio: {{name}}',
      pollPreview: 'Poll'
    },
    upload: {
      placeholder: '[Uploading: {{name}}…]',
      uploading: 'Uploading',
      queued: 'Waiting',
      failed: 'Upload failed: {{message}}',
      failedToast: '{{name}} failed to upload: {{message}}',
      retry: 'Retry',
      dismiss: 'Remove'
    },
    poll: {
      title: 'Insert poll',
      insert: 'Insert',
      type: 'Type',
      types: {
        regular: 'Single choice',
        multiple: 'Multiple choice',
        number: 'Number rating',
        ranked_choice: 'Ranked choice'
      },
      pollTitle: 'Poll title (optional)',
      options: 'Options (up to {{count}})',
      optionsHint: 'One option per line',
      min: 'Minimum',
      max: 'Maximum',
      maxDefault: 'Option count',
      step: 'Step',
      results: 'Show results',
      resultsOptions: {
        always: 'Always',
        on_vote: 'After voting',
        on_close: 'When closed',
        staff_only: 'Staff only'
      },
      chartType: 'Chart',
      charts: {
        bar: 'Bar',
        pie: 'Pie'
      },
      close: 'Close at (optional)',
      public: 'Show who voted',
      permissionHint: 'Creating polls needs the site’s required trust level (1 by default).',
      errors: {
        tooFewOptions: 'Add at least 2 options',
        tooManyOptions: 'Use at most {{count}} options',
        duplicate: 'Options must be different',
        minMax: 'Check the minimum and maximum: at least 1, minimum ≤ maximum, and fewer than the options',
        number: 'Check the range: minimum ≥ 0, maximum ≥ minimum, step > 0, with at least 2 values',
        closePast: 'The close time must be in the future'
      }
    },
    readPermission: {
      label: 'Who can read',
      everyone: 'Everyone',
      level0: 'Registered users',
      level: 'Trust level {{level}} and up'
    },
    lottery: {
      title: 'Lottery',
      add: 'Add lottery',
      remove: 'Remove lottery',
      name: 'Lottery name',
      namePlaceholder: 'Uses the topic title when empty',
      drawAt: 'Draw at',
      minParticipants: 'Minimum participants',
      maxParticipants: 'Maximum participants (0 = no limit)',
      minTickets: 'Minimum tickets per user',
      maxTickets: 'Maximum tickets per user',
      minTrustLevel: 'Required trust level',
      trustLevel: 'Trust level {{level}}',
      levels: 'Prizes',
      levelName: 'Prize tier, e.g. First prize',
      prize: 'Prize',
      quantity: 'Winners',
      addLevel: 'Add prize tier',
      removeLevel: 'Remove prize tier',
      hint: 'Each ticket costs participants 1 energy; they must reply to the topic first.',
      capHint: 'Minimum participants can be at most {{cap}}.',
      errors: {
        drawAt: 'The draw must be within the next 30 days',
        participants: 'Minimum participants must be at least 1 and below the maximum (0 for no limit)',
        cap: 'Minimum participants can be at most {{cap}}',
        tickets: 'Minimum tickets must be at least 1 and no more than the maximum',
        trustLevel: 'The trust level must be between 0 and 4',
        levels: 'Add at least one prize tier',
        level: 'Fill in the name, prize and winners for every tier',
        banned: 'Prizes can’t include cash, red envelopes, physical goods and similar (“{{word}}”)'
      }
    },
    redEnvelope: {
      title: 'Red envelope',
      add: 'Add red envelope',
      remove: 'Remove red envelope',
      totalPoints: 'Total energy',
      totalCount: 'Number of envelopes',
      hint: 'Split randomly, averaging at least 10 energy each. Created right after the topic is posted; repliers claim automatically.',
      balance: 'Balance: {{points}} energy.',
      errors: {
        count: 'Use 1–100 envelopes',
        points: 'Total energy must be at least 10 × the number of envelopes',
        balance: 'Not enough energy'
      }
    },
    edit: {
      title: 'Edit #{{number}}',
      titleFirst: 'Edit topic',
      reason: 'Reason for editing (optional)',
      save: 'Save changes',
      saving: 'Saving…',
      saved: 'Changes saved',
      unchanged: 'Nothing to save',
      loading: 'Loading the post…',
      loadFailed: 'Couldn’t load the post: {{message}}',
      reload: 'Load latest (discards your changes)',
      bodySaved: 'The post was saved, but the title, node, tags or read permission weren’t: {{message}}',
      discardTitle: 'Discard changes?',
      discardBody: 'Unsaved changes will be lost.',
      discard: 'Discard changes'
    },
    message: {
      title: 'New message',
      recipients: 'To',
      recipientsPlaceholder: 'Username or group name',
      recipientsRequired: 'Add at least one recipient',
      removeRecipient: 'Remove {{name}}',
      titleLabel: 'Title',
      titlePlaceholder: 'Message title',
      titleTooShort: 'The title needs at least {{count}} characters',
      bodyPlaceholder: 'Message, Markdown supported',
      send: 'Send',
      sending: 'Sending…',
      sent: 'Message sent'
    },
    tags: {
      label: 'Tags',
      placeholder: 'Search or add tags',
      remove: 'Remove tag {{name}}',
      max: 'Up to {{count}} tags'
    },
    draft: {
      saving: 'Syncing draft…',
      saved: 'Draft synced',
      local: 'Draft saved on this device only',
      conflict: 'This draft was changed on another device.',
      keepMine: 'Keep this version',
      loadTheirs: 'Load the other version'
    },
    autocomplete: {
      group: 'Group',
      category: 'Node',
      tag: 'Tag'
    },
    followUp: {
      title: 'Topic posted, but not everything was attached',
      failed: {
        lottery: 'The lottery couldn’t be created: {{message}}',
        redEnvelope: 'The red envelope couldn’t be created: {{message}}'
      },
      created: {
        lottery: 'Lottery created',
        redEnvelope: 'Red envelope created'
      },
      retry: 'Retry',
      retrying: 'Retrying…',
      dismiss: 'Give up'
    }
  }
})
