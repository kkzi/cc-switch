# Ctrl+V 快捷新增供应商设计

## 背景

当前主窗口中的供应商新增流程需要用户手动点击新增按钮，再分别填写供应商名称、API 地址和 API Key。对于用户已经复制了一段包含 API 地址和 API Key 的文本场景，这个流程有明显重复输入。

本次改动增加一个仅在供应商列表页生效的快捷操作：当主窗口位于供应商列表页，且当前焦点不在可编辑输入区域时，按下 `Ctrl+V`（macOS 同时兼容 `Cmd+V`）会从剪贴板中提取供应商信息并直接打开新增供应商面板，完成预填。

## 目标

- 仅在 `providers` 视图生效
- 不干扰输入框、文本域、下拉框和 contenteditable 元素的正常粘贴
- 从剪贴板文本中提取：
  - 第一个合法 `http://` 或 `https://` URL 作为 API 请求地址
  - 除 URL 外的第一个连续 token 作为 API Key
- 自动预填：
  - 供应商名称：URL 的 domain
  - API 地址：提取到的 URL
  - API Key：提取到的 token
- 复用现有新增供应商面板和表单逻辑，不新增独立弹窗

## 非目标

- 不在设置页、技能页、会话页等非供应商列表页拦截粘贴
- 不支持一次性解析多个 URL 或多个 API Key 并让用户选择
- 不修改供应商提交数据结构
- 不做全局剪贴板监听

## 方案选择

### 方案 A：在 `App.tsx` 监听快捷键

优点：
- 最适合按当前视图判断是否允许触发
- 便于集中管理打开 `AddProviderDialog` 的状态
- 预填数据可以直接通过 `AddProviderDialog` 透传

缺点：
- `App` 需要知道一层“新增供应商预填”的状态

### 方案 B：在 `ProviderList.tsx` 监听快捷键

优点：
- 逻辑更贴近供应商列表页

缺点：
- 打开弹窗的状态仍在 `App`
- 剪贴板解析结果需要继续向上抬升

### 方案 C：在 `AddProviderDialog` 内部处理粘贴

优点：
- 预填逻辑集中在表单附近

缺点：
- 无法满足“未打开弹窗时按 `Ctrl+V` 直接新增”的要求

### 结论

采用方案 A：
- `App.tsx` 负责快捷键判断、读取剪贴板、打开弹窗
- 新增一个独立工具函数解析剪贴板文本
- `AddProviderDialog` 接受可选 `initialData`
- `ProviderForm` 复用既有 `initialData` 回填能力

## 详细设计

## 1. 快捷键触发条件

在 `App.tsx` 增加窗口级 `keydown` 监听的分支：

- 仅当 `currentView === "providers"` 时允许触发
- 仅当按下 `Ctrl+V` 或 `Cmd+V` 时尝试解析
- 若事件目标属于可编辑元素，则直接忽略
- 若新增面板或编辑面板已打开，则忽略

这样可以避免：
- 干扰已有输入场景
- 在其他页面误开新增面板
- 在已有弹窗打开时重复叠加操作

## 2. 剪贴板解析

新增 `src/utils/providerClipboard.ts`，导出纯函数：

- `extractProviderDraftFromClipboard(text: string)`

返回结构：

```ts
type ProviderClipboardDraft = {
  name: string;
  baseUrl: string;
  apiKey: string;
} | null;
```

解析规则：

1. 从原始文本中提取所有以 `http://` 或 `https://` 开头，且可通过 `new URL()` 校验的片段
2. 取第一个合法 URL 作为 `baseUrl`
3. 将 URL 从文本中剔除后，对剩余文本按空白符切分
4. 在剩余 token 中，取第一个匹配 `[A-Za-z0-9_-]+` 且非空的 token 作为 `apiKey`
5. `name` 取 `new URL(baseUrl).hostname`
6. 若未找到合法 URL，则返回 `null`

约束：
- 只取第一个 URL 和第一个 API Key
- 保持实现简单可预期，不做启发式多值选择

## 3. 预填数据流

`App.tsx` 增加一份新增供应商预填状态，例如：

```ts
type AddProviderInitialData = {
  name?: string;
  settingsConfig?: Record<string, unknown>;
};
```

触发快捷键时：

1. `navigator.clipboard.readText()`
2. 调用 `extractProviderDraftFromClipboard`
3. 将结果按当前 `activeApp` 转成 `ProviderForm` 可消费的 `initialData`
4. 打开 `AddProviderDialog`

关闭新增面板时清空这份预填状态，避免下一次误复用旧值。

## 4. 按不同 App 写入预填配置

预填逻辑不直接操作表单控件，而是构造该 app 已有配置结构：

- `claude`
  - `name = hostname`
  - `settingsConfig.env.ANTHROPIC_BASE_URL = baseUrl`
  - 通过已有 API Key 写入规则填入对应 API Key 字段

- `codex`
  - `name = hostname`
  - `settingsConfig.auth.OPENAI_API_KEY = apiKey`
  - `settingsConfig.config` 写入包含 `base_url = "..."`

- `gemini`
  - `name = hostname`
  - `settingsConfig.env.GOOGLE_GEMINI_BASE_URL = baseUrl`
  - 写入 Gemini API Key 字段

- `opencode`
  - `name = hostname`
  - `settingsConfig.options.baseURL = baseUrl`
  - `settingsConfig.options.apiKey = apiKey`

- `openclaw`
  - `name = hostname`
  - `settingsConfig.baseUrl = baseUrl`
  - `settingsConfig.apiKey = apiKey`

若未提取到 API Key，则仍打开新增面板，只预填名称和 URL，API Key 留空。

## 5. 失败与降级行为

- 剪贴板读取失败：不打开面板，不拦截默认行为
- 剪贴板中没有合法 URL：不打开面板，不拦截默认行为
- 有 URL 但没有 API Key：打开面板，仅部分预填

该策略保证只有在“高置信度识别为供应商配置片段”时才接管粘贴。

## 6. 测试设计

### 单元测试

新增 `tests/utils/providerClipboard.test.ts`：

- 能提取 URL、domain、API Key
- 多行文本中能正确提取第一个 URL
- URL 后带路径或版本号时仍合法
- 没有 URL 时返回 `null`
- 有 URL 无 API Key 时返回仅含名称和 URL 的结果

### 组件测试

更新 `tests/integration/App.test.tsx` 或相关组件测试：

- 在 `providers` 视图按 `Ctrl+V` 时，会读取剪贴板并打开新增面板
- 预填数据会被传入 `AddProviderDialog`
- 在输入元素中按 `Ctrl+V` 不触发该行为
- 在非 `providers` 视图按 `Ctrl+V` 不触发该行为

## 风险

- 剪贴板内容格式高度自由，API Key 识别可能把普通 token 当成 key
  - 通过“必须先识别到合法 URL”降低误触发概率
- 与系统默认粘贴竞争
  - 仅在成功识别供应商草稿后才 `preventDefault`
- 不同 app 的配置结构不同
  - 通过按 app 构造 `initialData.settingsConfig`，避免在表单层写大量条件分支

## 实施步骤

1. 为剪贴板解析函数补单元测试，先验证失败
2. 为 `App` 快捷键行为补集成测试，先验证失败
3. 实现剪贴板解析工具
4. 在 `App.tsx` 接入快捷键和预填状态
5. 在 `AddProviderDialog` 接入 `initialData`
6. 回归相关测试并检查现有快捷键未回归
