# NodeLoc Desktop — 需求分析

> 版本 v0.3 · 2026-09-13
> 依据：
> - iOS 源码 `D:\nodeloc_ios\nodeloc\`（SwiftUI，行为基线）与 `D:\nodeloc_ios\android-design\`（由 iOS 提炼的移植规格）
> - **后端源码** `\\wsl.localhost\Ubuntu\var\discourse`（Discourse 核心 + 全部插件）——接口以源码为准，附录 B 标注了出处
> - 线上 `site.json` / `about.json` 实测
>
> 技术约束：Electron + React + TypeScript，**仅 Windows**（macOS 由 iOS 版覆盖）。产品形态：**Discord（常驻导航、实时聊天、多面板）× Reddit（信息流、赞踩、嵌套评论树）**。
>
> v0.3 变更：确定仅做 Windows（Electron），移除 macOS 相关需求；写入限流、插件启用、签名、广告四项决定。
>
> v0.2 变更：写入已确认的产品决定（§9.2）；以后端源码核对全部接口，修正 v0.1 中猜测错误的端点（聊天发送、登出、赞踩、草稿、Votes 排序等）；新增签到、Boosts、隐藏内容、HLS 视频、广告位、API Key 限流等需求。

---

## 1. 背景与目标

### 1.1 背景

NodeLoc（nodeloc.com）是基于 **Discourse + 约 30 个自研插件** 的中文社区。线上实测规模（`about.json`）：

| 指标 | 数值 |
|------|------|
| 注册用户 | 46,917 |
| 30 天活跃 | 9,958 |
| 主题 / 帖子 | 48,928 / 946,927 |
| 分类 | 222（12 个一级分区 + 其下"节点"） |
| 聊天 | 1,746 位聊天用户，30 天 15,102 条消息，频道累计 4,278（多数为私聊） |

已有 iOS 原生客户端，功能完整度较高，且已沉淀一套移植规格（android-design）。桌面端在复用这些后端知识的前提下，重新设计适合大屏、鼠标键盘、常驻后台的交互形态。

### 1.2 产品定位

一个"**常驻的社区客户端**"：
- 像 **Reddit** 一样刷信息流、赞踩、读嵌套评论树；
- 像 **Discord** 一样左侧常驻节点栏、实时聊天/私信、未读提醒、托盘常驻、系统通知；
- 利用桌面优势：多栏并排（列表 + 阅读器）、多窗口、快捷键、拖拽/粘贴上传、实时推送（不再依赖 iOS 的 15 分钟后台轮询）。

### 1.3 目标 / 成功标准

1. 游客可完整浏览；登录用户可完成 web 端 90% 以上的日常操作，无需打开浏览器。
2. 聊天/通知端到端延迟 ≤ 2s（MessageBus 长轮询）。
3. 冷启动到首屏内容 ≤ 2s（有缓存）；长帖（500+ 回复）滚动流畅不卡顿。
4. **仅 Windows**（Windows 10/11 x64）；macOS 用户使用在 Mac 上运行的 iOS 版；Linux 暂不发布。
5. 请求量受控：主进程统一调度请求，避免无谓的重复请求（站点可按需调高 User API Key 限流）。

### 1.4 非目标（v1 不做）

- 版主/管理员后台（审核队列、封禁、站点设置、节点管理工具）——跳转网页。
- 涉及真实货币的流程：能量购买、广告购买/结算、Solana 钱包、支付网关——跳转系统浏览器。
- 广告位（discourse-promotion 推广广告、discourse-sidead 侧栏图片广告）——暂不加入。
- Pro 会员（iOS 为纯 mock，后端无对应能力）。
- 本地全文离线数据库。

---

## 2. 现状分析

### 2.1 后端能力盘点（以源码为准）

**Discourse 核心**

| 能力 | iOS 是否使用 | 源码要点 |
|------|:---:|------|
| 话题/帖子/分类/搜索/用户/通知/私信 | ✅ | |
| **嵌套回复**（`/n/{slug}/{topicId}.json`） | ✅ | **属于 Discourse 核心**（不是插件）。排序 `top/hot/new/old`（iOS 只用了 3 种）；根回复 20 条/页、子回复 50 条/页；最大深度由 `nested_replies_max_depth` 决定；首页返回 `message_bus_last_id` |
| 帖子编辑/删除/恢复/修订历史 | ❌ | `PUT /posts/:id`（带 `original_text` 可检测 409 编辑冲突） |
| 草稿 | ❌ | `POST /drafts.json`，`data` 为 JSON 字符串，sequence 冲突返回 409 |
| 书签增删改 | 仅新增 | `DELETE /bookmarks/:id` |
| 举报（含自定义类型） | ❌ 跳网页 | `site.post_action_types` |
| 标签 | 仅展示 | `top_tags`、`community_tag_styles` |
| 自动补全（用户/hashtag/emoji） | ❌ | `/u/search/users.json`、`/hashtags/search.json`、`/emojis.json` |
| 话题跟踪状态（未读/新） | ❌ | `/u/:username/topic-tracking-state.json` + MessageBus |
| MessageBus 实时 | 仅聊天 | 通知、通知弹窗、话题变更、未读跟踪、聊天、presence 全部可订阅（附录 C） |
| Presence（正在回复/在线） | ❌ | `/presence/update`、`/presence/get` |
| 聊天（频道/私聊/讨论串/搜索/表情回应/编辑/删除/上传） | 部分 | 发送是 `POST /chat/:channelId`；分类频道仅 staff 可创建、每分类一个 |
| User API Key（授权/OTP/撤销/设备码） | 授权 | OTP 可为 webview 建立 Cookie 会话；**限流 50 次/分钟、4000 次/天** |
| 数学公式 discourse-math | ❌ | |

**自研 / 社区插件**

| 插件 | 用途 | iOS | 桌面优先级 |
|------|------|:---:|:---:|
| discourse-community | 节点（=子分类）、加入/退出/申请加入、创建、转发、最近访问、**已加入节点 Feed `/joined`**、自定义 Feed 全套管理、节点 flair/规则/认证/官方 | 部分 | P0 |
| discourse-vote + discourse-reactions | **赞踩**：`PUT /vote/posts/:id`，分数 = like 数 − 踩数，`heart` 即核心 like | ❌（踩为空壳） | **P0** |
| discourse-topic-voting | 话题投票（`/votes.json` 列表），**与赞踩分数无关** | ❌ | P2 |
| lottery | 抽奖：创建/预校验/参与/开奖/关闭 | ✅ | P0 |
| discourse-red-envelope | 红包：回复自动领取 | ✅ | P0 |
| discourse-reward | 打赏：每人每帖一次，按信任等级限额，可撤回 | 部分 | P0 |
| discourse-points-service | 能量账本：余额、历史、转账、购买 | 部分 | P0（余额/历史）/ P2（转账） |
| **discourse-checkin** | **每日签到**领能量 | ❌ | **P0** |
| **discourse-anyvideo** | 视频转 HLS 流 + 内联播放器 | 部分 | P0 |
| **discourse-boosts** | 帖子"助力"：短文本/emoji 微回应（≤16 字） | ❌ | P1 |
| **discourse-permission** | 隐藏内容 `[reply]` / `[login]` / `[pay amount=N]` | ❌ | P1 |
| **discourse-read-permission** | 话题按信任等级限制阅读 | ❌ | P1 |
| **discourse-featured-topic** | 精华话题（奖杯标识 + 能量奖励），`/featured.json` | ❌ | P1 |
| discourse-custom-badge | 头衔/群组名文字特效（13 种） | ✅ | P1 |
| discourse-apps | 社区小程序：blocks（JSON UI）与 webview 两种形态（**已确认启用**） | 部分 | P1 |
| discourse-promotion / discourse-sidead | 自助广告（侧栏/信息流/主楼下方）与旧侧栏图片广告 | ❌ | 暂不做 |
| discourse-mobile | 移动端适配：`/mobile/meta` 功能开关、FCM 推送（**仅 android/ios**） | ✅ | P0（仅 `/mobile/meta`） |
| discourse-follow | 关注 | ✅ | P0 |
| discourse-gifs | GIF（Klipy） | ✅ | P1 |
| discourse-servers | 发帖人服务器数量徽标 | ❌ | P2 |
| discourse-upgrade-process | 信任等级升级进度 | ❌ | P2 |
| discourse-posting-leaderboard | 水王/文圣榜 | ❌ | P2 |
| discourse-project | 社区项目目录与评价 | ❌ | P2 |
| discourse-category-migrate | staff 移动话题（只需渲染通知类型 6000） | ❌ | P2 |
| discourse-payment / discourse-solana / discourse-auth-provider | 支付网关 / 代币钱包 / OAuth 提供方 | ❌ | 跳浏览器 |
| discourse-auto-private、moderator-bonus、risk-control、categories-suppressed、merchants（已被 promotion 取代）、modeloc（onebox，仅需 CSS） | 内部或无需客户端工作 | — | skip |

> **启用状态**：已确认上述插件均在线上启用。客户端仍按 `/mobile/meta` 与 `site.json` 的功能开关动态显示入口，以便站点日后关闭某项功能时无需发版。

### 2.2 iOS 已实现功能（桌面端继承基线）

| 域 | 功能 |
|----|------|
| 信息流 | `/latest` 分页；三种阅读模式（紧凑/展开/卡片）全局共享；骨架屏；未读点；断网空态+重试 |
| 节点 | 按一级分区浏览；节点详情（banner、简介、成员数、加入/退出、通知级别 0–4、关于、版主）；节点内排序（latest/new/hot/featured/top）；域内搜索（`#slug`）；创建节点（slug 查重、颜色、父分区） |
| 阅读器 | cooked HTML → 块树渲染；嵌套回复树（缩进 ≤8 级、Reddit 导轨、整棵子树折叠、"另外 N 个回复"）；回复排序；楼层深链；阅读时长上报 `topics/timings`；点赞/书签/转发/打赏；投票/抽奖/红包 |
| 撰写 | 选节点（最近发帖 > 已加入 > 其他）；标题+富文本→Markdown；≤9 图上传（限速 9 张/分钟）+图片编辑器；单视频裁剪/转 GIF+封面；GIF 搜索；投票/抽奖/红包创建器 |
| 消息 | 通知（分类图标+统一文案，深链）；私信（个人+群组收件箱）；聊天频道/讨论串/消息搜索；会话磁盘快照秒开 + MessageBus 实时 |
| 搜索 | 全部/节点/帖子/用户/应用/媒体六个 scope；历史（≤50 条） |
| 账户 | 帐密+TOTP/备用码；网站授权（User API Key）；分步注册；游客模式；忘记密码 |
| 我的 | 资料卡（头衔、flair、角色、徽章、常去节点、统计）；活动 Tab（主题/帖子/赞/书签/能量）；公开资料+关注 |
| 设置 | 界面/通知/邮件/跟踪/隐私/其他/网页端 7 页 `user_option` 全量；资料编辑；关联账户；安全（2FA、会话管理） |
| 其他 | 内置浏览器；全屏看图/视频；应用目录；轮询式本地推送 |

