# WebDAV 同步修复与增强计划

## 现状分析

### 已实现的部分
- WebDAV 配置 UI（设置弹窗中已有 URL/用户名/密码输入）
- `webdavService.ts`：`testConnection`、`uploadBackup`、`downloadBackup`、`listBackups` 四个功能
- `BackupDialog.vue`：手动上传/下载备份的弹窗
- 设置中 `cloudSync` 字段已完整定义并持久化

### 连接失败根因
1. **自签名证书问题**：群晖/飞牛 NAS 的 WebDAV 使用 HTTPS 自签名证书，Tauri WebView2 默认拒绝不受信任的证书，导致 `fetch()` 调用时抛出 `Failed to fetch` 网络错误
2. **路径发现机制问题**：`tryUrls()` 中 URL 拼接逻辑有 bug——它对 NAS 路径追加 `/webdav/` 的方式不对（将 `/webdav/` 拼接到用户输入 URL 的末尾，而不是尝试替换/发现路径）
3. **调试信息不足**：`testConnection` 中 catch 到错误后直接 `continue`，丢失了详细错误原因
4. **缺乏自动同步**：`cloudSync.enabled` 开关虽存在，但没有任何自动同步逻辑

---

## 修改方案

### 1. 修复自签名证书问题（核心）

**问题**：Tauri WebView2 拒绝 NAS 自签名 HTTPS 证书。

**方案**：Tauri 侧添加 `--ignore-certificate-errors` 启动参数。

**文件**：`src-tauri/src/main.rs` 或 `src-tauri/src/lib.rs`

**操作**：在 `#[cfg(debug_assertions)]` 块中设置环境变量 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 为 `--ignore-certificate-errors`。

> 注意：仅在 debug 模式下启用，release 模式不做此修改（安全原因）。如果用户在 release 模式下也需要，可以后续通过 Tauri 配置或 Rust 侧添加自定义证书信任逻辑。

### 2. 修复错误信息丢失问题

**问题**：`testConnection` 函数中 `catch { continue }` 吞掉了详细的网络错误信息，用户只看到"网络错误"。

**方案**：在 catch 中收集每个 URL 尝试的错误，最终一并返回。

**文件**：`src/services/webdavService.ts`

**操作**：
- 修改 `testConnection` 函数，在 catch 块中收集错误信息而不是直接 `continue`
- 最终返回时展示所有候选 URL 的完整错误信息，帮助用户诊断

### 3. 优化 `tryUrls` 路径发现

**问题**：当前 `tryUrls()` 对已包含路径的 URL（如 `https://192.168.1.100:5006`）追加 `/webdav/` 的逻辑可能错误。

**方案**：改进路径候选生成逻辑，增加更多常见的 NAS WebDAV 路径模式。

**文件**：`src/services/webdavService.ts`

**操作**：
- 候选 URL 生成更全面：
  1. 用户输入的原始 URL
  2. 原始 URL + `/`
  3. 原始 URL + `/webdav/`
  4. 原始 URL + `/webdav`
- 对于群晖 NAS，常见的路径是 `https://<ip>:5006`（而非 `5006/webdav/`）

### 4. 改进错误提示信息

**问题**：错误信息不够用户友好，用户难以知道如何排查。

**文件**：`src/services/webdavService.ts`

**操作**：
- 检查错误是否包含 `ERR_CERT` 相关关键词，给出针对自签名证书的明确提示
- 检查 HTTP 状态码（401/403/404）给出相应的建议

### 5. 增强 BackupDialog 的测试连接详细反馈

**问题**：测试连接成功后，用户不清楚连接的具体信息。

**文件**：`src/components/BackupDialog.vue`

**操作**：
- 显示更详细的连接成功信息（连接的 URL、HTTP 状态码）
- 连接失败时显示详细的错误信息而不是笼统的"连接失败"

### 6. 实现自动同步功能（核心功能增强）

**问题**：启用了 `cloudSync.enabled` 但没有任何自动同步逻辑。

**方案**：在 `App.vue` 中添加自动同步机制。

**文件**：
- `src/services/autoSyncService.ts`（新建）
- `src/App.vue`（修改）

**操作**：
1. 新建 `autoSyncService.ts`，提供以下功能：
   - `startAutoSync()` / `stopAutoSync()`：启动/停止定时同步
   - 同步策略：每 5 分钟检查一次
   - 上传条件：本地有数据且上次同步后有变化
   - 简单冲突策略：远程版本较新则下载覆盖，否则上传覆盖
2. 在 `App.vue` 的 `onMounted` 中根据 `settings.cloudSync.enabled` 决定是否启动自动同步
3. 监听 `todos` 和 `settings` 变化，标记"有未同步的变更"
4. 提供 `forceSync()` 方法供用户手动触发同步

---

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src-tauri/src/main.rs` 或 `src-tauri/src/lib.rs` | 修改 | 添加 debug 模式忽略证书错误 |
| `src/services/webdavService.ts` | 修改 | 修复 `tryUrls`、`testConnection` 错误信息 |
| `src/services/autoSyncService.ts` | **新建** | 自动同步逻辑 |
| `src/App.vue` | 修改 | 集成自动同步生命周期 |
| `src/components/BackupDialog.vue` | 修改 | 增强错误/成功信息展示 |

---

## 验证步骤

1. `npm run tauri dev` 启动 Tauri 应用
2. 在设置中配置 NAS WebDAV 地址、用户名、密码
3. 打开云备份弹窗，点击"测试连接"
4. 验证连接成功
5. 上传备份到 NAS
6. 从 NAS 下载恢复
7. 启用"云同步"开关，验证自动同步正常工作（修改待办后等待 5 分钟或手动触发同步）
