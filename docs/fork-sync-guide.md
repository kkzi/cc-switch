# Fork Sync Guide

本文档只记录当前工作区相对 `upstream/main` 的真实代码差异，用于后续同步时的参考和约束。

## 1. 基线

- 对比命令: `git diff upstream/main`
- 当前状态: fork 相对 upstream `behind 0 / ahead 90 commits`（同步 `upstream/main` 至 `5fd3ec0d` 后）
- 当前 diff 规模: `158 files changed, 10845 insertions(+), 2240 deletions(-)`
- 不纳入本文档:
  - 未跟踪文件
  - 口头约定
  - README 中未被代码证实的描述

同步前后都应重新跑一次 diff，再更新本文档。

## 2. 当前差异总览

当前 fork 的主要差异集中在以下几组：

1. 发布流程、版本元数据、updater 地址
2. 主窗口运行时创建、托盘左键切换、隐藏后延迟销毁
3. provider health / speedtest 元数据扩展
4. OpenAI 兼容模型拉取能力
5. Provider 列表/卡片交互、最近测试反馈与 tooltip 行为
6. Provider 新增表单体验、剪贴板导入、Codex custom 配置标准化
7. App shell、Settings、Usage 页面布局与动效取舍

结论上，当前 fork 已不存在以下高误判风险的历史差异：

- `forkdb` 附加库与 provider 镜像写入
- 模型级路由 / 模型级故障转移队列

## 3. 已确认的实际差异

### 3.1 仓库、发布与版本配置

主要文件:

- `.github/workflows/fork-release.yml`
- `.github/workflows/portable-release.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/bin/export_providers.rs`
- `README_EN.md`

从代码可确认：

- fork 维护独立 release workflow，而不是直接复用 upstream 发布流程
- `package.json` 固定了 `packageManager`
- 所有 GitHub workflow 使用 `pnpm/action-setup@v6`，且不再在 workflow 中声明 pnpm `version`
- pnpm 版本只允许由 `package.json#packageManager` 作为唯一来源；不要同时在 action `with.version` 中再写一个版本
- `Cargo.toml` 启用了 `custom-protocol` 默认特性，并额外引入 `rand`
- `src-tauri/src/bin/export_providers.rs` 提供了一个独立的辅助 bin；Windows release 构建后会同时产出 `cc-switch.exe` 和 `export_providers.exe`
- `tauri.conf.json` 取消静态 `windows` 配置，改成运行时动态创建主窗口
- fork 关闭了 `createUpdaterArtifacts`
- updater endpoint 指向 fork 自己的 GitHub release

同步约束：

- 不要直接用 upstream workflow 覆盖 fork 的发布配置
- `package.json`、`Cargo.toml`、`tauri.conf.json` 合并时必须人工核对
- 不要重新引入 `pnpm/action-setup` 的 `version` 字段，否则会与 `packageManager` 触发 “Multiple versions of pnpm specified”
- backend CI 使用 `cargo fmt --check` 与 `cargo clippy -- -D warnings`；同步后必须先修掉格式和 Clippy warning 再推送
- 不要误删 `src-tauri/src/bin/export_providers.rs` 或把多 bin release 产物当成异常构建结果
- 动态窗口策略和 updater 地址不能被误回滚

### 3.2 主窗口与托盘生命周期

主要文件:

- `src-tauri/src/main_window.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/store.rs`
- `src-tauri/src/tray.rs`
- `src-tauri/tauri.conf.json`

从代码可确认：

- fork 新增 `main_window.rs`，主窗口改为运行时创建，而不是在 `tauri.conf.json` 里静态声明
- 关闭主窗口时采用“先隐藏，再在 3000ms 后销毁 webview”的生命周期
- `AppState` 新增 `main_window_destroy_generation`，用于取消过期的延迟销毁任务
- 托盘左键点击不再弹菜单，而是切换主窗口显示/隐藏
- 托盘中显式的 `lightweight mode` 菜单项被隐藏，但底层兼容逻辑仍保留
- 静默启动时不会强制创建主窗口

同步约束：