### 2.3 iOS 缺口与占位（桌面端的机会）

| 缺口 | 后端 | 桌面端 |
|------|:---:|------|
| Reddit 踩（iOS 踩按钮是空壳） | ✅ discourse-vote | **P0** |
| 每日签到 | ✅ discourse-checkin | **P0** |
| 取消书签；通知/私信/活动流/搜索分页 | ✅ | P0 |
| 登出时撤销凭据（iOS 仅清本地，会话残留） | ✅ `POST /user-api-key/revoke` | P0 |
| 实时通知（非轮询） | ✅ MessageBus | P0 |
| 数学公式、代码高亮、行内剧透、HLS 视频 | ✅ | P0 渲染 |
| 帖子编辑/删除/引用回复、草稿、自动补全、原生举报 | ✅ | P1 |
| 标签选择与标签页 | ✅ | P1 |
| 发起私信 / 聊天私聊；聊天表情回应/回复/编辑/删除/上传 | ✅ | P1 |
| Boosts、隐藏内容、阅读权限、精华话题 | ✅ | P1 |
| 已加入节点 Feed、自定义 Feed 管理、申请加入私有节点 | ✅ discourse-community | P1 |
| 多账户 | 客户端能力 | P2 |

**不照搬的 iOS 占位**：信息流卡片的"…"/分享、聊天头部铃铛与"+"附件、公开资料头部工具、节点浏览卡片上的假"加入"按钮、搜索页硬编码热门词、Pro 页、旧 Onboarding 页、拖不动的投票选项拖拽柄、本地假"赞"。

---

## 3. 产品形态：Discord × Reddit

### 3.1 概念映射

| NodeLoc 概念 | Discord 对应 | Reddit 对应 | 桌面端呈现 |
|------|------|------|------|
| 一级分区（互联网服务、科技与创作…） | 服务器文件夹 | — | 节点栏中的分组 |
| **节点**（子分类） | **服务器** | **Subreddit** | 左侧节点栏图标（已加入的节点）；进入后是 Reddit 式话题列表 |
| 节点内视图（最新/新/热门/精华/Top） | 频道 | 排序 Tab | 节点侧栏里的"视图"列表 |
| 节点聊天频道（**目前没有，后续上线**） | 文字频道 | — | v1 节点侧栏只放"视图"；布局与数据模型预留"聊天"分组。后端可用 Discourse 核心的分类频道（`chatable_type = Category`，每分类一个，staff 创建），上线后直接接入 |
| 话题 + 嵌套回复 | — | Post + 评论树 | 阅读器面板 |
| 赞踩（表情回应） | 表情回应 | Upvote / Downvote | 左侧竖排投票条（▲ 分数 ▼），长按/右键选具体表情 |
| Boosts | 表情回应 | — | 帖子底部小气泡 |
| 聊天私聊 / 私信 | DM | 私信 | "私信"入口（节点栏顶部） |
| 通知 | 收件箱 | 通知 | 收件箱弹出面板 + 系统通知 |
| 能量 / 打赏 / 红包 / 签到 | — | Awards / Karma | 用户条显示能量余额与签到按钮；帖子上打赏、红包横幅 |
| 应用目录 | 应用 / 活动 | — | 节点栏底部"应用"入口，独立窗口运行 |

### 3.2 主窗口布局

```
┌────┬──────────────────┬───────────────────────────────────────┬─────────────────┐
│ 🏠 │ 首页              │ [最新][热门][新][精华][Top]   🔍 ⚙    │ 右侧上下文面板   │
│ ✉️ │  · 最新 / 已加入   │───────────────────────────────────────│（可折叠）        │
│ 🔔 │  · 未读 / 书签     │ ▲ │ 标题标题标题…            #节点 3h │  节点：关于/规则/│
│────│ 自定义 Feed        │ 12│ 摘要… [图片缩略]          💬 45   │        版主/成员 │
│ 🟢 │  · xxx            │ ▼ │                                  │  阅读器：楼层导航│
│ 🔵 │ 最近访问节点        │───────────────────────────────────────│        参与者    │
│ 🟠 │  · VPS            │ ▲ │ …                                 │  聊天：讨论串    │
│ …  │  · AI             │                                       │                 │
│ ➕ │───────────────────│  ← 点击话题：中栏切为阅读器，或           │                 │
│ 🧭 │ [头像] 用户名 ⚡128 ✅签到 ⚙ │  开启"分栏阅读"时在右侧并排打开 │                 │
└────┴──────────────────┴───────────────────────────────────────┴─────────────────┘
 ① 节点栏(72px)  ② 上下文侧栏(240px)   ③ 主内容区（自适应）              ④ 详情面板(320px)
```

- **① 节点栏**：首页、私信/聊天、收件箱（红点）；已加入节点图标（未读白点、@提及红色角标、可拖拽排序、可分组）；➕ 创建/加入节点；🧭 浏览全部节点；应用目录。
- **② 上下文侧栏**：随①的选择变化——首页显示信息流视图、自定义 Feed、最近访问；节点显示节点头图、视图、（预留）聊天频道；私信显示会话列表。底部固定用户条（头像、能量余额、签到、设置）。
- **③ 主内容区**：话题列表 / 阅读器 / 聊天会话 / 搜索结果 / 资料页。
- **④ 详情面板**：可收起。窗口宽度 < 1100px 时自动收起，< 800px 时侧栏折叠为抽屉。

### 3.3 导航与多窗口

- 应用内路由（memory router），支持 **后退/前进**（鼠标侧键、`Alt+←/→`）。
- 所有 nodeloc.com 链接统一经过 LinkRouter：`/t/` → 阅读器（带楼层），`/u/` → 资料，`/n/{slug}`、`/c/` → 节点，`/f/{user}/{slug}` → 自定义 Feed，`/u/{u}/messages/group/{g}` → 私信，`/chat/c/-/{id}/{msg}` → 聊天；其余站内链接 → 内置浏览器；外链 → 系统浏览器（可在设置中切换）。
  - 注意：`/n/{slug}` 是节点页（discourse-community），`/n/{slug}/{topicId}` 是嵌套回复（核心），解析时按段数区分。
- **弹出窗口**：阅读器、聊天会话、撰写器可"在新窗口打开"。
- **快速切换器** `Ctrl+K`：模糊搜索节点、聊天频道、私信对象、最近帖子。

---

## 4. 功能需求

优先级：**P0** = MVP 必须；**P1** = 首个正式版；**P2** = 后续迭代。端点细节见附录 B。

### 4.1 账户与认证（AUTH）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| AUTH-01 | 游客模式：所有公开内容可读；写操作入口统一显示"登录"按钮 | P0 |
| AUTH-02 | **User API Key 登录（主路径，已确认）**：生成 RSA 密钥对 + nonce；系统浏览器打开 `/user-api-key/new`（`application_name`、`client_id`=安装期 UUID、`scopes`、`public_key`、`nonce`、`auth_redirect=nodeloc://auth_redirect`、`padding=oaep`）；回调 `payload` 为 Base64（含换行，需先 URL 解码）→ 私钥解密 → 校验 nonce → 取 `key`；再调 `session/current.json` | P0 |
| AUTH-03 | Scopes：`read,write,message_bus,notifications,session_info,one_time_password`。**写操作、MessageBus 轮询、签到、草稿都需要 `write`** | P0 |
| AUTH-04 | 协议回调：注册 `nodeloc://`（`app.setAsDefaultProtocolClient`）；已运行时从 `second-instance` 的 argv 取回调 URL，冷启动时从 `process.argv` 取；等待页可取消、可重新打开浏览器、可手动粘贴回调链接 | P0 |
| AUTH-05 | 凭据存储：key 与 client_id 用 `safeStorage` 加密落盘；请求头 `User-Api-Key` + `User-Api-Client-Id`（无需 CSRF）；REST 返回 403 `invalid_access` 时提示重新授权 | P0 |
| AUTH-06 | **key 失效检测**：MessageBus 遇到无效 key 不报错，而是**静默降级为匿名**。需监听响应头 `Discourse-Logged-Out`，并在启动/唤醒时用一次 REST 请求校验 key | P0 |
| AUTH-07 | **Webview 登录态（OTP）**：需要站内网页登录态时（内置浏览器、webview 小程序），`POST /user-api-key/otp` 获取加密 OTP → 解密得 32 位 hex → 在共享分区的隐藏窗口 GET `/session/otp/{otp}` 并提交页面表单 → 分区获得 `_t` Cookie。OTP 10 分钟有效、一次性 | P1 |
| AUTH-08 | 登出：`POST /user-api-key/revoke`（仅带 key 头即撤销当前 key），清空 `safeStorage`、Cookie 分区与本地缓存 | P0 |
| AUTH-09 | 注册：跳转网页注册后回到授权流程（原生分步注册降为 P2） | P1 |
| AUTH-10 | 设备码登录（`/user-api-key/device` + poll）——协议回调失败时的兜底，无需 URL scheme | P2 |
| AUTH-11 | 多账户切换（每账户独立 key 与 Cookie 分区） | P2 |

