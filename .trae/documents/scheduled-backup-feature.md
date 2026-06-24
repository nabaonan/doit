# 定时备份 + 定时恢复功能 Plan

## 1. Summary

为 Doit 应用增加两个独立功能：**定时备份**（自动上传 db 到 WebDAV）和**定时恢复**（自动从 WebDAV 下载 db 覆盖本地）。**只有云同步启用**时才能设置这两个功能。各自有独立的开关、间隔、单位下拉，并**实时生成对应的 cron 表达式**展示给用户。**默认都关闭** —— 用户必须显式启用才有定时逻辑。

## 2. Current State Analysis

### 已有基础设施
- [autoSyncService.ts](file:///c%3A/Users/nbn/workspace/github/doit/src/services/autoSyncService.ts) —— 已有自动同步脚手架（固定 5 分钟、用户不可配置）
- [SettingsDialog.vue](file:///c%3A/Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue) —— 已有"云同步"区块和实时保存机制可复用
- [settingsService.ts](file:///c%3A/Users/nbn/workspace/github/doit/src/services/settingsService.ts) —— KV 存储，新增字段只需加几行
- [App.vue](file:///c%3A/Users/nbn/workspace/github/doit/src/App.vue) —— 已有定时器管理模式
- 依赖中**无 cron 解析库**（JS 或 Rust） —— 调度用纯计算 + `setTimeout` 循环，**不引入新依赖**

### 数据模型（当前 AppSettings）
- `cloudSync.enabled: boolean` —— **新增定时功能的依赖开关**
- `cloudSync.provider: "webdav" | "local_folder"`
- **没有**任何定时调度相关字段

### 用户新需求（关键约束）
1. **不设置定时 = 没有默认的备份/恢复逻辑**（完全无操作）
2. **云同步必须开启**才能设置定时功能（云同步关闭时定时配置应 disabled）
3. **两个独立功能**：定时**备份**（上传）+ 定时**恢复**（下载）
4. **两个独立开关**
5. **默认都关闭**

### 关键设计决策
- **不存储 cron 字符串** —— 存 `(unit, interval)`，cron 由纯函数实时生成
- **不引入 cron 解析库** —— 调度用 `setTimeout` 循环，每次到点执行后**用 (unit, interval) 计算下次时间**，逻辑上等价于按 cron 执行
- 单位：分钟（minute）/ 小时（hour）/ 天（day）
- **数字限制 1-999 整数**
- **依赖关系**：`autoBackup.enabled` 和 `autoRestore.enabled` 都要求 `cloudSync.enabled === true`，否则开关 disabled
- **执行流程**：
  - 定时备份：调用 `uploadDbBackup`（已有）
  - 定时恢复：调用 `downloadDbBackup` + `closeDb` + `getDb` + emit "data-changed"（同 `handleDownload`）
- **静默执行** —— 自动恢复不弹确认对话框（恢复会**覆盖本地数据**，由用户自己承担风险）
- **失败处理** —— 失败后等下一个周期，通过 `onStatusChange` 提示

## 3. Proposed Changes

### 3.1 类型扩展 —— [src/types/index.ts](file:///c%3A/Users/nbn/workspace/github/doit/src/types/index.ts#L85-L102)

```typescript
export type BackupUnit = "minute" | "hour" | "day"

export interface ScheduleConfig {
  enabled: boolean
  interval: number        // 1-999
  unit: BackupUnit
}

export interface AppSettings {
  // ... 现有字段保持不变
  autoBackup: ScheduleConfig    // 定时备份（上传到 WebDAV）
  autoRestore: ScheduleConfig   // 定时恢复（从 WebDAV 下载覆盖本地）
}
```

**默认值**：`{ enabled: false, interval: 30, unit: "minute" }`（两者都默认关闭）

### 3.2 新建工具文件 —— [src/utils/cron.ts](file:///c%3A/Users/nbn/workspace/github/doit/src/utils/cron.ts)

```typescript
import type { BackupUnit } from "../types"

/**
 * 根据间隔单位和数值生成 5 段 cron 表达式
 * - minute: "*/N * * * *"
 * - hour:   "0 */N * * *"
 * - day:    "0 0 */N * *"
 */
export function intervalToCron(unit: BackupUnit, interval: number): string {
  const n = Math.max(1, Math.floor(interval))
  switch (unit) {
    case "minute": return `*/${n} * * * *`
    case "hour":   return `0 */${n} * * *`
    case "day":    return `0 0 */${n} * *`
  }
}

/**
 * 根据 (unit, interval) 计算下次执行时间
 */
export function getNextRunTime(
  unit: BackupUnit,
  interval: number,
  after: Date = new Date()
): Date {
  const n = Math.max(1, Math.floor(interval))
  const next = new Date(after.getTime())
  switch (unit) {
    case "minute":
      next.setMinutes(next.getMinutes() + n); break
    case "hour":
      next.setHours(next.getHours() + n); break
    case "day":
      next.setDate(next.getDate() + n); break
  }
  return next
}
```

### 3.3 设置持久化

**A. [src/services/settingsService.ts](file:///c%3A/Users/nbn/workspace/github/doit/src/services/settingsService.ts#L4-L27)** —— `defaultSettings` 添加：

```typescript
const defaultAutoSchedule: ScheduleConfig = {
  enabled: false,
  interval: 30,
  unit: "minute",
}

const defaultSettings: AppSettings = {
  // ... 现有
  autoBackup: { ...defaultAutoSchedule },
  autoRestore: { ...defaultAutoSchedule },
}
```

**B. `getSettings()`** —— 添加读取：

```typescript
const parseSchedule = (raw: string | undefined): ScheduleConfig =>
  raw ? JSON.parse(raw) : { ...defaultAutoSchedule }

return {
  // ...
  autoBackup: parseSchedule(kv["autoBackup"]),
  autoRestore: parseSchedule(kv["autoRestore"]),
}
```

**C. `saveSettings()`** —— 添加保存：

```typescript
await db.execute(
  "INSERT INTO settings (key, value) VALUES ($1, $2)",
  ["autoBackup", JSON.stringify(settings.autoBackup)]
)
await db.execute(
  "INSERT INTO settings (key, value) VALUES ($1, $2)",
  ["autoRestore", JSON.stringify(settings.autoRestore)]
)
```

**D. [src/App.vue](file:///c%3A/Users\bn\workspace\github\doit/src/App.vue#L24-L47)** —— `settings` ref 初始值添加 `autoBackup` 和 `autoRestore`。

### 3.4 重构自动备份/恢复服务 —— [src/services/autoSyncService.ts](file:///c%3A/Users/nbn/workspace\github\doit/src/services/autoSyncService.ts)（整体改写）

**两个独立的 scheduleNext**：

```typescript
import { uploadDbBackup, downloadDbBackup } from "./webdavService"
import { closeDb, getDb } from "./db"
import { getNextRunTime } from "../utils/cron"
import type { AppSettings } from "../types"

let backupTimer: ReturnType<typeof setTimeout> | null = null
let restoreTimer: ReturnType<typeof setTimeout> | null = null
let getSettings: (() => AppSettings) | null = null
let onBackupStatus: ((status: string) => void) | null = null
let onRestoreStatus: ((status: string) => void) | null = null
let onDataChanged: (() => void) | null = null

export function setCallbacks(opts: {
  onBackupStatus?: (status: string) => void
  onRestoreStatus?: (status: string) => void
  onDataChanged?: () => void
}) {
  onBackupStatus = opts.onBackupStatus ?? null
  onRestoreStatus = opts.onRestoreStatus ?? null
  onDataChanged = opts.onDataChanged ?? null
}

export function startScheduler(settings: () => AppSettings) {
  stopScheduler()
  getSettings = settings
  scheduleNextBackup()
  scheduleNextRestore()
}

export function stopScheduler() {
  if (backupTimer) { clearTimeout(backupTimer); backupTimer = null }
  if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null }
  getSettings = null
}

export function restartScheduler(settings: () => AppSettings) {
  if (getSettings) {
    startScheduler(settings)
  }
}

function canRun(): boolean {
  if (!getSettings) return false
  const s = getSettings()
  return s.cloudSync.enabled
    && s.cloudSync.provider === "webdav"
    && !!s.cloudSync.webdavUrl
}

function scheduleNextBackup() {
  if (!getSettings || !canRun()) return
  const ab = getSettings().autoBackup
  if (!ab.enabled) return
  const next = getNextRunTime(ab.unit, ab.interval)
  const delay = Math.max(1000, next.getTime() - Date.now())
  backupTimer = setTimeout(async () => {
    await runBackup()
    scheduleNextBackup()
  }, delay)
}

function scheduleNextRestore() {
  if (!getSettings || !canRun()) return
  const ar = getSettings().autoRestore
  if (!ar.enabled) return
  const next = getNextRunTime(ar.unit, ar.interval)
  const delay = Math.max(1000, next.getTime() - Date.now())
  restoreTimer = setTimeout(async () => {
    await runRestore()
    scheduleNextRestore()
  }, delay)
}

async function runBackup() {
  if (!getSettings) return
  const { cloudSync } = getSettings()
  onBackupStatus?.("正在自动备份...")
  try {
    await uploadDbBackup(cloudSync.webdavUrl, cloudSync.webdavUsername, cloudSync.webdavPassword)
    onBackupStatus?.("自动备份完成")
  } catch {
    onBackupStatus?.("自动备份失败")
  }
}

async function runRestore() {
  if (!getSettings) return
  const { cloudSync } = getSettings()
  onRestoreStatus?.("正在自动恢复...")
  try {
    await closeDb()
    await new Promise((r) => setTimeout(r, 300))
    await downloadDbBackup(cloudSync.webdavUrl, cloudSync.webdavUsername, cloudSync.webdavPassword)
    await getDb()
    onDataChanged?.()
    onRestoreStatus?.("自动恢复完成")
  } catch {
    onRestoreStatus?.("自动恢复失败")
  }
}
```

### 3.5 App.vue 集成 —— [src/App.vue](file:///c%3A/Users\bn\workspace\github\doit/src/App.vue)

**A. 启动**：`onMounted` 中 DB 初始化后：
```typescript
setCallbacks({
  onBackupStatus: (s) => (autoBackupStatus.value = s),
  onRestoreStatus: (s) => (autoRestoreStatus.value = s),
  onDataChanged: () => {
    // 刷新 todos 和 settings
  },
})
startScheduler(() => settings.value)
```

**B. 监听变化**：
```typescript
watch(
  () => [
    settings.value.cloudSync.enabled,
    settings.value.cloudSync.webdavUrl,
    JSON.stringify(settings.value.autoBackup),
    JSON.stringify(settings.value.autoRestore),
  ],
  () => {
    if (settings.value.cloudSync.enabled) {
      restartScheduler(() => settings.value)
    } else {
      stopScheduler()
    }
  },
  { deep: true }
)
```

**C. 卸载清理**：`onUnmounted` 中调用 `stopScheduler()`。

**D. 状态显示（可选）**：在 TitleBar 底部或右下角添加一行小字，提示"自动备份已启用 · 下次 12:34"和"自动恢复已启用"。

### 3.6 设置 UI —— [src/components/SettingsDialog.vue](file:///c%3A/Users\bn\workspace\github\doit/src/components/SettingsDialog.vue)

**在「云同步」区块之后插入「定时备份」和「定时恢复」两个独立区块**。

**Script 部分添加**：

```typescript
import { intervalToCron } from "../utils/cron"

const backupUnitOptions = [
  { value: "minute", label: "分钟" },
  { value: "hour", label: "小时" },
  { value: "day", label: "天" },
]

const backupCron = computed(() => {
  const ab = localSettings.value.autoBackup
  return intervalToCron(ab.unit, ab.interval)
})

const restoreCron = computed(() => {
  const ar = localSettings.value.autoRestore
  return intervalToCron(ar.unit, ar.interval)
})

const cloudSyncEnabled = computed(() => localSettings.value.cloudSync.enabled)
```

**模板部分**（紧接「云同步」区块 [SettingsDialog.vue:354](file:///c%3A/Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue#L354) 之后）：

```vue
<!-- 定时备份 -->
<div>
  <h3 class="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
    定时备份
    <a-tooltip v-if="!cloudSyncEnabled" title="需先启用云同步">
      <LockOutlined :style="{ fontSize: '12px', color: 'var(--muted-foreground)' }" />
    </a-tooltip>
  </h3>
  <div class="flex items-center justify-between mb-2">
    <span class="text-sm" :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }">
      启用定时上传
    </span>
    <a-switch
      v-model:checked="localSettings.autoBackup.enabled"
      :disabled="!cloudSyncEnabled"
      size="small"
    />
  </div>
  <div v-if="localSettings.autoBackup.enabled" class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span class="text-sm shrink-0">每</span>
      <a-input-number
        v-model:value="localSettings.autoBackup.interval"
        :min="1" :max="999" :step="1"
        :disabled="!cloudSyncEnabled"
        size="small"
        class="flex-1"
      />
      <a-select
        v-model:value="localSettings.autoBackup.unit"
        :options="backupUnitOptions"
        :disabled="!cloudSyncEnabled"
        size="small"
        class="w-24"
      />
    </div>
    <div class="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
      <span>cron:</span>
      <a-tag class="font-mono">{{ backupCron }}</a-tag>
    </div>
  </div>
</div>

<!-- 定时恢复 -->
<div>
  <h3 class="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
    定时恢复
    <a-tooltip title="⚠️ 自动恢复会覆盖本地数据，请谨慎启用">
      <ExclamationCircleOutlined :style="{ fontSize: '12px', color: 'var(--warning)' }" />
    </a-tooltip>
  </h3>
  <div class="flex items-center justify-between mb-2">
    <span class="text-sm" :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }">
      启用定时下载
    </span>
    <a-switch
      v-model:checked="localSettings.autoRestore.enabled"
      :disabled="!cloudSyncEnabled"
      size="small"
    />
  </div>
  <div v-if="localSettings.autoRestore.enabled" class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span class="text-sm shrink-0">每</span>
      <a-input-number
        v-model:value="localSettings.autoRestore.interval"
        :min="1" :max="999" :step="1"
        :disabled="!cloudSyncEnabled"
        size="small"
        class="flex-1"
      />
      <a-select
        v-model:value="localSettings.autoRestore.unit"
        :options="backupUnitOptions"
        :disabled="!cloudSyncEnabled"
        size="small"
        class="w-24"
      />
    </div>
    <div class="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
      <span>cron:</span>
      <a-tag class="font-mono">{{ restoreCron }}</a-tag>
    </div>
  </div>
</div>
```

**图标 import**（[SettingsDialog.vue:4](file:///c%3A/Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue#L4)）：
```typescript
import { KeyOutlined, SunOutlined, MoonOutlined, MonitorOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined, LockOutlined, ExclamationCircleOutlined } from "@antdv-next/icons";
```

## 4. Assumptions & Decisions

1. **不设置 = 不执行** —— 用户未启用时**完全没有后台逻辑**（无默认 5 分钟兜底）
2. **云同步未开启时定时配置 disabled** —— 开关置灰，不可点击；提示"需先启用云同步"
3. **两个完全独立** —— 备份/恢复各自开关、各自 (interval, unit)、各自 cron
4. **数字 1-999 整数** —— 防止负数/0/小数破坏 cron
5. **存 (interval, unit) 不存 cron 字符串** —— 简洁可靠
6. **不引入 cron 解析库** —— 用 `(unit, interval)` 实时计算下次时间
7. **调度在前端**（`setTimeout` 循环）
8. **备份失败不重试** —— 失败后等下一个周期
9. **自动恢复静默执行** —— 不弹确认对话框（用户启用 = 接受风险）
10. **自动恢复会覆盖本地** —— 这是用户明确要求的行为
11. **不展示"上次执行时间/结果"** —— 仅通过 toast 状态消息提示

## 5. Verification Steps

### 5.1 数据持久化
1. 启动应用，打开设置 → 云同步 → 启用
2. 启用"定时备份"、设置"每 5 分钟"
3. 启用"定时恢复"、设置"每 30 分钟"
4. 关闭弹框
5. 退出应用
6. 重新启动，打开设置
7. **预期**：两个开关为开、interval/unit 保留、cron 标签显示 `*/5 * * * *` 和 `0 */30 * * *`

### 5.2 依赖关系
1. 打开设置，**云同步关闭**
2. **预期**：「定时备份」「定时恢复」标题旁有 🔒 图标，开关 disabled，输入框 disabled
3. **启用云同步**
4. **预期**：开关和输入框全部 enabled

### 5.3 UI cron 实时更新
1. 启用"定时备份"
2. 修改 interval 1→5→30 → **预期** cron 实时变化 `*/1 * * * *` → `*/5 * * * *` → `*/30 * * * *`
3. 修改 unit 分钟→小时 → **预期** cron 变成 `0 */30 * * *`
4. 修改 unit 小时→天 → **预期** cron 变成 `0 0 */30 * *`
5. 同样测试"定时恢复"的 cron 标签

### 5.4 调度执行
1. 设置"定时备份" = 每 1 分钟
2. **预期 1 分钟内**：状态栏/消息提示"自动备份完成"，WebDAV 上出现新时间戳 db 文件
3. 设置"定时恢复" = 每 1 分钟
4. 修改本地数据（加一个 todo）然后等 1 分钟
5. **预期**：本地数据被远程覆盖回退到加 todo 之前的状态

### 5.5 修改间隔后重启
1. 第一次设置"每 30 分钟"，等 10 秒
2. 改为"每 1 分钟"
3. **预期 1 分钟内**：自动备份/恢复执行（不需等 30 分钟）

### 5.6 关闭云同步后停止
1. 设置"定时备份" = 每 1 分钟，云同步启用 → 等到执行成功
2. 关闭云同步
3. **预期**：1 分钟、5 分钟过去都没有自动执行；状态栏/消息也不再有"自动备份"

### 5.7 边界
1. interval=1, unit=minute → cron `*/1 * * * *`
2. interval=999, unit=day → cron `0 0 */999 * *`
3. interval 输入 0/负数 → 组件 min=1 阻止

### 5.8 单元 + 构建
```bash
cd c:\Users\nbn\workspace\github\doit
npx vue-tsc --noEmit
npm run tauri build
```

## 6. File List

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | src/types/index.ts | 新增 `BackupUnit` / `ScheduleConfig` + `autoBackup` / `autoRestore` 字段 |
| 新建 | src/utils/cron.ts | `intervalToCron` 和 `getNextRunTime` |
| 修改 | src/services/settingsService.ts | 三处：defaultSettings、getSettings、saveSettings |
| 修改 | src/App.vue | 初始化两字段 + 启动/监听/卸载 + 状态消息 |
| 修改 | src/services/autoSyncService.ts | 重写为两个独立 scheduleNext |
| 修改 | src/components/SettingsDialog.vue | 新增两个区块（备份/恢复）+ LockOutlined/ExclamationCircleOutlined 图标 |

## 7. Out of Scope

- 不支持"每周X"、"每月X"等复杂 cron 语义
- 不引入新依赖（npm/cargo）
- 不实现"上次执行时间/结果历史"
- 不实现失败重试/退避策略
- 不迁移到 Tauri 后台 cron
- 自动恢复不弹确认对话框（用户显式启用 = 接受覆盖风险）