- upstream 若改 `lib.rs`、`tray.rs`、window lifecycle，不应直接覆盖
- 合并时需优先保留：
  - `main_window.rs`
  - `toggle_main` 行为
  - `hide_then_schedule_main_window_destroy()` 的延迟销毁逻辑
  - 静默启动下“跳过窗口创建”的分支

### 3.3 Provider health 与 speedtest 元数据扩展

主要文件:

- `src-tauri/src/database/mod.rs`
- `src-tauri/src/database/schema.rs`
- `src-tauri/src/database/tests.rs`
- `src-tauri/src/database/dao/providers.rs`
- `src-tauri/src/provider.rs`
- `src-tauri/src/commands/provider.rs`
- `src-tauri/src/services/speedtest.rs`
- `src/lib/api/vscode.ts`
- `src/types.ts`

从代码可确认：

- 主库 schema 版本是 `11`
- `provider_health` 表新增 `last_check_status`
- 增加了 `v10 -> v11` 迁移与回归测试
- `ProviderMeta` 新增 `lastSpeedtest`
- 新增 `SpeedtestResult` 结构和 `save_speedtest_result` 命令
- `save_speedtest_result` 的 Tauri 参数形状是 `{ app, providerId, result }`，其中 `result` 使用 camelCase 字段序列化到 Rust `SaveSpeedtestResultInput`
- `update_speedtest_result()` 会把测速结果回写到 `providers.meta.lastSpeedtest`
- `SpeedtestService` 对非 2xx 响应不再一律当作成功测速，而会保留 HTTP 错误信息

同步约束：

- upstream 若改 provider health、schema migration 或 speedtest 行为，必须人工合并
- `ProviderHealth.last_check_status` 和 `ProviderMeta.lastSpeedtest` 不能被回滚掉
- `src/lib/api/vscode.ts` 调用 `save_speedtest_result` 时必须保持嵌套 `result` 参数，不要恢复成一组顶层参数
- `stream_check` 对 provider health 的持久写回不能被回滚掉

### 3.4 OpenAI 兼容模型拉取能力

主要文件:

- `src-tauri/src/services/provider/models.rs`
- `src-tauri/src/commands/provider.rs`
- `src/lib/api/providers.ts`
- `src/components/ui/model-suggest.tsx`

从代码可确认：

- fork 新增 `fetch_provider_models_openai`
- 支持对 OpenAI 兼容端点依次尝试：
  - `/v1/models`
  - `/models`
- 返回结果包含：
  - `models`
  - `resolvedUrl`
  - `elapsedMs`
  - `warnings`
- 模型列表会去重并按 id 排序
- 前端已接入这条链路，而不是只保留静态输入框

同步约束：

- upstream 若改 provider command、模型选择 UI、相关 API wrapper，需要保留当前模型拉取链路
- `src/components/ui/model-suggest.tsx` 是同步热点

### 3.5 Proxy / Failover 的当前状态

主要文件:

- `src-tauri/src/proxy/provider_router.rs`
- `src-tauri/src/proxy/forwarder.rs`
- `src-tauri/src/proxy/server.rs`
- `src-tauri/src/proxy/types.rs`
- `src-tauri/src/database/dao/proxy.rs`
- `src/components/proxy/AutoFailoverConfigPanel.tsx`
- `src/types/proxy.ts`

从代码可确认：

- 当前 router 仍是按 `app_type` 维度选择 provider
- 这组 diff 里没有现行的“模型级路由队列”或“模型级 failover queue”实现
- `ActiveTarget` 新增兼容字段 `model_key?: Option<String>`，当前服务端填充为 `None`
- `ProviderHealth` 新增 `last_check_status`
- 前端依赖 `last_check_status` 展示最近测试状态
- `AutoFailoverConfigPanel` 仅增加了锚点与滚动定位 id，不是新的 failover 模式

同步约束：

- upstream 若改 proxy 类型或 health 返回结构，要保留：
  - `ActiveTarget.model_key`
  - `ProviderHealth.last_check_status`
- 但不要再把“模型级路由/模型级故障转移”视为当前 fork 必保能力