### 4.2 节点与导航（NAV / NODE）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| NAV-01 | 节点栏：首页 / 私信 / 收件箱 / 已加入节点（`/node/joined`）/ 浏览 / 创建；游客显示推荐节点 | P0 |
| NAV-02 | 节点未读指示：`/u/:username/topic-tracking-state.json` 初始化 + MessageBus `/new`、`/unread`、`/unread/:uid` 增量，按 `category_id` 聚合 | P1 |
| NAV-03 | 节点栏拖拽排序、分组折叠（本地持久化） | P2 |
| NAV-04 | 上下文侧栏：最近访问节点（`/node/recently-visited`）、自定义 Feed | P0 |
| NAV-05 | `Ctrl+K` 快速切换器 | P1 |
| NAV-06 | 功能开关：启动时读取 `/mobile/meta`（签到、抽奖、红包、应用、聊天等），关闭的功能隐藏入口 | P0 |
| NODE-01 | 浏览节点：`/nodes.json`（推荐 + 按一级分区分组）、组内分页 `/node/browse/{parentId}`；卡片的加入按钮**真加入** | P0 |
| NODE-02 | 节点页：头图、logo（含深色版）、名称、认证/官方标识、成员数、简介、加入/退出（创建者不可退出）、通知级别 0–4 | P0 |
| NODE-03 | 节点视图：最新 / 新 / 热门 / 精华（`featured`）/ Top（含周期）；列表路径必须用完整 `parent/child` slug | P0 |
| NODE-04 | 右侧"关于"面板：介绍、规则（`community_rules`）、版主（≤5 名）、统计 | P0 |
| NODE-05 | 节点内搜索（预填 `#slug`） | P0 |
| NODE-06 | 私有节点：`/n/{slug}/landing` 展示公开卡片 + 申请加入（`reason` 必填，已申请返回 409） | P1 |
| NODE-07 | 创建节点（`can_create_community`，默认 TL3）：名称、slug 实时查重、父分区、颜色、简介、logo/背景上传 | P1 |
| NODE-08 | 节点主理人工具（编辑、邀请、flair、封禁、广告、外部频道）——跳转网页 | P2 |

### 4.3 信息流（FEED）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| FEED-01 | 首页视图：最新 / **已加入节点**（`/joined.json`）/ 热门 / 新 / 未读 / Top / 精华 / 书签；默认视图读取账户 `homepage_id` | P0 |
| FEED-02 | 三种阅读模式（紧凑/展开/卡片），偏好优先级：本机选择 > 账户 `community_view_mode` > 紧凑 | P0 |
| FEED-03 | 列表行：**左侧投票条**（`op_vote_score`、`op_vote_direction`；无 vote 字段即不可投票，隐藏投票条）、标题、节点、作者、时间、置顶、精华奖杯（`is_featured`）、抽奖状态（`lottery_status`）、标签（按 `community_tag_styles` 着色）、回复数、缩略图/媒体（`topic_images`、`topic_video_url`） | P0 |
| FEED-04 | 虚拟滚动 + 无限加载（`more_topics_url`）；骨架屏；断网空态+重试；**不得用演示数据兜底** | P0 |
| FEED-05 | 列表内直接赞踩（`PUT /vote/posts/{op_post_id}`） | P0 |
| FEED-06 | "有 N 个新话题"提示条（MessageBus `/latest`、`/new`），点击插入 | P1 |
| FEED-07 | 键盘导航：`J/K` 上下选中，`Enter` 打开，`A/Z` 赞/踩 | P1 |
| FEED-08 | 点开话题后本地标记已读，未读点立即消失 | P0 |
| FEED-09 | 视频贴片：悬停播放，全局静音状态 | P1 |
| FEED-10 | 标签页（`/tag/{slug}/{id}.json`）、自定义 Feed 页（`/f/{user}/{slug}.json`） | P1 |
| FEED-11 | 自定义 Feed 管理：新建/编辑/删除、增删节点（≤100）、复制他人 Feed | P1 |

### 4.4 帖子阅读器（READ）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| READ-01 | 布局：主楼（作者行/标题/标签/精华标识/红包横幅/正文/抽奖卡/操作栏）→ 回复树 → 底部回复框；支持"中栏替换"或"分栏并排" | P0 |
| READ-02 | 嵌套回复树（`/n/{slug}/{topicId}.json`，slug 可用占位符），虚拟化 DFS 平铺；视觉缩进上限 8 级，超出显示"继续此对话 →"（调 `children` 接口并带 `depth`） | P0 |
| READ-03 | 折叠：点击导轨或作者名折叠整棵子树 | P0 |
| READ-04 | **低分折叠**：`vote_score ≤ vote_collapse_score_threshold`（-5）的帖子默认折叠为"已折叠（得分 N）"，点击展开；展开状态仅保存在内存。（web 端仅截断正文且仅作用于主楼，桌面端扩展到回复） | P0 |
| READ-05 | "另外 N 个回复"就地加载（`children/{postNumber}`，50 条/页）；根回复分页（20 条/页） | P0 |
| READ-06 | 回复排序：Top / 热门 / 最新 / 最早（`top/hot/new/old`，默认取站点设置） | P0 |
| READ-07 | 楼层深链定位并高亮（`/n/{slug}/{topicId}/{postNumber}.json` 取上下文链）；右侧楼层时间轴 | P0 / P1 |
| READ-08 | 阅读进度：每秒给可见 ≥50% 的楼层计时，**每 30 秒**批量上报 `topics/timings`（比 iOS 的 10 秒放宽，节省限流额度），离开/失焦时补报 | P0 |
| READ-09 | **赞踩**：见 §4.5 VOTE | P0 |
| READ-10 | 操作：回复、引用选中文字回复、书签/取消书签、复制链接、分享、转发到节点（`/node/repost`，10 次/小时，重复转发 409）、打赏 | P0（回复/书签/复制链接）/ P1 |
| READ-11 | 打赏：金额（≤ 信任等级上限，TL0–4 默认 10/50/100/200/500）+ 留言；每人每帖一次；自己的帖子不显示；打赏明细（`/reward/post/{id}`）；可撤回自己的打赏。**失败时 HTTP 仍为 200**，需读 `success:false` + `error` | P0 |
| READ-12 | Boosts：帖子底部气泡列表；添加（≤16 可见字、≤5 emoji、每人每帖一次、不能 boost 自己）；删除自己的；实时更新（`/topic/:id` 的 `boost_added/boost_removed`） | P1 |
| READ-13 | 自己的帖子：编辑（带 `original_text` 检测冲突，409 时提示合并）、删除/恢复、查看修订历史 | P1 |
| READ-14 | 原生举报：类型来自 `site.post_action_types`（含自定义"推广信息"等） | P1 |
| READ-15 | 右键菜单：复制文本、引用、复制楼层链接、在浏览器打开、举报 | P1 |
| READ-16 | 话题级：通知级别（0 静音/1 常规/2 跟踪/3 关注）、页内搜索 `Ctrl+F` | P1 |
| READ-17 | 实时：打开话题时订阅 `/topic/{id}`（`created/revised/deleted/acted/...`）与 `/topic/{id}/reactions`；收到后重拉受影响的帖子并提示"N 条新回复" | P1 |
| READ-18 | 正在回复提示：`/discourse-presence/reply/{topicId}` | P2 |
| READ-20 | 游客点击写操作 → 登录；私信话题复用阅读器（平铺 `/t/{id}.json`） | P0 |
| READ-21 | discourse-community 帖子状态：置顶楼层（`pinned_post_ids`）、锁定楼层（`locked_post_ids`）、折叠楼层（`collapsed_post_numbers`） | P1 |

### 4.5 赞踩（VOTE）— 已确认使用表情回应

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| VOTE-01 | 投票接口统一使用 `PUT /vote/posts/{postId}`，参数 `direction=up\|down\|none`（目标状态，幂等）+ 可选 `reaction`。**不直接调用 reactions 的 toggle 接口**（会绕过踩的权限与每日上限） | P0 |
| VOTE-02 | 点 ▲ 时不带 `reaction` 默认 `heart`（即核心 like）；点 ▼ 时默认 `site.vote_downvote_reactions[0]`（`-1`）；再点已选中的方向发送 `none` | P0 |
| VOTE-03 | 表情选择：长按/右键 ▲ 或 ▼ 弹出对应方向的表情列表（`site.vote_upvote_reactions` / `vote_downvote_reactions`），所选表情必须属于该方向，否则 400 | P0 |
| VOTE-04 | 显示：分数 `vote_score`；`vote_count == 0` 时显示"投票"；当前方向 `vote_direction`；`can_vote_up/can_vote_down` 为 false 时禁用对应按钮（自己的帖子、归档话题、踩权限不足）；**帖子没有 vote 字段 = 不可投票**（私信、未启用的分类），隐藏投票条 | P0 |
| VOTE-05 | 乐观更新：立即改分数和方向，以 PUT 返回的完整帖子 JSON 为准校正；失败回滚并 Toast（403 无权限、429 踩已达每日上限 50 次、422 未记录） | P0 |
| VOTE-06 | 一人一帖只能持有一个表情：切换方向即替换；**踩会移除自己的 like**；`like_count` = 赞数 | P0 |
| VOTE-07 | 表情明细：按表情分组显示回应用户（`/discourse-reactions/posts/{id}/reactions-users`） | P1 |
| VOTE-08 | 实时：`/topic/{id}/reactions` 事件不含分数，收到后重拉该帖 | P1 |
| VOTE-09 | 个人资料"收到/给出的回应"列表 | P2 |

