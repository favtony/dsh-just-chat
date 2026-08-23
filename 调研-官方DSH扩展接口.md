# 调研：官方 DSH 扩展接口 — dsh-just-chat 可行性

> 本文保留最初基于 `0.1.0-rc.7` 的历史调研证据，不再作为当前实现基线。当前实现、已确定结论和完成状态统一以《规格-不在项目中工作对话》记录的 `0.1.1-rc.2` 复核结果为准。
>
> 校正基线：官方 `dsh-v0.1.0-rc.7`，提交 `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca`
> 来源：固定版本源码、同版本已安装 npm 类型定义、已安装社区插件的打包形式
> 方法：官方源码和类型定义阅读；社区插件只用于确认包结构，不作为产品行为依据

---

## 校正结论

`dsh-just-chat` 可以使用官方插件机制实现设置、宿主预留事务、会话交接和独立数据投影，但当前版本的三个 UI 槽位都是单一占位：工作区选择器、无会话输入栏和侧边栏浏览器都必须完整替换，不能以追加条目或 chain 方式接入。另一个已确认缺口是官方新建页预设的内部暂存值没有公开读取或等待接口；需要先确定首版采用有效默认预设，还是等待官方新增接口。

---

## 证据

### 1. 插件开发与安装方式

#### 1.1 插件结构

一个 DSH 插件是一个 npm 包，声明 dsh.bundle 和 dsh.client 元数据字段：

**package.json 关键字段**（来源：dsh-web-default-session/package.json）：

| 字段 | 说明 |
|------|------|
| dsh.bundle.patch | 指向 cordis.patch.yml，插件 bundle 的 Host 层注册行 |
| dsh.client.platform | 固定 "web" |
| dsh.client.immediately | 浏览器 prefetch 优先级 |
| dsh.client.inject | 浏览器插件依赖声明 |
| exports["./client"] | 浏览器端 JS 入口 |

**Host 注册**（来源：dsh-web-default-session/cordis.patch.yml）：

```yaml
- insert:
    - id: just-chat
      name: 'dsh-just-chat'
```

**插件安装命令**（来源：dsh-web-default-session/README.md）：

```bash
dsh plugin --profile web add dsh-just-chat
```

#### 1.2 插件加载机制

- DSH 使用 Cordis 4.x 作为插件系统（来源：dsh 官方 README）
- Profile 的 bundle 顺序：dsh.profile.bundles 数组按顺序加载，每个 bundle 的 patch 叠加
- 浏览器端插件通过 dsh.client 声明自动发现，打包为独立 chunk
- 社区插件已验证流程：dsh-web-default-session、dsh-better-sidebar、dsh-history、@linxin666/dsh-web-ui-all 等均已成功安装到本机

---

### 2. 插件注册 Host Remote 调用、设置命名空间、客户端 UI

#### 2.1 Host 远程调用（Remote）

- 官方 SDK 包 @deepseek-ai/dsh-sdk 提供协议层、客户端和服务端
- 官方插件 tool-cordis 展示了通过 Host Remote 注册工具和设置的完整模式
- 浏览器端通过 ctx.remote 访问 Host 远程方法（来源：connection/README.md）
- 官方示例：ctx.settingsScope.bind(spec) 注册设置命名空间（来源：ui-settings/README.md）

#### 2.2 设置命名空间

- 官方 @deepseek-ai/dsh-settings 提供完整的设置注册 API
- 可注册 Host 层设置命名空间，客户端通过 ctx.settingsScope.bind(ns) 读取
- 设置插件 settings.section slot 注册设置分区页面（来源：ui-settings/README.md）
- 已知 slot：settings.trigger、settings.section、settings.plugins.tab、settings.onboarding

#### 2.3 客户端 UI 注册

- 浏览器插件通过 exports["./client"] 导出，在宿主插件激活后自动加载
- 插件使用 ctx.slots.register() 注册到 slot 系统（来源：ui-slots/README.zh.md）
- 通过 ctx.slots.inject() 向已声明 slot 注入组件（侧边栏、会话、设置等）
- ctx.effect(() => () => { cleanup }, "label") 管理插件生命周期