### 3.6 Provider 列表、卡片与测试反馈交互

主要文件:

- `src/components/providers/ProviderList.tsx`
- `src/components/providers/ProviderCard.tsx`
- `src/components/UsageFooter.tsx`
- `src/components/ProviderIcon.tsx`
- `src/hooks/useStreamCheck.ts`
- `tests/components/ProviderCard.test.tsx`
- `tests/components/ProviderList.test.tsx`

从代码可确认：

- `useStreamCheck` 不再直接靠 toast 表达测试结果，而是维护最近一次测试结果缓存
- 最近测试结果会在 5 秒内驱动卡片状态与 tooltip
- recent tooltip 只会自动打开一次，未悬停时 5 秒后自动隐藏
- 搜索过滤、0 结果再清空、或其它列表重挂载场景中，已有的旧 `recentTestResult` 不应在卡片首次挂载时自动弹出 tooltip
- `ProviderList` 通过 `suppressInitialRecentTooltip` 抑制重挂载旧结果；真正新的测试结果仍应自动弹出
- `last error` / recent test tooltip 在显示期间如果触发滚动，会立即隐藏，而不是继续停留到超时
- icon 边框状态基于：
  - `recentTestResult.status`
  - 或 `health.last_check_status`
- tooltip 不是固定 recent 优先，而是会在以下两者之间按时间取最近一条：
  - `recentTestResult.message` + `testedAt`
  - `provider_health.last_error` + `last_failure_at`（无则退回 `updated_at`）
- 单个 / 批量 stream check 结果现在会持久写回 `provider_health.last_error` 与 `last_check_status`
- card 左侧 icon tooltip 对 HTTP 错误不再只显示摘要，会把错误正文解析成更可读的多行格式
- tooltip 第一行会添加时间前缀，格式为 `YYYY-MM-DD HH:mm:ss <status> <title>`
- 若 `last_error` / recent test message 中包含 JSON 字符串或转义换行（如 `\\n`），tooltip 会优先提取：
  - `error.message`
  - `error`（当其本身就是字符串）
  - `message`
  若都不存在，则显示解码后的原文
- Codex stream check 对首个候选 URL 返回 `text/html` 时会自动 fallback 到备用 `/v1/responses`
- stream check 的 HTTP 错误 message 不再只保留状态码，而是会附带响应体摘要
- provider card 第二行采用紧凑布局：
  - 长 URL 单行截断为 `...`，但 hover/title 与点击打开仍使用完整 URL
  - 多套餐入口使用无 padding 的低高度文本样式
  - 余额查询失败态与成功态的内联控件都避免额外 border / padding
- 卡片支持：
  - 双击触发主操作
  - 右键菜单
  - 复制连接信息
  - 一键置顶
  - 一键置底
- `ProviderList` 维护 context menu、快速排序、搜索框和 recent test result 透传
- `extractProviderConnectionInfo()` 负责从不同 app 的配置结构中抽取 `baseUrl + apiKey`

同步约束：

- `ProviderList.tsx`、`ProviderCard.tsx`、`useStreamCheck.ts` 是高冲突区
- `UsageFooter.tsx` 也应视为 provider card 内联布局的一部分，不要当作独立的普通 usage 组件随意回滚
- `src-tauri/src/services/stream_check.rs`、`src-tauri/src/commands/stream_check.rs` 也应纳入这一组热点文件
- 这部分不只是样式改动，依赖真实 health 字段、错误消息格式与交互状态，不能按纯 UI 补丁处理
- upstream 若修改 stream check 成功/失败判定，必须人工复核以下 fork 规则：
  - `text/html` 不能被当作 Codex Responses 成功响应
  - 根地址 `/responses` 返回 HTML 时要继续尝试 `/v1/responses`
  - tooltip / recent result message 需要保留状态码之外的错误正文
  - tooltip 在显示期间遇到任意滚动事件时需要立即关闭
  - tooltip 需要比较 `testedAt` 与 `last_failure_at / updated_at`，而不是固定 recent 优先
  - 过滤/恢复 provider list 时不能重放旧 `recentTestResult` tooltip
  - 测试按钮触发的 stream check 结果需要持久写回 `provider_health`
  - `ProviderCard` tooltip 需要把 `Auth rejected (401): {...}` 一类错误整理成带时间前缀的多行可读文本，而不是只显示摘要前缀