> 说明：站点 `top_menu_items` 中的 "votes" 来自 discourse-topic-voting（话题投票数排序），**与赞踩分数无关**；服务端没有任何按 `vote_score` 排序的列表。v1 不提供"按分数排序"。

### 4.6 内容渲染（RENDER）

桌面端直接使用 DOM，**不移植** iOS 的原生块解析器：cooked HTML → 白名单净化 → 转为 React 树，交互节点替换为组件。

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| RENDER-01 | HTML 净化（DOMPurify 白名单，禁止 script/style/iframe/on* 事件）；嵌套深度熔断（>40 层降级为纯文本） | P0 |
| RENDER-02 | 基础元素：段落、标题、列表、引用（`aside.quote` 带头像与原帖跳转）、表格（横向滚动）、`details` 折叠、分隔线、长 URL 断行 | P0 |
| RENDER-03 | 代码块：语法高亮 + 语言标签 + 复制按钮 | P0 |
| RENDER-04 | 图片：按 width/height 预留占位；lightbox（滚轮缩放、拖拽平移、←/→ 翻页、Esc 关闭、右键保存/复制）；GIF | P0 |
| RENDER-05 | **视频（anyvideo）**：`div.video-placeholder-container[data-video-src]` → 从 URL 提取 40 位 sha1 → `GET /anyvideo/videos/by_sha1/{sha1}` 轮询到 `ready` → hls.js 播放 `hls_url`（相对路径需补站点域名）；未就绪/失败时回退 `source_url`；封面用 `thumbnail_url` | P0 |
| RENDER-06 | Onebox 卡片、@提及（悬停显示用户卡片）、`#节点`/标签 hashtag、自定义 emoji | P0 |
| RENDER-07 | 剧透（块级与行内均需遮罩，点击显示） | P0 |
| RENDER-08 | 数学公式（KaTeX） | P1 |
| RENDER-09 | 投票（poll）：单选/多选/评分；结果条；公开投票人；投票（`options[]` 有序重复键）/撤票 | P0 |
| RENDER-10 | 抽奖（`post.lottery`）：状态 open/drawn/closed、奖项、中奖名单、参与者、票数、开奖时间；参与（1 能量/张，可随机数量）；**参与前需已在话题中回复**；创建者/staff 显示"开奖"，staff 显示"关闭并退款" | P0 |
| RENDER-11 | 红包横幅（`topic_view.red_envelope`）：总额、个数、领取进度、已抢完；回复中"领取了 N 能量"标签（`post.notice.type == red_envelope_claim` 或 `red_envelope_claim`） | P0 |
| RENDER-12 | **隐藏内容**（discourse-permission）：`[reply]` 回复可见、`[login]` 登录可见、`[pay amount=N]` 付费可见（付费 → 刷新 cooked）；**阅读权限**（`read_permission_restricted`）显示"需要信任等级 N"占位 | P1 |
| RENDER-13 | 头衔/徽章样式：`custom_style`（`text_color` + 13 种 `text_effect`，CSS 从插件 SCSS 移植）；群组 flair（**只有以 `/` 或 `http` 开头的才当作图片**，否则为 Font Awesome 图标名） | P1 |
| RENDER-14 | discourse-apps blocks 形态（嵌在帖子中的 JSON UI，`/apps/installs/{id}/render`/`action`，带签名 `state_token`） | P2 |
| RENDER-15 | 其他：本地日期、footnote、checklist、modeloc onebox；未知块降级为纯文本 + "在浏览器中查看" | P2 |

### 4.7 撰写（COMPOSE）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| COMP-01 | 发主题：节点选择器（搜索；排序为 `recent_post_category_ids` > 已加入 > 其他）、标题、正文；节点模板 `topic_template`、标题占位 `topic_title_placeholder` | P0 |
| COMP-02 | 编辑器：Markdown 源码 + 实时预览；工具栏（粗体/斜体/删除线/标题/列表/引用/代码/链接/剧透/隐藏内容）；快捷键；发送键遵循 `send_shortcut` | P0 |
| COMP-03 | 回复：阅读器底部内联回复框（`reply_to_post_number`），可展开为大编辑器；成功后滚动到新楼层。回复红包话题时提示"回复将自动领取红包" | P0 |
| COMP-04 | 上传：按钮 / 拖拽 / 粘贴剪贴板图片；进度与失败重试；`upload_type=composer`；客户端限速 9 个/分钟 | P0 |
| COMP-05 | 视频上传：`anyvideo_allowed_extensions`、≤ `anyvideo_max_video_size_mb`（500MB），上传后服务端自动转码；封面沿用 iOS 的 `{sha1}.png` 约定（**插件源码中未找到，需核对 Discourse 核心**） | P1 |
| COMP-06 | 草稿：自动保存（防抖 ≥5 秒，节省限流额度）`POST /drafts.json`；key 为 `new_topic` / `topic_{id}` / `new_private_message`；409 时提示"草稿已在其他设备修改"；本地兜底 | P1 |
| COMP-07 | @用户、`:emoji:`、`#节点/标签` 自动补全（`/u/search/users.json`、`/emojis.json`、`/hashtags/search.json`，`order[]` 必传） | P1 |
| COMP-08 | 标签选择（受权限与 `minimum_required_tags` 约束） | P1 |
| COMP-09 | 投票创建器（类型、结果可见性、截止时间、选项 ≤ `poll_maximum_options`、min/max） | P1 |
| COMP-10 | **抽奖创建器**：先调 `/lottery/validate` 与 `/lottery/limits`（最小参与人数上限、违禁奖品词），发帖成功后 `POST /lottery`（JSON body）；失败可重试，防重复发帖 | P1 |
| COMP-11 | **红包创建器**：总能量 ≥ 个数、≥ 最低能量（10）、个数 1–100、人均 ≥10、余额充足；**必须在发帖后、话题出现回复前创建**，否则失败 | P1 |
| COMP-12 | 阅读权限：发帖时可选"需要信任等级 N 才能阅读"（`read_permission_trust_level`） | P1 |
| COMP-13 | GIF 搜索（Klipy） | P1 |
| COMP-14 | 撰写器可弹出为独立窗口；关闭时确认丢弃或存草稿 | P1 |
| COMP-15 | 图片简易编辑（裁剪/打码/标注）、视频裁剪/转 GIF | P2 |

### 4.8 收件箱：通知与私信（INBOX）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| INBOX-01 | 通知面板：按类型显示图标与统一文案，点击深链；全部已读 / 单条已读（`PUT /notifications/mark-read` 带 `id`）；分页（`offset` + `limit` ≤60） | P0 |
| INBOX-02 | 通知类型覆盖：核心类型 + 插件类型（boost 43、reward_received 5000、category_migrated 6000、topic_featured 6001、lottery_result 6002、聊天提及/消息） | P0 |
| INBOX-03 | 按类型筛选：使用 `recent=true&filter_by_types=`（**分页模式下该参数无效**）；或客户端过滤 | P1 |
| INBOX-04 | 私信列表：个人 + 群组收件箱；未读标识；分页 | P0 |
| INBOX-05 | 发起私信：`POST /posts`，`archetype=private_message` + `target_recipients`（逗号分隔用户名/群组） | P1 |
| INBOX-06 | 实时未读数：MessageBus `/notification/{userId}`（未读总数、分组未读、私信数） | P0 |

### 4.9 聊天（CHAT）— Discord 体验核心

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| CHAT-01 | 频道列表：`/chat/api/me/channels`（公开频道 + 私聊 + tracking + 讨论串未读概览）；未读数、@提及数 | P0 |
| CHAT-02 | 会话：本地快照秒开 → 网络对账；`page_size` ≤50，`direction=past/future` 双向加载；定位首条未读（`fetch_from_last_read`）；跳转指定消息（`target_message_id`） | P0 |
| CHAT-03 | 实时：订阅 `/chat/{channelId}`（sent/edit/delete/reaction/thread_created…）、`/chat/{channelId}/new-messages`、`/chat/user-tracking-state/{uid}`；打开的讨论串订阅 `/chat/{cid}/thread/{tid}`。有明确类型的事件就地更新，未知类型当作信号重拉 | P0 |
| CHAT-04 | 发送：`POST /chat/{channelId}`（`message`、`thread_id`、`in_reply_to_id`、`upload_ids[]`、`staged_id`）；Enter 发送、Shift+Enter 换行；**乐观追加**（`staged_id` 在 `sent` 事件中回传，用于替换占位），失败标红重试 | P0 |
| CHAT-05 | 已读上报：`PUT /chat/api/channels/{id}/read?message_id=`（`message_id` 必填），节流 | P0 |
| CHAT-06 | 讨论串：右侧面板（频道须开启 threading，否则 404） | P0 |
| CHAT-07 | 消息操作：回复引用、表情回应（`PUT /chat/{cid}/react/{mid}`，`react_action=add/remove`）、编辑、删除/恢复、复制、复制链接、举报 | P1 |
| CHAT-08 | 上传图片/文件（`upload_type=chat-composer`，拖拽/粘贴）、@提及与 emoji 补全 | P1 |
| CHAT-09 | 发起私聊/群聊：`POST /chat/api/direct-message-channels`（`target_usernames[]` 为数组） | P1 |
| CHAT-10 | 频道成员、加入/离开/星标、通知设置（静音/级别） | P1 |
| CHAT-11 | 聊天搜索 | P1 |
| CHAT-12 | 输入中提示、在线状态（presence，尊重 `hide_presence`） | P2 |
| CHAT-13 | （预留）节点聊天频道：`GET /chat/api/channels?chatable_type=Category&chatable_id=` 查询节点绑定频道，存在则在节点侧栏显示 | P2 |

