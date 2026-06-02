# 修复 Windows 安装包图标

## 问题描述

Windows x64 NSIS 安装包（setup 安装包）的图标显示为系统默认图标，而不是应用的 logo 图标。

## 原因分析

1. **`icon.ico` 文件内容错误**：当前 `src-tauri/icons/icon.ico` 是由旧的 `generate-icons.cjs` 脚本生成的，该脚本生成的是**纯蓝色方块**（`#6b8fff`），而不是真正的 logo 图标（绿色渐变背景 + 白色勾选标记）。

2. **`generate-icons.mjs` 已有正确的 SVG logo**：该脚本包含正确的 logo 设计（绿色渐变圆角矩形 + 白色勾选路径），但从未被运行过，所以 `icon.ico` 仍然是旧版本。

3. **Tauri 使用 `icon.ico` 作为 NSIS 安装包图标**：在 `tauri.conf.json` 中配置了 `icons/icon.ico`，Tauri 构建时会用这个文件作为安装包的图标。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src-tauri/icons/icon.ico` | 重新生成（用 Tauri 官方工具） |
| `src-tauri/icons/32x32.png` | 重新生成 |
| `src-tauri/icons/128x128.png` | 重新生成 |
| `src-tauri/icons/128x128@2x.png` | 重新生成 |
| `src-tauri/icons/icon.icns` | 重新生成 |
| `src-tauri/icons/icon.png` | 重新生成 |
| `scripts/generate-icons.mjs` | 重写为使用 `tauri icon` 命令 |
| `package.json` | 新增 `generate-icons` 脚本 |

## 实现步骤

### Step 1: 在 package.json 中添加脚本

在 `package.json` 的 `scripts` 中添加 `generate-icons`。

### Step 2: 重写 generate-icons.mjs

改为先生成 1024x1024 的源 PNG，然后委托给 `npx tauri icon` 命令生成所有平台图标。Tauri 官方工具会生成正确格式的 `icon.ico`（包含 16/32/48/64/128/256 等多尺寸 PNG 的 ICO 容器）。

### Step 3: 运行脚本生成图标

```bash
npm run generate-icons
```

### Step 4: 重新构建

```bash
npm run tauri build
```

## 注意事项

- `tauri icon` 是 Tauri CLI 内置命令，能生成所有平台所需的正确图标格式
- 重新生成图标后，需要重新运行 `npm run tauri build` 才能看到安装包图标的变化
- `icon.ico` 现在由 Tauri 官方工具生成，格式完全符合 Windows 要求
