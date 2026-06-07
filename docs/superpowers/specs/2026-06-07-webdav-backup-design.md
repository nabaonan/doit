# Doit WebDAV 云备份设计文档

## 概述

为 Doit 桌面待办应用增加 WebDAV 云备份功能，支持用户将待办数据和设置上传到自建 NAS（WebDAV 协议），以及从远程下载恢复数据。

## 技术栈

- **前端**: Vue 3 + TypeScript
- **网络**: 原生 `fetch` API（Base64 Basic Auth）
- **协议**: WebDAV (PUT/GET/PROPFIND)
- **存储**: localStorage（浏览器模式）/ Tauri plugin-store（Tauri 模式）

## 数据流

```
用户触发上传 → serializeTodos() → JSON.stringify → PUT → WebDAV 服务器
用户触发下载 → GET → WebDAV 服务器 → JSON.parse → deserialize → 写入本地存储 → 刷新 UI
```

## 备份文件格式

```json
{
  "version": 1,
  "exportedAt": "2026-06-07T14:30:22+08:00",
  "data": {
    "todos": [
      { "id": "uuid", "text": "...", "completed": false, "order": 0, "createdAt": "...", "updatedAt": "..." }
    ],
    "settings": {
      "weekStartDay": 1,
      "theme": "system"
    }
  }
}
```

## 文件命名

- `doit-backup_latest.json` — 始终指向最新备份（覆盖写入），用于快速恢复
- `doit-backup_YYYY-MM-DD_HHmmss.json` — 带时间戳的历史备份

## 组件设计

### 1. `src/services/webdavService.ts`（新增）

核心服务，封装 WebDAV 操作：

- `uploadBackup(url, username, password, data)` — 上传备份
- `downloadBackup(url, username, password)` — 下载 latest.json
- `listBackups(url, username, password)` — 列出历史备份
- `testConnection(url, username, password)` — 测试连接

内部使用 `fetch`，认证头为 `Authorization: Basic ${btoa(username:password)}`。

### 2. `src/types/index.ts`（修改）

`AppSettings` 新增字段：

```typescript
webdavUrl?: string;
webdavUsername?: string;
webdavPassword?: string;
```

### 3. `src/components/BackupDialog.vue`（新增）

备份管理弹窗，包含：
- WebDAV 连接状态显示
- 「上传备份」按钮
- 「下载恢复」按钮（带确认弹窗）
- 历史备份列表（可选）

### 4. `src/components/SettingsDialog.vue`（修改）

在设置弹窗中新增 WebDAV 配置区域：
- WebDAV 地址输入框
- 用户名输入框
- 密码输入框
- 「测试连接」按钮

### 5. `src/App.vue`（修改）

- 新增 `showBackupDialog` 响应式状态
- 新增 `handleUploadBackup` / `handleDownloadBackup` 方法
- 协调备份/恢复流程

## 密码安全

- **Tauri 模式**: 使用 `@tauri-apps/plugin-store` 加密存储
- **浏览器模式**: 存储在 localStorage（明文，受浏览器沙箱保护）

## 错误处理

| 场景 | 用户提示 |
|------|----------|
| 连接失败 | "无法连接到 WebDAV 服务器，请检查地址和网络" |
| 认证失败 | "认证失败，请检查用户名和密码" |
| 数据格式不兼容 | "备份文件格式不兼容" |
| 网络超时 | "连接超时，请稍后重试" |

## 用户操作流程

### 上传备份
1. 用户点击「上传备份」
2. 序列化当前 todos + settings
3. PUT 到 WebDAV（latest.json + 时间戳文件）
4. 提示成功/失败

### 下载恢复
1. 用户点击「下载恢复」
2. 弹出确认框
3. 用户确认后 GET 下载 latest.json
4. 反序列化，写入本地存储
5. 刷新界面
6. 提示成功/失败
