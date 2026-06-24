# 修复「启动时拉取远程数据」不生效

## 概述

设置中开启「启动时拉取远程数据」后，应用启动时并未真正从 WebDAV 拉取数据。根因是 `runRestoreOnStartup` 依赖模块级变量 `getSettings`，而该变量在 `App.vue` 调用 `runRestoreOnStartup` 时还未被 `startScheduler` 赋值，函数首行 `if (!getSettings) return` 直接早返回。

**修复方向**：让 `runRestoreOnStartup` 接收 settings 访问器作为入参（与 `startScheduler` 同款），消除对模块级 `getSettings` 状态与调用顺序的隐式依赖，从根本上解除时序耦合。

---

## 根因分析

`src/services/autoSyncService.ts:8` 定义模块级变量：
```ts
let getSettings: (() => AppSettings) | null = null
```

`getSettings` **仅在** [autoSyncService.ts:25](file:///Users/nbn/workspace/github/doit/src/services/autoSyncService.ts#L25) `startScheduler` 内部被赋值：
```ts
export function startScheduler(settings: () => AppSettings) {
  stopScheduler()
  getSettings = settings
  scheduleNextBackup()
  scheduleNextRestore()
}
```

`runRestoreOnStartup` 第一行就是早返回守卫：
```ts
export async function runRestoreOnStartup(): Promise<void> {
  if (!getSettings) return   // ← 这里直接返回
  const s = getSettings()
  ...
}
```

`App.vue onMounted` 的执行顺序（[src/App.vue:200-351](file:///Users/nbn/workspace/github/doit/src/App.vue#L200-L351)）：

| 行号 | 操作 | `getSettings` 状态 |
|------|------|-------------------|
| 221-239 | `setSchedulerCallbacks(...)` | `null`（只设置回调） |
| 242-244 | `runRestoreOnStartup()` ← **早返回** | `null` |
| 349-351 | `startScheduler(() => settings.value)` | **此时才被赋值** |

因此「启动时拉取」永远走不到 `downloadDbBackup`，UI 不出现「正在拉取云端数据...」Toast，行为等同于开关关闭。

> 注：`setSchedulerCallbacks` 与 `startScheduler` 是两套独立的注册入口，前者只设置状态/数据回调，后者才注入 settings 访问器。设计本意可能是「回调与设置分离」，但 `runRestoreOnStartup` 误用了「必须先 startScheduler」的前置条件。

---

## 涉及文件

| 文件 | 变更类型 | 摘要 |
|------|---------|------|
| [src/services/autoSyncService.ts](file:///Users/nbn/workspace/github/doit/src/services/autoSyncService.ts) | 编辑 | `runRestoreOnStartup` 接受 `settingsGetter: () => AppSettings` 参数；不再依赖模块级 `getSettings` |
| [src/App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue) | 编辑 | 调用处传 `() => settings.value`；移除冗余的双重前置检查（让函数内部自己守卫） |

未涉及：
- `SettingsDialog.vue` —— 开关 UI 与持久化已正常
- `settingsService.ts` —— `getSettings` 已用 spread 合并默认值，字段不会丢
- `webdavService.ts` / `db.ts` —— 底层 API 无需改动
- `types/index.ts` —— `cloudSync.fetchOnStartup` 字段已存在

---

## 详细变更

### 1. [src/services/autoSyncService.ts](file:///Users/nbn/workspace/github/doit/src/services/autoSyncService.ts)

**1.1 修改 `runRestoreOnStartup` 签名与实现**（约 48-79 行）：

```ts
export async function runRestoreOnStartup(
  settingsGetter: () => AppSettings
): Promise<void> {
  if (!settingsGetter) return
  const s = settingsGetter()
  if (!s.cloudSync.enabled) return
  if (!s.cloudSync.fetchOnStartup) return
  if (s.cloudSync.provider !== "webdav" || !s.cloudSync.webdavUrl) return

  try {
    onRestoreStatus?.("正在拉取云端数据...")
    await closeDb()
    await new Promise((r) => setTimeout(r, 300))
    await downloadDbBackup(
      s.cloudSync.webdavUrl,
      s.cloudSync.webdavUsername,
      s.cloudSync.webdavPassword
    )
    await getDb()
    onDataChanged?.()
    onRestoreStatus?.("云端数据拉取成功")
  } catch (e) {
    console.warn("[doit] 启动拉取失败:", e)
    onRestoreStatus?.("启动拉取失败")
    try {
      await getDb()
    } catch {}
  }
}
```

**关键变化**：
- 入参 `settingsGetter: () => AppSettings` —— 与 `startScheduler` 同款契约
- 删除 `if (!getSettings) return` 守卫
- 函数体不变；其余内部状态（`onRestoreStatus` / `onDataChanged`）继续依赖 `setSchedulerCallbacks`，调用顺序正确

**理由**：
- 显式入参 > 隐式模块状态：消除时序耦合，未来谁先谁后都不影响
- 与 `startScheduler(settings: () => AppSettings)` 签名风格一致
- 调用方只传 `() => settings.value`，依赖最少

### 2. [src/App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue)

**2.1 修改调用点**（约 242-244 行）：

```ts
if (settings.value.cloudSync.enabled && settings.value.cloudSync.fetchOnStartup) {
  runRestoreOnStartup(() => settings.value);
}
```

**2.2 保留外层守卫 or 删除**：

两种方案皆可，推荐**保留**：
- 当前外层 `if` 避免了无意义的函数调用栈 + 早返回判断，可读性好
- 内层 `runRestoreOnStartup` 的守卫作为「独立函数」的最终防线，独立测试时仍能自洽
- 双层守卫成本极低（两次布尔比较），无副作用

**最终保留** `if (settings.value.cloudSync.enabled && settings.value.cloudSync.fetchOnStartup)` 守卫，仅修改函数入参。

**2.3 无需调整** `onMounted` 内部顺序：
- `setSchedulerCallbacks` 仍需在 `runRestoreOnStartup` 之前调用（保证 `onRestoreStatus` / `onDataChanged` 已就绪）
- 当前代码已满足此顺序

---

## 关键决策与假设

- **决策 1**：参数注入而非「调整调用顺序」
  - 候选方案：把 `startScheduler` 移到 `runRestoreOnStartup` 之前
  - 否决理由：`startScheduler` 还会启动 `scheduleNextBackup` / `scheduleNextRestore` 定时器，移到前面会让定时器在「启动时拉取」尚未决定时就开始计时，语义错位
  - 选定方案：参数注入，零副作用

- **决策 2**：不动 `runBackup` / `runRestore` / `runBackupOnExit` 的实现
  - 理由：这三个函数只会被 `startScheduler` 启动的 timer 或 `onCloseRequested` 回调调用，时序上 `getSettings` 必然已就绪
  - 风险：低；如未来有其他提前调用，需同样改造

- **决策 3**：保留外层 `if` 守卫
  - 理由：让 `App.vue` 表达「只有满足条件才调用」的意图；函数内部的守卫保留作为「函数自洽性」兜底
  - 代价：两处布尔判断（可忽略）

- **假设 1**：`setSchedulerCallbacks` 必须在 `runRestoreOnStartup` 之前调用
  - 验证：当前代码 [App.vue:221-244](file:///Users/nbn/workspace/github/doit/src/App.vue#L221-L244) 已满足，无需调整

- **假设 2**：`settings.value` 在调用时是最新值
  - 验证：`runRestoreOnStartup` 在 `await initSettings()` 之后、`await getSettings()` 之后才触发，`settings.value` 已同步为 DB 中的最新值

---

## 验证步骤

### 编译验证
- `npm run build` 退出码 0
- TypeScript 无 `runRestoreOnStartup` 调用签名错误

### 手动验证

1. **基本生效（核心场景）**
   - 打开设置 → 同步 → 确认「启用云同步」打开、「启动时拉取远程数据」打开、URL/账号/密码正确 → 保存
   - 杀掉应用进程，重启
   - **预期**：顶部出现 `message.success("云端数据拉取成功")` Toast（[App.vue:227](file:///Users/nbn/workspace/github/doit/src/App.vue#L227) 文案匹配 `s === "云端数据拉取成功"`）
   - 失败用例：把 WebDAV 密码改错 → 重启 → 出现 `message.error("启动拉取失败")` Toast，且 DB 仍可操作（验证 catch 分支 `getDb()` 兜底）

2. **关闭开关生效**
   - 设置中关闭「启动时拉取远程数据」→ 保存 → 重启
   - **预期**：无任何拉取相关 Toast；本地数据正常显示

3. **时序独立性**
   - 故意在 `runRestoreOnStartup` 调用前加 `console.log("getSettings:", getSettings)`（临时 debug）→ 确认修复前为 `null`、修复后为函数（因重构后不再依赖模块变量，此项仅作记录）

4. **与定时恢复共存**
   - 同时启用「启动时拉取」 + 「定时恢复」 → 重启
   - **预期**：启动时拉取一次（一次性），之后按 schedule 定时拉取；两者 Toast 不冲突

5. **未启用云同步时**
   - 「启用云同步」关闭（无论「启动时拉取」开关状态）→ 重启
   - **预期**：无拉取行为；UI 正常

### 回归验证
- 「关闭时上传」功能（`runBackupOnExit`）：关闭窗口 → 仍正常触发上传
- 「定时备份 / 定时恢复」：仍按计划触发
- 普通 todo 操作（增删改查、拖拽）：不受影响

---

## 关键文件链接

- 修复目标：[src/services/autoSyncService.ts:48-79](file:///Users/nbn/workspace/github/doit/src/services/autoSyncService.ts#L48-L79)
- 调用点：[src/App.vue:242-244](file:///Users/nbn/workspace/github/doit/src/App.vue#L242-L244)
- 调度器注册：[src/services/autoSyncService.ts:23-28](file:///Users/nbn/workspace/github/doit/src/services/autoSyncService.ts#L23-L28)
- 设置加载：[src/services/settingsService.ts:78-81](file:///Users/nbn/workspace/github/doit/src/services/settingsService.ts#L78-L81)
- 开关 UI：[src/components/SettingsDialog.vue:571-592](file:///Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue#L571-L592)