### 4.10 能量与签到（POINTS）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| PTS-01 | 能量余额：`current_user.gamification_score`，在用户条常驻显示；打赏、抽奖、红包、签到后刷新 | P0 |
| PTS-02 | **每日签到**：`POST /checkin`，必带 `X-Discourse-Checkin: true` 与每次不重复的 `X-Checkin-Nonce`（≥10 位）；成功返回获得能量；"今天已签到"返回 HTTP 200 + `success:false`。服务端无查询接口 → 按 `用户ID + 日期（Asia/Shanghai 或用户时区）` 本地记录今日状态 | P0 |
| PTS-03 | 签到提醒：每天首次打开时在用户条提示"今日未签到"。**不做自动签到**（风控插件会检测固定时间规律） | P0 |
| PTS-04 | 能量记录：`/u/{username}/points-history.json`（20 条/页，带正负） | P0 |
| PTS-05 | 能量转账（按信任等级限额 + 手续费） | P2 |
| PTS-06 | 购买能量、Solana 钱包、支付——跳系统浏览器 | P2 |

### 4.11 搜索（SEARCH）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| SEARCH-01 | 顶部全局搜索框（`Ctrl+F` 页面内，`Ctrl+Shift+F` 全站） | P0 |
| SEARCH-02 | 范围：全部（节点前 3 + 用户前 3 + 帖子）/ 节点 / 帖子 / 用户 / 应用 / 媒体；分页（`page` 最大 10） | P0 |
| SEARCH-03 | 历史记录（≤50，可删除/清空）；少于 2 个字不搜，输入防抖 | P0 |
| SEARCH-04 | 高级筛选 UI，映射为搜索语法：`#节点`、`tags:`、`@用户`、`before:`/`after:`、`status:`、`in:bookmarks/likes/posted`、`order:latest/likes/views`、`with:images` | P1 |
| SEARCH-05 | 结果关键词高亮 | P1 |

### 4.12 个人资料（PROFILE）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| PROF-01 | 自己的资料：头图、头像、名称、头衔（带样式）、flair、角色、信任等级、徽章、常去节点、简介、统计（能量/声望/主题/回复/账龄） | P0 |
| PROF-02 | 活动 Tab：主题 / 帖子 / 赞 / 书签 / 能量记录；分页（`user_actions.json` 的 `offset` + `limit` ≤100） | P0 |
| PROF-03 | 公开资料：关注/取消关注、发私信、发起私聊；拥有/管理的节点（`/node/by-user/{username}`）；公开自定义 Feed | P0（关注）/ P1 |
| PROF-04 | 用户悬停卡片（头像、头衔、统计、关注、私信、精华数、服务器数） | P1 |
| PROF-05 | 信任等级升级进度（`/u/{username}/upgrade-progress.json`）；粉丝/关注列表；排行榜 | P2 |

### 4.13 设置（SETTINGS）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| SET-01 | 客户端设置：主题（跟随系统/浅/深）、界面缩放、语言（简中/英文）、外链打开方式、开机自启、关闭窗口时最小化到托盘、代理、缓存清理 | P0 |
| SET-02 | 桌面通知：总开关 + 分类（回复与提及 / 点赞与回应 / 私信 / 聊天 / 能量与抽奖 / 系统）+ 勿扰时段 + 提示音 | P0 |
| SET-03 | 账户偏好 `user_option` 7 页（界面/通知/邮件/跟踪/隐私/其他/网页端）+ 插件偏好（`community_view_mode`、`boost_notifications_level`），修改即时保存、失败回滚 | P1 |
| SET-04 | 资料编辑：头像、背景图、昵称、简介、网站、地点、头衔、flair | P1 |
| SET-05 | 安全：改密邮件、2FA、登录设备管理、关联账户（敏感操作可跳网页，通过 OTP 带登录态） | P1 |
| SET-06 | 已授权应用管理：显示当前 key 信息，一键撤销 | P1 |
| SET-07 | 快捷键一览与自定义 | P2 |

### 4.14 应用目录与内置浏览器（APPS / WEB）

> 广告位暂不加入；日后需要时接口见附录 B.7。

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| APPS-01 | 应用目录：`/apps.json`（按 kind 分类，24 个/页）、详情（作者/版本/安装数/说明/权限说明/年龄分级）、查看讨论 | P1 |
| APPS-02 | 运行 webview 小程序：`/apps/installs/{id}/webview` **必须作为顶层页面加载**（CSP `frame-ancestors 'self'`），使用与论坛共享 Cookie 的分区（需先经 AUTH-07 OTP 建立会话）；独立窗口、不注入 preload、禁用 Node、限制导航与弹窗。前提：站点开启 `discourse_apps_webview_enabled`（默认关闭，§9.3） | P1 |
| APPS-03 | 权限说明文案：`kv`、`kv.shared`、`ui`、`points`、`realtime`、`schedule`、`post.read`、`notify`、`http` 等 | P1 |
| APPS-04 | 安装应用到个人/节点 | P2 |
| WEB-01 | 站内非原生页面（`/top`、安全密钥、节点管理、支付等）用内置浏览器打开，登录态通过 OTP 建立 | P0 |
| WEB-02 | 内置浏览器：地址栏只读、前进/后退/刷新、在系统浏览器打开、复制链接、缩放 | P0 |

### 4.15 桌面平台能力（DESKTOP）

| 编号 | 需求 | 优先级 |
|------|------|:---:|
| DESK-01 | 系统托盘：未读角标、快捷菜单（打开 / 收件箱 / 签到 / 暂停通知 / 退出）；关闭窗口时最小化到托盘 | P0 |
| DESK-02 | **系统通知**：基于 MessageBus `/notification-alert/{userId}`（含类型、话题标题、摘要、用户名、链接），点击深链；窗口聚焦时不弹；按设置分类过滤；同一时间窗口合并 | P0 |
| DESK-03 | 任务栏角标（overlay icon）、新消息闪烁任务栏 | P0 |
| DESK-04 | 单实例锁；`nodeloc://` 协议深链（授权回调 + 通用深链） | P0 |
| DESK-05 | 窗口状态记忆（位置/大小/最大化/分栏宽度） | P0 |
| DESK-06 | 自动更新（electron-updater + NSIS）：未签名时仍可用，但安装新版本可能再次触发 SmartScreen 提示；若上架 Microsoft Store 则由 Store 负责更新 | P1 |
| DESK-07 | 全局快捷键表（附录 A） | P1 |
| DESK-08 | 开机自启、拼写检查（中英） | P1 |
| DESK-09 | 多窗口（阅读器/聊天/撰写弹出） | P1 |
| DESK-10 | 离线：展示缓存内容，顶部横幅提示，恢复后自动重连；系统休眠唤醒后重建 MessageBus | P1 |

> 推送说明：discourse-mobile 的设备注册只接受 `android` / `ios`，桌面端不能复用 FCM 推送；桌面通知完全基于应用运行时的 MessageBus。应用未运行时不推送。

---

## 5. 非功能需求

| 类别 | 要求 |
|------|------|
| 请求量 | User API Key 默认限流 50 次/分钟、4000 次/天（MessageBus 轮询也计入）；**站点可按需调高，v1 不以此为设计约束**。仍需：① 主进程统一请求调度器（用户操作优先，去重与缓存）；② 一个 MessageBus 连接合并所有订阅；③ timings 30 秒一报、草稿防抖；④ 429 读取 `Retry-After` 与 `extras.wait_seconds` 退避，UI 提示"操作太频繁"；⑤ 开发版显示请求计数，便于评估站点需要的限流值 |
| 性能 | 冷启动首屏 ≤2s（有缓存）；信息流/回复树/聊天全部虚拟化；500+ 楼长帖滚动 ≥55fps；常驻内存 ≤400MB（单窗口）；后台时暂停动画与视频 |
| 安全 | `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`；preload 只暴露类型化 IPC；**User-Api-Key 永不进入渲染进程**；严格 CSP；`setWindowOpenHandler` 与 `will-navigate` 拦截；外链先校验协议再 `shell.openExternal`；cooked HTML 必须净化；小程序 webview 隔离；凭据用 `safeStorage` |
| 可靠性 | 用户主动操作失败必须 Toast（友好文案，不暴露状态码）；乐观更新失败回滚；后台请求失败静默；单个列表项解析失败不拖垮整页；**注意多个插件失败时 HTTP 仍为 200**（打赏、签到、抽奖开奖），必须读 body |
| 错误映射 | 401/403 → 需登录或无权限（`invalid_access` 时引导重新授权）；404 → 内容不存在；409 → 冲突（编辑/草稿/重复操作）；422 → 显示服务端 `errors[0]`（插件错误多为中文友好文案）；429 → 操作太频繁；5xx → 服务器开小差；Cloudflare 拦截（`cf-mitigated` 头，或 403 + HTML）→ 弹出验证窗口；断网 / 超时 / 解析失败分别给出文案 |
| 兼容 | Windows 10/11 x64；macOS 由 iOS 版覆盖；Linux 暂不发布 |
| 签名与分发 | 暂无代码签名证书，首发发布未签名的 NSIS 安装包——SmartScreen 会提示"未知发布者"，下载页需附"更多信息 → 仍要运行"说明。可选：上架 Microsoft Store（Store 负责签名与更新）；或后续接入 Azure Trusted Signing / OV/EV 证书（构建配置预留签名步骤，不影响代码） |
| 国际化 | 简体中文为主、英文为辅；所有文案走 i18n，不硬编码（iOS 版中英混杂是反例） |
| 无障碍 | 全键盘可达；`:focus-visible` 焦点环；尊重系统"减少动态效果"（加载动画静止、头衔特效静止）；图片 alt |
| 视觉 | **以 iOS `Theme.swift` 为准**：浅/深双套，品牌绿 `#009966` / `#26D99B`、橙 `#FF9933`；六边形品牌加载动画三种变体；桌面补充 hover、右键菜单、tooltip 状态 |
| 可观测 | 本地日志（主进程/渲染进程分文件，自动轮转）；开发版打印请求诊断（状态码/URL/cf-ray/限流余量/响应体前 200 字节）；可选崩溃上报（待确认） |