---

### 3. 关键 UI 插槽

#### 3.1 布局 Slot（由 ui-layout 声明）

来源：ui-layout/README.zh.md

| Slot 名称 | kind | 说明 |
|-----------|------|------|
| root | single | 布局注册点，运行时持有 |
| sidebar | — | 侧边栏区域 |
| conversation | — | 对话区域 |
| details | — | 详情面板区域 |
| conversation.empty | — | 无会话时的空白页 |

#### 3.2 侧边栏 Slot（由 ui-sidebar 声明）

来源：ui-sidebar/README.zh.md

| Slot 名称 | kind | 说明 |
|-----------|------|------|
| sidebar.brand.mark | single | 品牌图标 |
| sidebar.brand.name | single | 品牌名称 |
| sidebar.workspaces | single | Workspace 和 Session 浏览器（由 ui-workspace 持有） |
| sidebar.settings | single | 底部设置按钮 |

#### 3.3 工作区 Slot（由 ui-workspace 持有）

来源：ui-workspace/README.zh.md

- 渲染到 sidebar.workspaces 的 Workspace 和 Session 列表
- 分组、排序、搜索与行状态都属于 ui-workspace，**不是侧边栏外壳**
- **已知限制：没有模糊内容搜索或事件深链接**（来源：README "Known Limitations"）
- 会话列表使用运行时实时状态（pendingInteraction、running 状态等）

#### 3.4 设置 Slot（由 ui-settings 声明）

来源：ui-settings/README.zh.md

| Slot 名称 | kind | 说明 |
|-----------|------|------|
| settings.trigger | — | 设置触发按钮 |
| settings.header | — | 设置页头 |
| settings.close | — | 设置关闭按钮 |
| settings.action | list | 顶部操作 |
| settings.section | list | 设置分区页面（每页一个 feature） |
| settings.plugins.tab | list | 插件分页内的子页面 |
| settings.onboarding | list | 引导页面 |

#### 3.5 对话 Slot（由 ui-conversation 声明）

来源：ui-conversation/README.zh.md

| Slot 名称 | kind | 说明 |
|-----------|------|------|
| conversation.chat.turnTail | chain | 轮次尾部（产物行等） |
| conversation.composer | chain | 输入框区域（holding fallback 机制） |

#### 3.6 输入触发 Slot（由 ui-input-trigger 声明）

来源：ui-input-trigger/README.zh.md

- 管理 / 和 @ 触发管道
- 可通过 conversation.composer chain slot 接管输入框区域

---

### 4. 最小可行实现可行性

#### 4.1 "不在项目中工作"模式

不能沿用 `dsh-web-default-session` 的“默认目录”模型：该插件产品行为与本需求相反，会在选择时创建目录和会话。`不在项目中工作` 必须保留为浏览器待选状态，到首次发送才通过预留事务创建目录，再调用官方 `ctx.sessions.create({ cwd, sessionId })`。

#### 4.2 注册 DSH 设置页

**无需 fork 官方代码。**

- 向 settings.section（list slot）注册一个设置分区页面
- 使用 ctx.settingsScope.bind('just-chat') 注册设置命名空间
- 已在无数社区插件中验证（如 dsh-better-sidebar 注册设置页）

#### 4.3 侧边栏对话列表

`sidebar.workspaces` 是 `single`，不是 chain。侧边栏的工作区/会话列表由 ui-workspace 持有，渲染到该占位；“工作区 + 对话”只能由完整替换组件实现。替换组件继续使用 `ctx.sessions.list`、`ctx.workspaces.list` 和官方 `session.search`，以 `updatedAt` 排序，不建立第二套会话数据源。

---

### 5. 具体实现路径

#### 5.1 插件结构

```
dsh-just-chat/
├── package.json          # npm 包声明，dsh.bundle + dsh.client
├── cordis.patch.yml      # Host 注册行
├── src/
│   ├── index.ts          # Host 端（空 apply 或设置命名空间注册）
│   └── client.ts         # 浏览器端实现
├── tsdown.config.ts
└── tsconfig.json
```