### 3.7 Provider 新增表单、预设交互与剪贴板导入

主要文件:

- `src/App.tsx`
- `src/components/providers/AddProviderDialog.tsx`
- `src/components/providers/forms/ProviderForm.tsx`
- `src/components/providers/forms/ProviderPresetSelector.tsx`
- `src/components/providers/forms/CodexConfigEditor.tsx`
- `src/components/providers/forms/CodexConfigSections.tsx`
- `src/components/providers/forms/CodexFormFields.tsx`
- `src/config/codexProviderPresets.ts`
- `src/config/codexTemplates.ts`
- `src/utils/addProviderInitialData.ts`
- `src/utils/providerClipboard.ts`
- `src/utils/providerConfigUtils.ts`
- `src/utils/providerName.ts`

从代码可确认：

- `App.tsx` 支持在 provider 页通过 `Ctrl/Cmd + V` 读取剪贴板并直接打开新增 provider
- 新增：
  - `extractProviderDraftFromClipboard()`
  - `buildAddProviderInitialData()`
  - `resolveProviderName()`
- 剪贴板导入会根据 app 类型生成不同初始配置
- `ProviderPresetSelector` 改成了“首行展示 + 展开/收起”
- 新增 `normalizeCodexCustomProviderConfig()`
- Codex custom provider 统一规范到 `[model_providers.custom]`
- 这条规范化不只发生在新建模板初始值；`ProviderForm` 的 Codex 保存提交路径也会在序列化前强制把 `model_provider`、`[model_providers.*]` 和 provider `name` 归一到固定的 `custom`
- `ProviderService::create` 对新增 provider 的默认插入位置做了 fork 定制：
  - 空列表插到第 1 个
  - 非空列表默认插到第 2 个

同步约束：

- provider 表单与 preset 相关文件属于高频冲突区
- upstream 若改 Codex 表单结构、preset 组织或新增 provider 流程，需要整体复核
- upstream 若改 `ProviderForm.tsx` 的 Codex 提交逻辑，不要把“保存时强制归一化 custom provider section”的 fork 行为回滚掉
- 新增 provider 默认插入第 2 位的行为不要被无意回滚

### 3.8 App Shell、Settings、Usage 与样式层

主要文件:

- `src/App.tsx`
- `src/App.tsx.fork`
- `src/components/common/FullScreenPanel.tsx`
- `src/components/UsageFooter.tsx`
- `src/components/settings/SettingsPage.tsx`
- `src/components/settings/WindowSettings.tsx`
- `src/components/usage/UsageDashboard.tsx`
- `src/components/UpdateBadge.tsx`
- `src/index.css`
- `src/components/ui/button.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/tabs.tsx`
- `vite.config.ts`
- `vitest.config.ts`

从代码可确认：

- `App.tsx` 移除了页级 `framer-motion` 过渡
- `src/App.tsx.fork` 是当前 fork 中跟踪的 App shell 副本，不参与常规 TypeScript glob 构建；同步时不要把它误认为 upstream 源文件自动覆盖，也不要在未确认用途前删除
- header 高度改为 `56px`
- 顶部壳层、按钮尺寸、面板间距做了 fork 定制
- `AddProviderDialog` 现在接收 `initialData`
- usage summary 卡片动画被移除
- Settings 页结构、WindowSettings、About 区块都有明显 fork 定制
- Settings / Skills / Prompts / MCP / Sessions 等页面已统一外层面板 padding
- Settings 高级页底部操作区采用“外层 top border 拉通主面板宽度，内层按钮区再对齐内容区”的显示逻辑
- 余额查询（`templateType === "balance"`）在 provider card 内联区域使用独立的紧凑布局，而不是复用通用用量布局
- 余额查询操作按钮改为无 padding 的文本按钮；中文文案缩短为 `查询`
- 余额内联区只保留最小控件：余额数值、可截断单位、小尺寸时间图标与文本按钮，避免撑大 provider card
- provider card URL 行使用单行截断和固定上限宽度，避免长 endpoint 把卡片高度顶高
- 多套餐展开入口也改成和余额内联态接近的低高度文本节奏
- 一部分 UI primitive 与构建配置也有差异