---

## 6. 技术方案建议

### 6.1 架构

```
┌─────────────────────────── Renderer (React) ───────────────────────────┐
│ Views ─ Zustand(UI状态: 布局/折叠/阅读模式) ─ TanStack Query(服务端状态) │
│                              │ window.nodeloc.api.* (typed IPC，无凭据)  │
└──────────────────────────────┼─────────────────────────────────────────┘
                     preload (contextBridge)
┌──────────────────────────────┼──────────── Main Process ────────────────┐
│ DiscourseClient(net.fetch + User-Api-Key) ── RequestScheduler(限流预算)   │
│ AuthService(RSA/nonce/协议回调/OTP/撤销)  ── 错误映射                     │
│ MessageBusClient(单连接, 多频道, Dont-Chunk, Logged-Out 检测) ── 广播到窗口│
│ NotificationService / Tray / Updater / DeepLink / WindowManager          │
│ Storage: electron-store(偏好/签到状态/位置) + userData/cache/*.json(快照)  │
│ Session partition 'persist:nodeloc'（OTP 建立的 Cookie，供内置浏览器/小程序）│
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 选型

| 层 | 选择 | 理由 |
|----|------|------|
| 脚手架/构建 | electron-vite + electron-builder | Vite 热更新；builder 负责 NSIS 打包与自动更新 |
| 语言 | TypeScript（strict） | API 字段怪癖多，需类型约束 |
| UI | React 19 + CSS 变量令牌 + Radix UI 原语 | 桌面交互组件完备，样式完全自控 |
| 服务端状态 | TanStack Query | 缓存/过期后后台刷新/无限分页/乐观更新与回滚 |
| UI 状态 | Zustand | 轻量，适合布局、折叠集合、阅读模式 |
| 路由 | React Router（memory） | 应用内历史与后退/前进 |
| 虚拟列表 | react-virtuoso | 不定高 + 反向（聊天）+ 滚动定位 |
| HTML | DOMPurify + html-react-parser；shiki/highlight.js；KaTeX；hls.js | 直接复用 DOM，替换交互节点 |
| 编辑器 | CodeMirror 6（Markdown）+ 预览复用渲染器 | 自动补全与快捷键扩展方便 |
| 校验 | zod（宽容解析） | 外层失败可观测，列表逐项容错 |
| i18n | i18next | |
| 图标 | Lucide（lucide-react） | |
| 测试 | Vitest（单元）+ Playwright for Electron（E2E） | |

### 6.3 关键决策

1. **网络请求只在主进程**：`net.fetch` + `User-Api-Key` 头。原因：MessageBus 的 CORS 允许头不含 `User-Api-Key`；凭据不应进入渲染进程；统一限流调度。
2. **认证 = User API Key**，不使用 Cookie 会话做 API 调用（不受 `_t` 轮换影响、无需 CSRF）。Cookie 会话仅在需要网页登录态时通过 OTP 在 `persist:nodeloc` 分区建立。
3. **MessageBus**：单连接合并订阅；请求头 `Dont-Chunk: true` 获得普通 JSON 数组；起始位置用接口返回的 `message_bus_last_id` 或 `-1`；错误退避（4s 起指数增长，429 读 `Retry-After`）；每次响应检查 `Discourse-Logged-Out`；窗口全部隐藏且无聊天打开时可降低订阅范围（仍保留通知频道）。
4. **Cloudflare 拦截**：检测到后在同一分区打开可见窗口让用户完成验证，然后重试；保持 User-Agent 一致（签到接口也要求正常浏览器 UA）。
5. **不引入数据库**（沿用 iOS 决策）：TanStack Query 内存缓存 + 聊天/节点目录磁盘 JSON 快照（保存服务端原始响应）。
6. **API 字段先抓真实响应再建模**；表单编码支持有序可重复键（`options[]`、`target_usernames[]`、`order[]`）；抽奖创建用 JSON body。
7. **功能开关驱动 UI**：`/mobile/meta` + `site.json` 设置决定插件入口是否显示。

---

## 7. 已知坑（必须遵守）

**继承自 iOS**

1. `POST /session` 恒返回 200（仅帐密兜底路径相关）。
2. Rails 枚举字段序列化为字符串：`text_size`、`title_count_mode`、`send_shortcut`、`default_calendar`。
3. `has_more` / `has_more_roots` 可能是 bool，也可能是 0/1。
4. `flair_url` 可能是图标名而非 URL。
5. `site.json` 约 800KB 且响应头禁止缓存 → 会话级缓存 + 合并并发请求。
6. 节点话题列表必须使用完整 `parent/child` slug 路径，否则 301。
7. 上传使用 `upload_type`（`type` 已废弃）；客户端限速 9 个/分钟。
8. `/apps/directory.json` 返回裸数组；聊天讨论串 limit ≤10、聊天搜索 limit ≤40。

**源码核对新增**

9. **聊天发送是 `POST /chat/{channelId}`**，不存在 `POST /chat/api/channels/{id}/messages`。
10. **登出要撤销 key**（`POST /user-api-key/revoke`）；`DELETE /session/{username}` 对 key 客户端无效。
11. **User API Key 需要 `write` scope** 才能 PUT/POST/DELETE（含 MessageBus 轮询、签到、草稿、timings）。
12. **MessageBus 遇到无效 key 静默降级为匿名**，不返回 403 → 检查 `Discourse-Logged-Out` 头。
13. **限流 50 次/分钟、4000 次/天**，MessageBus 轮询计入。
14. 赞踩用 `PUT /vote/posts/{id}`，不要直接调 reactions toggle；`heart` 就是核心 like；踩会移除 like；无 vote 字段 = 不可投票。
15. `votes` 列表（topic-voting）与赞踩分数无关。
16. 通知 `filter_by_types` 仅在 `recent=true` 时生效。
17. 草稿保存是 `POST /drafts.json`，`data` 是 JSON **字符串**；sequence 不符返回 409。
18. 发私信用 `target_recipients`（逗号分隔），不是 `target_usernames`。
19. `/hashtags/search.json` 的 `order` 必须是数组；emoji 列表来自 `/emojis.json`（site 中没有 `custom_emoji`）。
20. 搜索 `page` 最大 10；聊天消息 `page_size` 超过 50 会被静默截断；已读上报 `message_id` 必填。
21. 修订历史 `revision` 必须 ≥2。
22. 打赏、签到、抽奖开奖的失败返回 **HTTP 200 + `success:false`**；红包、抽奖参与失败为 422。
23. 签到必须带 `X-Discourse-Checkin: true` 与不重复 nonce；没有"今日是否已签到"查询接口。
24. 红包必须在话题只有 1 楼时创建；抽奖参与前必须已回复该话题；Boosts 路由必须带 `.json` 后缀。
25. `/n/{slug}` 是节点页，`/n/{slug}/{topicId}` 是嵌套回复；前者 JSON 返回 `{category, parent_category}`。
26. anyvideo 的 `hls_url` 在本地存储时是相对路径，需补站点域名；S3 预签名 URL 4 小时过期。
27. discourse-apps webview 页面 CSP 为 `frame-ancestors 'self'`，不能被 iframe 嵌入，且依赖 Cookie 会话。
28. discourse-mobile 设备注册只接受 android/ios；`.discourse-pin-post` 目录以点开头未被加载，置顶楼层由 discourse-community 提供。

**桌面特有**

29. `nodeloc://auth_redirect` 回调：已运行时从 `second-instance` 的 argv 读取，冷启动时从 `process.argv` 读取；开发模式注册协议时需传入 electron 可执行文件路径与入口脚本参数。
30. 回调 payload 是 `Base64.encode64`（每 60 字符含换行）后再 URL 编码。
31. 小程序 webview 不得获得 preload 或 Node 能力。

---

## 8. 版本规划

| 里程碑 | 周期 | 范围 | 验收 |
|------|------|------|------|
| **M0 地基** | 1–2 周 | 工程骨架、安全基线、IPC、DiscourseClient + 请求调度器 + 错误映射、设计令牌与基础组件、三栏布局外壳、托盘/单实例/窗口记忆、Windows 打包 | 设计系统画廊页；`latest.json` 拉通；NSIS 安装包可安装运行 |
| **M1 只读逛站** | 2–3 周 | 节点栏/浏览/节点页、信息流三种模式、阅读器 + 嵌套回复树 + 折叠、渲染器（RENDER-01~07、09~11 只读、HLS 视频）、看图、内置浏览器、搜索 | 游客可完整浏览；随机 50 帖渲染无异常 |
| **M2 账户与互动** | 2–3 周 | User API Key 授权（协议回调）、key 失效检测、登出撤销、**赞踩**、签到与能量余额、书签/回复/发主题/上传、打赏、抽奖参与、投票、阅读进度、资料页 | 授权登录成功；赞踩与 web 端交叉验证；统计一天正常使用的请求量，供站点设定限流 |
| **M3 消息与实时** | 2 周 | MessageBus 客户端、通知面板与系统通知、私信、聊天（快照/实时/乐观发送/讨论串/已读）、角标、未读跟踪 | 双端互发 ≤2s 可见；重启后聊天秒开；休眠唤醒后自动恢复 |
| **M4 正式版 P1** | 3–4 周 | 编辑/删除/草稿/补全/标签/举报、Boosts、隐藏内容与阅读权限、精华、红包/抽奖/投票创建、已加入与自定义 Feed、偏好与安全、OTP webview 登录态、应用目录、多窗口、自动更新、快捷键 | P1 清单全部通过；Windows 安装包与自动更新可用 |
| **M5+** | — | 多账户、presence、节点聊天频道、图片/视频编辑、能量转账、小程序 blocks 渲染、排行榜/升级进度 | |

