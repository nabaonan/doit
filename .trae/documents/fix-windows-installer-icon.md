# 修复 Windows 安装包图标

## 问题描述

Windows x64 NSIS 安装包（setup 安装包）的图标显示为系统默认图标，而不是应用的 logo 图标。

## 原因分析

1. **`icon.ico` 文件内容错误**：之前由旧脚本生成的 `icon.ico` 是纯蓝色方块，不是真正的 logo。

2. **缺少 `installerIcon` 配置**：Tauri 2 的 NSIS 配置需要显式指定 `installerIcon` 字段来设置安装包图标。当前 `tauri.conf.json` 中 `bundle.windows.nsis` 只配置了 `languages`，没有指定 `installerIcon`。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src-tauri/tauri.conf.json` | 在 `bundle.windows.nsis` 中添加 `installerIcon` 配置 |
| `src-tauri/icons/icon.ico` | 已用 Tauri 官方工具重新生成 |
| `scripts/generate-icons.mjs` | 已重写为使用 `tauri icon` 命令 |
| `package.json` | 已新增 `generate-icons` 脚本 |

## 实现步骤

### Step 1: 在 tauri.conf.json 中添加 installerIcon

在 `bundle.windows.nsis` 中添加 `installerIcon` 字段，指向 `icons/icon.ico`：

```json
"nsis": {
  "installerIcon": "icons/icon.ico",
  "languages": [
    "SimpChinese",
    "English"
  ]
}
```

### Step 2: 提交并推送

将改动提交并推送到 GitHub，触发 CI 重新构建。

## 注意事项

- `installerIcon` 是 Tauri 2 NSIS 配置支持的字段，用于设置安装包（setup.exe）的图标
- `icon.ico` 已由 `npx tauri icon` 命令生成，包含 16/32/48/64/128/256 等多尺寸 PNG
- 需要重新运行 CI 构建才能看到效果