同步约束：

- upstream 若改 `App.tsx`、settings shell、usage 页面，这里冲突概率很高
- 若 `App.tsx` 被大幅合并，必须同时决定是否同步更新 `App.tsx.fork`；不要让它长期停留在过期状态
- 合并时重点回看：
  - header 结构
  - add provider 打开逻辑
  - clipboard import
  - usage 页面无进入动画
  - 统一面板 padding 不被回滚
  - Settings 高级页底部保存栏的“满宽分隔线 + 内容区对齐”逻辑不被回滚

## 4. 历史澄清

以下能力曾出现在 fork 历史或旧文档中，但当前代码已不存在，不应在同步 upstream 时尝试保留：

- `forkdb` 附加库与 provider 镜像写入
- 模型级路由 / 模型级故障转移队列

如果未来 fork 再次引入类似能力，应以当时代码为准重新写文档，不要沿用旧描述。

## 5. 同步热点文件组

### 5.1 第一优先级

- `src-tauri/src/main_window.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/store.rs`
- `src-tauri/src/tray.rs`
- `src-tauri/tauri.conf.json`

### 5.2 第二优先级

- `src-tauri/src/database/mod.rs`
- `src-tauri/src/database/schema.rs`
- `src-tauri/src/database/tests.rs`
- `src-tauri/src/database/dao/providers.rs`
- `src-tauri/src/provider.rs`
- `src-tauri/src/commands/provider.rs`
- `src-tauri/src/services/speedtest.rs`
- `src-tauri/src/services/provider/models.rs`
- `src-tauri/src/services/stream_check.rs`
- `src-tauri/src/commands/stream_check.rs`
- `src/lib/api/providers.ts`
- `src/lib/api/vscode.ts`
- `src/types.ts`
- `src/components/ui/model-suggest.tsx`

### 5.3 第三优先级

- `src/components/providers/ProviderList.tsx`
- `src/components/providers/ProviderCard.tsx`
- `src/components/UsageFooter.tsx`
- `src/hooks/useStreamCheck.ts`
- `src/components/providers/forms/ProviderForm.tsx`
- `src/components/providers/forms/ProviderPresetSelector.tsx`
- `tests/components/ProviderCard.test.tsx`
- `src/utils/addProviderInitialData.ts`
- `src/utils/providerClipboard.ts`
- `src/utils/providerConfigUtils.ts`
- `src/utils/providerName.ts`
- `src/App.tsx`

### 5.4 第四优先级

- `.github/workflows/fork-release.yml`
- `.github/workflows/portable-release.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/src/bin/export_providers.rs`
- `README_EN.md`
- `src/components/settings/SettingsPage.tsx`
- `src/components/settings/ProxyTabContent.tsx`
- `src/components/skills/SkillsPage.tsx`
- `src/components/skills/UnifiedSkillsPanel.tsx`
- `src/components/prompts/PromptPanel.tsx`
- `src/components/mcp/UnifiedMcpPanel.tsx`
- `src/components/sessions/SessionManagerPage.tsx`
- `src/components/common/AppCountBar.tsx`
- `src/App.tsx.fork`

## 6. 建议同步顺序

1. 先 fetch/merge upstream。
2. 先处理主窗口、tray、`tauri.conf.json` 冲突。
3. 再处理数据库 schema、provider health、speedtest、model fetch、stream check。
4. 再处理 `App.tsx`、ProviderCard/List、ProviderForm、preset selector。
5. 再处理 Settings / Skills / Prompts / MCP / Sessions 的面板布局和底部操作栏。
6. 最后处理 workflow、文档、README 与测试。
7. 推送前至少跑一轮与 CI 对齐的格式、Clippy、前端类型检查和单测。