---

## 9. 风险与问题

### 9.1 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| User API Key 默认日限流 4000 次 | 常驻客户端长轮询全天约 3,456 次，默认值下重度用户会触发 429 | 已确认站点可调高；上线前根据 M2 统计的请求量设定 `max_user_api_reqs_per_day` / `per_minute` |
| Windows 安装包未签名 | SmartScreen 警告降低安装转化，部分杀软误报 | 下载页说明；提交杀软白名单；后续接入 Azure Trusted Signing 或证书 |
| Cloudflare 对主进程请求误判 | 全站不可用 | 同分区验证窗口；保持 UA 一致；请求限速 |
| 协议回调未送达（浏览器拦截、其他程序占用 `nodeloc://`） | 无法登录 | 等待页提供重新打开浏览器与手动粘贴回调；P2 设备码登录 |
| 个别站点设置与默认值不同（`allow_user_api_key_scopes` 是否含 `one_time_password`、`discourse_apps_webview_enabled`、嵌套回复深度/默认排序） | OTP 登录态或小程序运行不可用 | 开发对应功能时用测试账号实测；不满足时降级为"在浏览器打开" |
| 插件无文档、失败语义不统一（200/422 混用） | 工期膨胀、错误提示不准 | 每个端点以源码为准写适配层与契约测试 |
| 小程序第三方代码 | 安全 | 独立窗口、无 preload、限制导航 |
| Electron 内存占用 | 常驻体验差 | 单窗口为主、弹出窗口按需创建、后台节流 |

### 9.2 已确认的决定（2026-09-13）

| 问题 | 决定 |
|------|------|
| 节点是否绑定聊天频道 | 目前没有，后续会有 → v1 预留扩展位 |
| 赞踩 | upvote 与 downvote **都使用表情回应**；"赞"即 `heart` reaction |
| 登录 | **User API Key**，回调地址 `nodeloc://auth_redirect`（站点已配置） |
| 平台与技术栈 | **仅 Windows**，Electron + React + TypeScript（评估过 WinUI 3、Tauri 2）；macOS 由 iOS 版覆盖 |
| 视觉 | **以 iOS 为准**（品牌绿） |
| 后端依据 | 以 `\\wsl.localhost\Ubuntu\var\discourse` 源码为准 |
| API Key 限流 | 站点可调高，**v1 暂不作为约束** |
| 插件启用 | 源码中盘点的插件**均已在线上启用** |
| 签名 | **无 Windows 代码签名证书**：首发未签名，可考虑 Microsoft Store 分发 |
| 广告 | **暂不加入** |

### 9.3 仍待确认的问题

1. **Klipy GIF key**：沿用 iOS 客户端内置的 key，还是单独申请？
2. **多账户**是否为刚需（影响凭据与 Cookie 分区设计）？
3. **图片编辑器 / 视频裁剪**是否保留？（建议 P2）
4. 是否需要崩溃/使用数据上报？（涉及隐私声明）
5. 版主与节点主理人功能是否需要原生支持？（建议跳转网页）
6. 视频封面 `{sha1}.png` 约定是否仍需要？（插件中未找到实现，anyvideo 会自行生成缩略图）

---

## 附录 A：快捷键草案

| 快捷键 | 作用 |
|------|------|
| `Ctrl+K` | 快速切换器 |
| `Ctrl+N` | 发新主题 |
| `Ctrl+Shift+F` | 全站搜索 |
| `Ctrl+F` | 页面内搜索 |
| `J` / `K` | 下 / 上一个话题或楼层 |
| `Enter` / `Esc` | 打开 / 关闭面板 |
| `A` / `Z` | 赞 / 踩 |
| `R` | 回复 |
| `B` | 书签 |
| `Alt+↑/↓` | 上 / 下一个聊天频道 |
| `Alt+Shift+↑/↓` | 上 / 下一个未读频道 |
| `Alt+←/→` | 后退 / 前进 |
| `Ctrl+,` | 设置 |
| `Ctrl+Enter` | 发送（撰写器） |

---

## 附录 B：接口目录（源码核对）