#### 5.2 关键依赖

| 依赖 | 用途 |
|------|------|
| @deepseek-ai/cordis | 插件基础设施 |
| @deepseek-ai/dsh-client-runtime | 运行时 API（会话、工作区） |
| @deepseek-ai/dsh-client-ui-slots | Slot 注册系统 |
| @deepseek-ai/dsh-client-ui-conversation | 对话 UI（输入框接管） |
| @deepseek-ai/dsh-client-ui-workspace | 工作区列表（会话搜索排序） |
| @deepseek-ai/dsh-client-ui-sidebar | 侧边栏（可选替换） |
| @deepseek-ai/dsh-client-ui-settings | 设置注册 |
| @deepseek-ai/dsh-settings | 设置命名空间 |
| react | UI 组件 |

#### 5.3 构建和发布

- 使用 tsdown 构建（官方工具）
- 发布到 npm，用户通过 dsh plugin --profile web add dsh-just-chat 安装
- 或通过 dsh plugin --profile web add github:<user>/dsh-just-chat 从 GitHub 安装

---

## 实现影响

### 影响范围

| 组件 | 影响 | 说明 |
|------|------|------|
| 官方代码 | 无 | 全部通过插件机制实现 |
| 用户 profile | 仅新增 bundle | 不修改现有配置 |
| 其他插件 | 无冲突 | 通过 slot 系统隔离 |

### 风险

| 风险 | 评估 |
|------|------|
| 官方 SlotMap 变更 | 中等。SlotMap 是声明合并接口，官方可能新增/修改 slot 名称 |
| 会话 API 变更 | 低。ctx.sessions 和 ctx.workspaces 是稳定 API |
| 侧边栏替换 | 低。dsh-better-sidebar 已验证 |

---

## 未证实事项

1. **首条消息与新建页预设的一致性**：官方预设芯片的暂存值只在其内部控制器中保存，外部插件无法可靠读取或等待它；这是实施前需要用户决定的唯一功能取舍。
2. **宿主持久记录恢复查询**：需要在实现宿主事务前核对 `dsh-session` 的持久化读取服务，确定重启时按预分配 `sessionId` 验证真实会话的最小公开接口。
3. **本地包安装命令**：需要在单包脚手架完成后用 `dsh plugin --profile web` 实测并写成 smoke test，不能依据社区插件文档猜测链接语法。

---

## 参考资料

### 官方仓库核心链接

| 资源 | URL |
|------|------|
| 官方仓库 | https://github.com/deepseek-ai/deepseek-harness |
| 插件系统（Cordis） | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/extensions |
| SDK 协议 | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/sdk |
| Slot 系统 | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-slots |
| 布局 Slot | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-layout |
| 侧边栏 Slot | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-sidebar |
| 工作区 Slot | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-workspace |
| 设置 Slot | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-settings |
| 设置通用页 | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-settings-general |
| 对话 UI | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-conversation |
| 设置服务 | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/settings/settings |
| 运行时客户端 | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/runtime |
| Web App Bundle | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/bundle/web-app |
| Base Bundle | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/bundle/base |
| CLI 入口 | https://github.com/deepseek-ai/deepseek-harness/tree/master/apps/cli |
| Web 入口 | https://github.com/deepseek-ai/deepseek-harness/tree/master/apps/web |
| Host 服务 | https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/host |

### 社区插件参考

| 插件 | 用途 | URL |
|------|------|------|
| dsh-web-default-session | 无工作区新建会话 | https://github.com/wjy9902/dsh-web-default-session |
| dsh-better-sidebar | 替换侧边栏 | https://github.com/omdsh-dev/DSH-better-sidebar |
| dsh-history | 会话内消息搜索 | https://github.com/chenproton/dsh-history |
| @linxin666/dsh-web-ui-all | 全家桶插件 | https://github.com/zhu1090093659/dsh-web-ui |
