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
| `src-tauri/icons/icon.ico` | 重新生成（用正确的 logo） |
| `src-tauri/icons/32x32.png` | 重新生成 |
| `src-tauri/icons/128x128.png` | 重新生成 |
| `src-tauri/icons/128x128@2x.png` | 重新生成 |
| `src-tauri/icons/icon.icns` | 重新生成 |
| `src-tauri/icons/icon.png` | 重新生成 |
| `package.json` | 新增 `generate-icons` 脚本 |

## 实现步骤

### Step 1: 在 package.json 中添加脚本

在 `package.json` 的 `scripts` 中添加：

```json
"generate-icons": "node scripts/generate-icons.mjs"
```

### Step 2: 运行脚本生成图标

```bash
npm run generate-icons
```

这会重新生成所有图标文件，包括：
- `icon.ico` — 用于 Windows 安装包图标和应用程序图标
- `icon.icns` — 用于 macOS
- `32x32.png`, `128x128.png`, `128x128@2x.png` — 用于 Tauri 配置中引用的 PNG 图标
- `icon.png` — 通用图标

### Step 3: 验证

确认 `icon.ico` 文件大小已更新（应比原来的 28KB 大，因为包含了 6 个尺寸的 PNG 数据）。

## 注意事项

- `generate-icons.mjs` 中的 SVG 设计包含绿色渐变背景 + 白色勾选标记，与应用的 logo 一致
- 脚本会生成 16/32/48/64/128/256 共 6 个尺寸的 PNG 嵌入到 `icon.ico` 中，确保在不同缩放级别下都清晰
- 重新生成图标后，需要重新运行 `npm run tauri build` 才能看到安装包图标的变化
- `sharp` 依赖已在 `devDependencies` 中安装好（`sharp@^0.34.5`）