路径相对 `https://www.nodeloc.com`。源码路径相对 `\\wsl.localhost\Ubuntu\var\discourse\`。iOS 已验证且源码一致的端点（信息流、分类、话题、上传、偏好、安全等）见 `android-design/04-api-integration.md`，此处只列桌面端新增或修正的部分。

### B.1 认证（`app/controllers/user_api_keys_controller.rb`）

| 方法 路径 | 参数 | 返回 / 说明 |
|------|------|------|
| GET `/user-api-key/new` | `client_id`、`nonce`、`scopes`（逗号分隔）、`public_key`（PEM）、`application_name`、`auth_redirect`、`padding=pkcs1\|oaep`、可选 `expires_in_seconds` | 浏览器页面；同意后跳转 `auth_redirect?payload=`（+ `&oneTimePassword=`）。payload 解密为 `{key, nonce, push, api:4, expires_at?}`。同一 client 重新授权会删除旧 key |
| POST `/user-api-key/otp` | 头 `User-Api-Key`；`public_key`、`auth_redirect`、`application_name`、`padding` | `{redirect_url: "<auth_redirect>?oneTimePassword=<b64>"}`；解密得 32 位 hex，10 分钟有效 |
| GET → POST `/session/otp/{otp}` | 在 webview 中打开并提交表单 | 为该 Cookie 分区登录（`app/controllers/session_controller.rb:525-544`） |
| POST `/user-api-key/revoke` | 头 `User-Api-Key` | `{success:"OK"}`，撤销当前 key |
| POST `/user-api-key/device` → `/device/poll` | nonce、scopes、client_id、public_key、application_name | 设备码流程（P2 兜底） |

限流：每 key 50 次/分钟、4000 次/天（`config/discourse_defaults.conf:253-254`）；429 带 `Retry-After` 与 `error_type:"rate_limit"`、`extras.wait_seconds`。

### B.2 赞踩与 Boosts

| 方法 路径 | 参数 | 返回 / 说明 | 源码 |
|------|------|------|------|
| PUT `/vote/posts/{postId}.json` | `direction=up\|down\|none`、可选 `reaction` | 完整帖子 JSON（含 `vote_score`、`vote_count`、`vote_direction`、`can_vote_up/down`、`reactions`、`current_user_reaction`）；400/403/404/422/429 | `plugins/discourse-vote/app/controllers/discourse_vote/votes_controller.rb` |
| GET `/discourse-reactions/posts/{id}/reactions-users.json` | 可选 `reaction_value` | `{reaction_users:[{id, count, users:[...]}]}` | `plugins/discourse-reactions/.../custom_reactions_controller.rb:193` |
| GET `/discourse-reactions/posts/reactions.json?username=` / `reactions-received.json` | `before_reaction_user_id` | 用户给出/收到的回应，20 条/页 | 同上 |
| POST `/discourse-boosts/posts/{postId}/boosts.json` | `raw` | `{id, cooked, can_delete, user, ...}`；5 次/分钟 | `plugins/discourse-boosts/config/routes.rb` |
| DELETE `/discourse-boosts/boosts/{id}.json` | — | 204 | 同上 |

帖子字段：`vote_score`、`vote_count`、`vote_direction`、`can_vote_up`、`can_vote_down`、`boosts[]`、`can_boost`。列表项字段：`op_post_id`、`op_vote_score`、`op_vote_count`、`op_vote_direction`、`op_can_vote_up/down`、`op_reactions_data`。

### B.3 帖子、书签、草稿、举报、私信（核心）

| 方法 路径 | 参数 | 说明 |
|------|------|------|
| PUT `/posts/{id}.json` | `post[raw]`、`post[edit_reason]`、`post[original_text]`；主楼可带 `title`、`post[category_id]` | 409 编辑冲突 |
| GET `/posts/{id}/revisions/latest.json`、`/revisions/{n}.json` | n ≥ 2 | 修订历史 |
| DELETE `/posts/{id}` / PUT `/posts/{id}/recover` | | 有频率限制 |
| POST `/bookmarks` | `bookmarkable_id`、`bookmarkable_type=Post\|Topic\|Chat::Message`、`name`、`reminder_at` | `{success, id}`；帖子字段 `bookmarked`、`bookmark_id` |
| DELETE `/bookmarks/{id}` / PUT `/bookmarks/{id}` | | |
| POST `/post_actions` | `id`、`post_action_type_id`、`message`、`flag_topic="true"`（此时 `id` 为话题 id） | 举报；撤销 `DELETE /post_actions/{id}?post_action_type_id=` |
| GET `/drafts.json`（`offset`、`limit`≤50）/ GET `/drafts/{key}.json` | | |
| POST `/drafts.json` | `draft_key`、`data`（JSON 字符串）、`sequence`、`owner` | 409 sequence 冲突 |
| DELETE `/drafts/{key}.json?sequence=` | | |
| POST `/posts.json`（私信） | `title`、`raw`、`archetype=private_message`、`target_recipients` | |
| POST `/t/{id}/notifications` | `notification_level` 0–3 | |
| POST `/topics/timings` | `topic_id`、`topic_time`、`timings[postNumber]=ms` | |

### B.4 列表、标签、搜索、补全、通知、跟踪（核心）

| 方法 路径 | 参数 / 说明 |
|------|------|
| GET `/{latest,unread,new,unseen,top,read,posted,bookmarks,hot}.json`；`/c/{path}/l/{filter}.json` | `page`、`per_page`、`order`、`ascending` |
| GET `/votes.json` | topic-voting 话题投票排序（与赞踩无关） |
| GET `/tags.json`；`/tag/{slug}/{id}.json`（`/l/{filter}`） | 旧的 `/tag/{name}.json` 可能重定向 |
| GET `/search.json` | `q`、`page`（≤10）；语法见 SEARCH-04 |
| GET `/u/search/users.json` | `term`、`topic_id`、`category_id`、`include_groups`、`limit`≤50 |
| GET `/hashtags/search.json` | `term`、`order[]=category&order[]=tag&order[]=channel`（必填），最多 20 条 |
| GET `/emojis.json` | 按分组返回标准 + 自定义 emoji |
| GET `/notifications.json` | 分页：`offset`、`limit`≤60、`filter=read\|unread`；最近模式：`recent=true`、`filter_by_types`、`silent` |
| PUT `/notifications/mark-read` | 可选 `id`；不带则全部已读 |
| GET `/user_actions.json` | `username`、`filter`、`offset`、`limit`≤100 |
| GET `/u/{username}/topic-tracking-state.json` | 未读/新话题跟踪行（`session_info` scope 可用） |

### B.5 节点与 Feed（`plugins/discourse-community`，嵌套回复为核心）

| 方法 路径 | 参数 | 返回 / 说明 |
|------|------|------|
| GET `/nodes.json` | `limit`、`offset` | `{recommended, recommended_meta, grouped}` |
| GET `/node/browse/{parentId}.json` | `page`（从 0）、`per_page` | `{communities, meta}` |
| GET `/node/joined.json`、`/node/recently-visited.json`、`/node/my.json`、`/node/by-user/{username}.json` | | 节点列表 |
| POST `/node/join/{categoryId}` / DELETE `/node/leave/{categoryId}` | | 创建者不可退出（403） |
| POST `/node/{categoryId}/request-join` | `reason`（必填） | 409 已申请 |
| GET `/n/{slug}.json`、`/n/{slug}/landing.json` | | 节点信息 / 私有节点公开卡片 |
| POST `/node/create`、GET `/node/check-slug` | | 同 iOS，另可带 logo/背景 upload id |
| POST `/node/repost` | `topic_id`、`category_id`、`title`、`raw` | 10 次/小时，409 已转发 |
| GET `/joined.json` | `page`、`per_page`≤50 | 已加入节点的话题流 |
| GET `/featured.json`；`/c/{path}/l/featured.json` | | 精华话题（featured-topic） |
| GET/POST `/custom-feeds.json`；PUT/DELETE `/custom-feeds/{id}` | `name`、`description`、`private`、`show_on_profile` | 自定义 Feed 管理 |
| POST `/custom-feeds/{id}/nodes` / DELETE `/custom-feeds/{id}/nodes/{categoryId}` | `category_id` | ≤100 个节点 |
| GET `/custom-feeds/node-search.json?term=` | | 选节点 |
| GET `/f/{username}/{slug}.json` | `page` | Feed 话题流，30 条/页 |
| GET `/n/{slug}/{topicId}.json` | `sort=top\|hot\|new\|old`、`page` | 页 0：`topic`、`op_post`、`roots`、`has_more_roots`、`message_bus_last_id`、`pinned_post_ids`；每个节点带 `children`、`direct_reply_count`、`total_descendant_count` |
| GET `/n/{slug}/{topicId}/children/{postNumber}.json` | `sort`、`page`、`depth` | `{children, has_more, page}` |
| GET `/n/{slug}/{topicId}/{postNumber}.json` | `context` | 深链上下文链 |

### B.6 能量、签到、打赏、红包、抽奖

| 方法 路径 | 参数 | 返回 / 说明 | 源码 |
|------|------|------|------|
| POST `/checkin` | 同一会话先 GET `/session/csrf.json`，带 `X-CSRF-Token`（插件额外调用 `verified_request?`，User API Key 不能免除此检查）；头 `X-Discourse-Checkin: true`、`X-Checkin-Nonce`；body `nonce`、`timestamp` | `{success, points, user_date, timezone}`；已签到为 200 + `success:false`，其他保存失败也可能为 200，须区分 message | `plugins/discourse-checkin/app/controllers/discourse_checkin/checkin_controller.rb` |
| GET `/u/{username}/points-history.json` | `page` | `{points_history:[{date, points, description, is_positive}], has_more}` | `plugins/discourse-points-service` |
| POST `/reward/give` | `post_id`、`amount`、`note` | 失败为 200 + `{success:false, error}` | `plugins/discourse-reward/plugin.rb` |
| GET `/reward/post/{postId}` / DELETE `/reward/{id}` | | 打赏明细 / 撤回 | 同上 |
| POST `/red-envelopes` | `topic_id`、`total_points`、`total_count` | 422 `{errors}`（中文） | `plugins/discourse-red-envelope` |
| POST `/lottery/validate`、GET `/lottery/limits` | 同创建 body | 预校验 / 最小参与人数上限 | `plugins/lottery` |
| POST `/lottery` | JSON：`post_id`、`title`、`min_participants`、`max_participants`、`max_tickets_per_user`、`min_tickets_per_user`、`min_trust_level`、`draw_at`、`levels[]` | 仅作者/staff，一帖一个 | 同上 |
| POST `/lottery/{id}/participate` | `quantity`、`random` | 422 `{success:false, error}` | 同上 |
| POST `/lottery/{id}/draw` / `/close` | | 开奖（失败 200）/ staff 关闭退款 | 同上 |

### B.7 视频、应用、广告、功能开关

| 方法 路径 | 说明 |
|------|------|
| GET `/anyvideo/videos/by_sha1/{sha1}` | `{status: pending\|processing\|ready\|failed, hls_url, source_url, thumbnail_url, width, height, duration_seconds}`，无需登录 |
| GET `/apps.json?kind=&page=`、`/apps/{slug}.json` | 应用目录（24 个/页）/ 详情（`surface: blocks\|webview\|service`） |
| GET `/apps/installs/{id}/webview` | 顶层加载，需 Cookie 会话与 `discourse_apps_webview_enabled` |
| GET `/promotion/ads.json`；POST `/promotion/ads/{id}/click\|hide\|report` | 推广广告（暂不使用） |
| GET `/sideads` | 旧侧栏广告（暂不使用） |
| GET `/mobile/meta` | `{api_version, features:{checkin, points, lottery, red_envelope, apps, chat, ...}}` |

### B.8 聊天（`plugins/chat/config/routes.rb`）

| 方法 路径 | 参数 | 说明 |
|------|------|------|
| GET `/chat/api/me/channels` | | 频道 + tracking + `*_message_bus_last_id` |
| GET `/chat/api/channels/{id}/messages` | `page_size`≤50、`direction=past\|future`、`target_message_id`、`fetch_from_last_read`、`target_date` | `{messages, tracking, meta:{can_load_more_past, can_load_more_future}}` |
| **POST `/chat/{channelId}`** | `message`、`in_reply_to_id`、`thread_id`、`upload_ids[]`、`staged_id` | `{success, message_id}` |
| PUT `/chat/api/channels/{cid}/messages/{mid}` | `message`、`upload_ids[]` | 编辑 |
| DELETE `/chat/api/channels/{cid}/messages/{mid}`；PUT `.../restore` | | 删除 / 恢复 |
| PUT `/chat/{channelId}/react/{messageId}` | `emoji`、`react_action=add\|remove` | 表情回应 |
| POST `/chat/api/direct-message-channels` | `target_usernames[]`、`target_groups[]`、`name`、`upsert` | 发起私聊 |
| GET `/chat/api/channels/{cid}/threads`；GET `.../threads/{tid}/messages` | `limit`、`offset` | 讨论串 |
| PUT `/chat/api/channels/{id}/read` | `message_id`（必填） | 已读 |
| POST/DELETE/PUT `/chat/api/channels/{cid}/memberships/me`；PUT `.../notifications-settings/me` | | 加入/离开/星标、通知设置 |
| POST `/uploads.json` | `upload_type=chat-composer` | 聊天上传 |
| GET `/chat/api/channels?chatable_type=Category&chatable_id=` | | （预留）查询节点绑定频道 |

---

## 附录 C：MessageBus 订阅方案

- 端点：`POST /message-bus/{clientId}/poll`（主进程，头 `User-Api-Key`、`Dont-Chunk: true`），body 为 `{频道: 最后ID, ...}`；长轮询 25 秒。
- 按场景订阅：

| 频道 | 何时订阅 | 用途 / 载荷 |
|------|------|------|
| `/notification/{userId}` | 登录后常驻 | 未读通知总数、高优先级未读、私信数、最近通知 |
| `/notification-alert/{userId}` | 登录后常驻 | 系统通知：`notification_type`、`topic_title`、`excerpt`、`username`、`post_url` |
| `/new`、`/latest`、`/unread`、`/unread/{userId}`、`/recover`、`/delete`、`/destroy` | 登录后常驻（或打开信息流时） | 新话题提示、节点未读、已读/忽略同步 |
| `/chat/user-tracking-state/{userId}`、`/chat/bulk-user-tracking-state/{userId}`、`/chat/new-channel` | 登录后常驻 | 聊天未读与提及 |
| `/chat/{channelId}/new-messages` | 已加入频道 | 频道新消息提示 |
| `/chat/{channelId}` | 打开会话时 | 消息 sent/edit/delete/reaction/thread_created… |
| `/chat/{channelId}/thread/{threadId}` | 打开讨论串时 | 讨论串内事件 |
| `/topic/{topicId}`、`/topic/{topicId}/reactions` | 打开话题时 | 新回复、编辑、删除、like、boost、赞踩变化（事件不含分数，需重拉） |
| `/discourse-presence/reply/{topicId}` | 打开话题时（P2） | 正在回复 |

- 起始 ID：优先用接口返回的 `message_bus_last_id` / 聊天的 `*_message_bus_last_id`，否则 `-1`（服务端回 `/__status` 校准）。
- 每次响应检查 `Discourse-Logged-Out` 头；429 读 `Retry-After`；网络错误指数退避；系统唤醒后立即重连。