## 7. 同步后最少回归项

### 7.1 主窗口 / Tray

- 托盘左键切换主窗口显示/隐藏
- 主窗口隐藏后 3 秒延迟销毁
- 静默启动时不强制创建窗口
- 显式 lightweight mode 菜单项仍保持隐藏

### 7.2 Provider 数据链

- `ProviderHealth.last_check_status` 能返回前端
- stream check 结果会持久写入 `provider_health.last_error / last_check_status`
- speedtest 结果能写入 `meta.lastSpeedtest`
- OpenAI 兼容模型拉取链路可用
- 新增 provider 默认插入第 2 位

### 7.3 Provider UI 交互

- recent test result 能驱动 icon 边框颜色
- tooltip 会在 recent test message 和 `last_error` 之间按时间选最近一条
- recent tooltip 自动显示并在 5 秒后消失
- recent tooltip 未悬停时只自动显示一次，不会重复弹出
- `last error` / recent tooltip 显示期间一旦列表或容器发生滚动，应立即隐藏
- Codex 测试遇到 `200 + text/html` 时会继续尝试 fallback URL，而不是误判成功
- error tooltip / recent test tooltip 需要显示状态码之外的错误正文
- `Auth rejected (401): {...}` 这类错误会在 tooltip 中整理成带 `YYYY-MM-DD HH:mm:ss` 前缀的多行可读文本
- JSON 里的 `error` 如果本身是字符串，也会被提取出来显示
- 长 URL 在 provider card 中保持单行 `...` 截断，但点击仍能打开完整 URL
- 双击卡片触发主操作
- 右键菜单可复制连接信息、置顶、置底

### 7.4 Provider 表单与辅助能力

- `Ctrl/Cmd + V` 能从剪贴板打开新增 provider
- clipboard draft 能生成正确的初始配置
- Codex custom provider 在新增初始值和保存提交时都会标准化到 `[model_providers.custom]`

### 7.5 App Shell / Settings / Usage

- header 布局与按钮尺寸正常
- Add Provider 的 `initialData` 注入正常
- usage 页面无页级进入动画
- balance inline controls 保持紧凑，不应因时间文本或按钮 padding 撑大 provider card
- 多套餐入口保持低高度文本按钮风格，不应因 hover 背景或 padding 撑大 provider card
- settings 页面结构与窗口设置项正常
- Skills / Prompts / MCP / Sessions 与 Settings 页的外层 padding 保持一致
- Settings 高级页底部操作区的 top border 贯穿主面板宽度
- Settings 高级页保存按钮右边界与内容区右边界对齐

### 7.6 CI / Tooling

- `pnpm/action-setup` workflow 中没有 `version` 字段
- `package.json#packageManager` 是唯一 pnpm 版本来源
- `pnpm format:check` 覆盖 `src/**/*.{js,jsx,ts,tsx,css,json}` 并通过
- `pnpm typecheck` 通过
- `pnpm test:unit` 通过
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml` 通过
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` 通过
- `cargo test --manifest-path src-tauri/Cargo.toml --bin export_providers` 通过
- Windows 本地完整 `cargo test --manifest-path src-tauri/Cargo.toml` 可能受 WebView2 / proc-macro metadata 和锁定的 `target/release/deps/cc_switch.exe` 影响；CI 是 Ubuntu runner，判断 CI 风险时优先看 Linux 依赖、`fmt`、`clippy -D warnings` 和具体失败日志

## 8. 文档维护规则

以后更新本文档时，必须遵守：

1. 先运行 `git diff upstream/main`。
2. 只写当前代码中真实存在的差异。
3. 若某项差异已被 upstream 吸收或 fork 已删除，应从本文档移除。
4. README、旧 issue、旧设计稿不能替代代码事实。
5. 对“是否仍属于 fork 差异”不确定时，优先检查：
   `main_window.rs`、`tray.rs`、`database/schema.rs`、`provider.rs`、`services/provider/models.rs`、`App.tsx`、`ProviderList/Card`。
