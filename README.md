# NodeLoc Desktop

NodeLoc 社区（nodeloc.com）的 Windows 桌面客户端。Electron + React + TypeScript，形态为 Discord × Reddit：左侧常驻节点栏、Reddit 式信息流与嵌套回复树、实时聊天与系统通知。

需求与接口说明见 [docs/requirements.md](docs/requirements.md)。

## 开发

需要 Node.js 22+（LTS）。

```powershell
npm install
npm run dev          # 启动开发版（热更新）
npm run typecheck    # 主进程 + 渲染进程类型检查
npm run build        # 构建到 out/
npm run package      # 构建并打包 Invox 现代 Windows 安装器到 release/
```

Windows 安装器使用项目内的 `invox/` 源码构建，需要 Visual Studio 2022 C++ Build Tools（含 ATL）和 7-Zip。`npm run package:nsis` 仍可用于生成传统 NSIS 安装包。

如果启动时报 `Cannot read properties of undefined (reading 'isPackaged')`，说明当前终端继承了 `ELECTRON_RUN_AS_NODE=1`（常见于由 VS Code 扩展启动的终端），Electron 被当成普通 Node 运行。先清掉再启动：

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; npm run dev
```

开发版默认不注册 `nodeloc://` 协议（避免把系统协议指向开发中的 Electron）。需要调试授权回调时：

```powershell
$env:NODELOC_REGISTER_PROTOCOL = '1'; npm run dev
```

## 功能概览

- **浏览**：信息流（紧凑 / 展开 / 卡片）、节点目录与节点页、嵌套回复阅读器（投票、抽奖、红包、隐藏内容、视频、公式、灯箱）、搜索、个人主页、应用目录、自定义 Feed 管理。
- **账户**：User API Key 登录（`nodeloc://auth_redirect`），签到；应用内浏览器通过一次性密码（OTP）自动登录网页端。
- **互动**：赞 / 踩（表情回应）、收藏、打赏、助力、付费解锁、举报、精华、编辑历史、删除与恢复。
- **发帖**：回复停靠栏与发帖对话框、编辑帖子、私信；Markdown 预览、上传、@ / : / # 自动补全、标签、服务器草稿；投票 / 抽奖 / 红包 / 隐藏内容 / 阅读权限。
- **实时**：MessageBus 长轮询；Windows 通知与任务栏角标、收件箱、话题新回复提示、聊天（频道、私聊、线程、回应）。
- **桌面**：设置页（通知分类、托盘、开机启动）、快捷键（`?` 查看）、Ctrl+K 快速切换、话题弹出独立窗口。

## 目录

```
src/
  main/        主进程：窗口、托盘、单实例、深链、IPC、Discourse API 客户端与请求调度
  preload/     contextBridge，向渲染进程暴露 window.nodeloc
  shared/      主进程与渲染进程共用的类型和常量（IPC 契约、API 错误、站点地址）
  renderer/    React 界面
    src/
      api/         IPC 请求封装、TanStack Query、Discourse 类型
      components/  基础组件（按钮、头像、骨架屏、空状态、Toast、品牌加载动画）
      features/    功能模块（feed、vote、gallery…）
      layout/      三栏布局：标题栏、节点栏、侧栏、详情面板
      i18n/        文案（zh-CN 为源，en 为译文）
      styles/      设计令牌（与 iOS Theme.swift 逐值对齐）
resources/     应用与托盘图标
```

## 约定

- **网络请求只在主进程发出**：渲染进程通过 `window.nodeloc.api.request()` 调用，User API Key 永远不进入渲染进程。
- 渲染进程运行在 `sandbox` + `contextIsolation` 下，CSP 禁止外部脚本与网络连接。
- 用户可见文案全部走 i18n；API 错误以 `kind` 分类，由界面翻译成友好文案，不展示状态码。
- 开发版左侧节点栏有"设计系统"入口，展示全部令牌与基础组件，改动视觉时先在这里核对浅色/深色两种主题。

## 许可证

NodeLoc Desktop 使用 [MIT License](LICENSE) 发布。`invox/` 及其他目录中包含的第三方组件继续适用其各自附带的许可证。
