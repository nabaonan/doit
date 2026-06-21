# 启动时拉取远程数据开关

## 概述

在「同步」设置区增加一个开关「启动时拉取远程数据」。该开关仅在「启用云同步」打开时可设置，否则禁用并显示锁图标，默认启用。开启后，应用启动时会从 WebDAV 拉取最新 db 文件并覆盖本地（与 `autoRestore` 同款流程），本地未同步的修改会被覆盖。

**关键决策**：
- 存储位置：`AppSettings.cloudSync.fetchOnStartup: boolean`（与 `cloudSync` 字段同源）
- 默认值：`true`（启用）
- 冲突处理：总是用远程覆盖本地（与 `autoRestore` 行为一致）
- 执行时机：后台异步，UI 先展示本地数据，拉取完成后通过 `onDataChanged` 回调刷新
- UI 模式：复用现有「定时备份」的禁用 + 锁图标 + tooltip 模式

---

## 当前状态分析

**已有能力**：
- [src/types/index.ts:105-111](file:///Users/nbn/workspace/github/doit/src/types/index.ts#L105-L111) `AppSettings.cloudSync` 含 `enabled / provider / webdavUrl / username / password`
- [src/components/SettingsDialog.vue:317-341](file:///Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue#L317-L341) 「云同步」分组已有「启用云同步」开关 + URL/账号/密码输入框
- [src/components/SettingsDialog.vue:343-382](file:///Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue#L343-L382) 「定时备份」分组已实现 `disabled` + `LockOutlined` 锁图标 + `a-tooltip` 模式
- [src/services/autoSyncService.ts:98-115](file:///Users/nbn/workspace/github/doit/src/services/autoSyncService.ts#L98-L115) `runRestore()` 已封装「关闭 DB → 拉取 → 重开 DB → 通知」流程
- [src/services/webdavService.ts:122-133](file:///Users/nbn/workspace/github/doit/src/services/webdavService.ts#L122-L133) `downloadDbBackup()` 走 Tauri 桥调用 Rust
- [src/services/settingsService.ts](file:///Users/nbn/workspace/github/doit/src/services/settingsService.ts) `getSettings` / `saveSettings` 完整闭环

**关键缺口**：
- `AppSettings.cloudSync` 缺 `fetchOnStartup` 字段
- `SettingsDialog` 同步区无「启动拉取」开关
- `App.vue` `onMounted` 不在启动时主动拉取远程
- `autoSyncService` 没有「一次性拉取」导出函数

---

## 详细变更

### 1. 数据模型：[src/types/index.ts](file:///Users/nbn/workspace/github/doit/src/types/index.ts)

在 `AppSettings.cloudSync` 子对象（约 105-111 行）中新增字段：

```ts
cloudSync: {
  enabled: boolean
  provider: "webdav"
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  fetchOnStartup: boolean   // ← 新增
}
```

### 2. 设置读写服务：[src/services/settingsService.ts](file:///Users/nbn/workspace/github/doit/src/services/settingsService.ts)

**2.1 `defaultSettings.cloudSync` 增字段**（约 26-32 行）：

```ts
cloudSync: {
  enabled: false,
  provider: "webdav",
  webdavUrl: "",
  webdavUsername: "",
  webdavPassword: "",
  fetchOnStartup: true,   // ← 新增
},
```

**2.2 `getSettings` 返回值补字段**（约 75-77 行）：

```ts
cloudSync: kv["cloudSync"]
  ? JSON.parse(kv["cloudSync"])
  : { ...defaultSettings.cloudSync },
```
无需修改 —— `JSON.parse` 会自动把保存的 JSON 解析回包含 `fetchOnStartup` 的对象；老数据（无 `fetchOnStartup` 字段）会被 `JSON.parse` 反序列化为 `undefined`，由 UI 端的 `?? true` 兜底。

**2.3 `saveSettings` 入库**（约 124-127 行）：无需修改 —— `JSON.stringify(settings.cloudSync)` 会自动包含新字段。

**兼容性说明**：老用户首次启动后 `getSettings` 读到的 `cloudSync` 对象不含 `fetchOnStartup`，值为 `undefined`。在 `App.vue` 使用 `settings.value.cloudSync.fetchOnStartup` 时需 `?? true` 兜底，或者在 `getSettings` 中合并 `defaultSettings.cloudSync` 字段。

**2.4 `getSettings` 兼容性补强**（可选，更稳健）：

```ts
const parsed = kv["cloudSync"] ? JSON.parse(kv["cloudSync"]) : null;
return {
  cloudSync: {
    ...defaultSettings.cloudSync,  // 兜底缺失字段
    ...(parsed || {}),
  },
  // ...
}
```

**建议采用 2.4**，避免每次使用 `fetchOnStartup` 时都加 `?? true`，让所有字段类型严格。

### 3. 同步服务层：[src/services/autoSyncService.ts](file:///Users/nbn/workspace/github/doit/src/services/autoSyncService.ts)

**新增导出函数** `runRestoreOnStartup()`：

```ts
/**
 * 启动时拉取远程（一次性，不进入定时调度）。
 * 由 App.vue onMounted 在 settings 加载后调用。
 */
export async function runRestoreOnStartup(): Promise<void> {
  if (!getSettings) return
  const s = getSettings()
  if (!s.cloudSync.enabled) return
  if (!s.cloudSync.fetchOnStartup) return
  if (s.cloudSync.provider !== "webdav" || !s.cloudSync.webdavUrl) return

  try {
    onRestoreStatus?.("正在拉取远程数据...")
    await closeDb()
    await new Promise((r) => setTimeout(r, 300))
    await downloadDbBackup(
      s.cloudSync.webdavUrl,
      s.cloudSync.webdavUsername,
      s.cloudSync.webdavPassword
    )
    await getDb()
    onDataChanged?.()
    onRestoreStatus?.("远程数据拉取完成")
  } catch (e) {
    console.warn("[doit] 启动拉取失败:", e)
    onRestoreStatus?.("启动拉取失败")
    // 失败时需要重新打开本地 DB，避免应用进入 DB 未初始化状态
    try {
      await getDb()
    } catch {}
  }
}
```

**复用现有机制**：
- `closeDb()` / `getDb()` —— 来自 `db.ts`
- `downloadDbBackup()` —— 来自 `webdavService.ts`
- `onDataChanged` / `onRestoreStatus` —— 已通过 `setCallbacks` 注册的回调
- 复用现有的「正在... / 完成 / 失败」状态文案，与定时恢复一致

**失败处理**（重要）：
- `closeDb()` 之后必须保证 `getDb()` 重新初始化，即使下载失败
- 否则 DB 处于关闭状态，todo 查询等会失败
- 用 `try/catch` 包裹 `closeDb → download → getDb` 流程，失败分支主动 `getDb()` 重新初始化

### 4. 设置弹框 UI：[src/components/SettingsDialog.vue](file:///Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue)

**4.1 在「云同步」分组下、URL 输入框之后**，新增「启动时拉取」开关（约 340 行后）：

```vue
<!-- 启动时拉取 -->
<div class="flex items-center justify-between mt-1">
  <span
    class="text-sm"
    :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }"
  >
    启动时拉取远程数据
  </span>
  <a-switch
    v-model:checked="localSettings.cloudSync.fetchOnStartup"
    :disabled="!cloudSyncEnabled"
    size="small"
  />
</div>
<div
  v-if="!cloudSyncEnabled"
  class="text-[11px] text-[var(--muted-foreground)] mt-0.5"
>
  需先启用云同步
</div>
```

**设计要点**：
- 紧跟 URL/账号/密码输入框（同属「云同步」逻辑分组）
- 禁用时变灰 + 副标题提示「需先启用云同步」（比 `a-tooltip` 锁图标更直观，参考原「定时备份」的小锁图标）
- 不依赖 `LockOutlined` 图标以简化视觉（用户已在多个开关看到锁图标，加载时会显得重复）

**4.2 移除原「定时恢复」标题的 `ExclamationCircleOutlined` 警告图标**（可选）：保留也无碍，与本计划无关。

### 5. App.vue 集成：[src/App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue)

**5.1 import 新增**（约 23 行）：

```ts
import {
  startScheduler, stopScheduler,
  setCallbacks as setSchedulerCallbacks,
  runRestoreOnStartup,  // ← 新增
} from "./services/autoSyncService";
```

**5.2 `onMounted` 中调用**（约 184-186 行 applyDefaultCategory 后）：

```ts
// 应用默认分类
settingsLoaded = true;
applyDefaultCategory();

// 启动时拉取远程数据（异步、不阻塞 UI）
if (settings.value.cloudSync.enabled && settings.value.cloudSync.fetchOnStartup) {
  runRestoreOnStartup();  // 不 await，让 UI 立即渲染本地数据
}

// 启动自动备份/恢复调度器
setSchedulerCallbacks({ ... });
```

**设计要点**：
- **不 await** —— 后台异步执行，UI 立即展示本地数据
- **双重检查** —— 早返回条件与 `autoSyncService` 内一致，避免无谓调用
- **执行顺序**：本地数据加载完成 → 启动时拉取 → 调度器启动
  - 拉取成功：`onDataChanged` 回调刷新 `todos.value` / `settings.value`（已注册在 `setSchedulerCallbacks` 中）
  - 拉取失败：日志 + Toast，DB 仍可用

**5.3 监听 `fetchOnStartup` 变化**（约 254-269 行 watch 内）：

**无需修改** —— `fetchOnStartup` 是「启动时」行为，运行期切换不需立即触发拉取。下次启动时自动应用新值。

### 6. 类型校验

- `cloudSync.fetchOnStartup: boolean` —— 严格类型
- 老用户 DB 中无此字段 → `getSettings` 用 `defaultSettings.cloudSync` 兜底（采纳 2.4 方案）→ 值为 `true`
- 新用户默认值：`true`

---

## 涉及文件清单

| 文件 | 变更类型 | 摘要 |
|------|---------|------|
| [src/types/index.ts](file:///Users/nbn/workspace/github/doit/src/types/index.ts) | 编辑 | `AppSettings.cloudSync` 新增 `fetchOnStartup: boolean` |
| [src/services/settingsService.ts](file:///Users/nbn/workspace/github/doit/src/services/settingsService.ts) | 编辑 | 默认值增字段；`getSettings` 用 `defaultSettings.cloudSync` 合并兜底 |
| [src/services/autoSyncService.ts](file:///Users/nbn/workspace/github/doit/src/services/autoSyncService.ts) | 编辑 | 新增 `runRestoreOnStartup()` 导出函数 |
| [src/components/SettingsDialog.vue](file:///Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue) | 编辑 | 在「云同步」分组 URL 区下方新增「启动时拉取」开关 |
| [src/App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue) | 编辑 | import `runRestoreOnStartup`；`onMounted` 在 `applyDefaultCategory` 之后调用 |

未涉及文件（无需改动）：
- `webdavService.ts` —— `downloadDbBackup` 已存在
- `db.ts` —— `closeDb` / `getDb` 已存在
- `BackupDialog.vue` —— 与本功能无关
- `TitleBar.vue` —— 不在 UI 暴露此开关

---

## 验证步骤

### 编译验证
- `npm run build` 退出码 0
- TypeScript 无 `cloudSync.fetchOnStartup` 类型错误

### 手动验证
1. **基本设置（开关可见）**：
   - 打开设置 → 切到「同步」分类 → 「启用云同步」关闭 → 「启动时拉取远程数据」开关变灰 + 副标题「需先启用云同步」显示
   - 打开「启用云同步」→ 「启动时拉取远程数据」开关恢复可用，默认 ON

2. **关闭开关（行为正确）**：
   - 关闭「启动时拉取」 → 保存 → 重启应用 → 顶部不出现「正在拉取远程数据...」Toast
   - 本地数据正常显示

3. **开启开关 + 远程有数据**：
   - 在 WebDAV 上传一个 db（通过手动云备份）
   - 启动应用 → 顶部 Toast：「正在拉取远程数据...」→「远程数据拉取完成」
   - UI 自动刷新显示远程数据

4. **开启开关 + 拉取失败**：
   - 修改 WebDAV 密码（破坏凭据） → 重启应用
   - Toast：「正在拉取远程数据...」→「启动拉取失败」
   - **DB 仍可用**：本地旧数据正常显示，操作 todo 不报错（验证失败分支的 `getDb()` 兜底）

5. **本地 vs 远程时序**：
   - 应用启动后 0ms 立刻看到本地数据（不阻塞）
   - 拉取完成后 ~1s 内 UI 自动刷新为远程数据（`onDataChanged` 回调）

6. **老用户兼容性**：
   - 在 DB 中清空 `cloudSync` 字段（dev 模式）→ 启动 → `fetchOnStartup` 默认 `true` → 行为正常

### 数据完整性
- 「启动时拉取」关闭后，仅控制启动行为，不影响「定时恢复」
- 启动时拉取 + 定时恢复可同时启用：启动时拉取一次，之后按 schedule 定时拉取

---

## 关键决策与假设

- **决策 1**：字段放在 `cloudSync` 子对象而非顶层
  - 理由：与 `enabled` 同源；语义内聚；UI 与 `enabled` 紧邻
  - 代价：嵌套稍深，但使用频率低

- **决策 2**：复用 `onRestoreStatus` 回调显示 Toast
  - 理由：文案与定时恢复一致（用户已有预期）；不引入新回调
  - 副作用：若用户同时启用「启动时拉取」和「定时恢复」，两者共用同一 Toast 通道 —— 不冲突

- **决策 3**：启动时拉取不进入调度器
  - 理由：一次性行为，不应循环
  - 实现：`runRestoreOnStartup` 不调用 `scheduleNextRestore`

- **决策 4**：失败时主动 `getDb()` 重新初始化
  - 理由：`closeDb()` 后若 `downloadDbBackup` 抛错，DB 处于关闭状态
  - 兜底：catch 分支再次 `getDb()` 恢复

- **决策 5**：UI 副标题「需先启用云同步」替代锁图标 tooltip
  - 理由：与现有「定时备份」保持风格；用户已熟悉
  - 实际：参考现有 `autoBackup` 区域副标题，文字更友好

- **假设 1**：用户接受「总是覆盖」语义，与「定时恢复」一致
  - 如未来需要更细粒度控制，可增加「双向同步」/「仅当远程较新」选项（不在本计划范围）

- **假设 2**：应用启动时 DB 已经初始化（`initTodos` / `initSettings` 已调用）
  - `runRestoreOnStartup` 内的 `closeDb / getDb` 走 `db.ts` 的引用计数器，幂等
