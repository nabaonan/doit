# Doit 多色彩主题切换设计文档

## 概述

为 Doit 桌面待办应用增加多套预设色彩风格（参考 antdv-next 的设计 Token 定制方案），让用户通过设置下拉一键切换。当前仅支持 3 套 system/light/dark 浅深模式，缺少色板差异化。

### 目标

1. 在保留 system/light/dark 浅深模式基础上，新增 6 套色彩风格
2. 项目自定义 CSS 变量（`--background`、`--primary` 等 18 个 token）与 antdv-next `ConfigProvider` 的 `theme.token` 同步切换
3. 设置项通过下拉切换，250ms debounce 实时持久化
4. 老用户无感升级（默认 `colorScheme: "default"` 与现状一致）

## 技术栈

- **前端**: Vue 3 + TypeScript
- **样式**: Tailwind CSS 4 + CSS 变量
- **UI 库**: antdv-next（已使用 `ConfigProvider`）
- **存储**: SQLite / localStorage（现有 settingsService）

## 6 套主题清单

| ID | 名称 | 主色 (light / dark) | 圆角 | 风格特征 |
|----|------|-------------------|------|---------|
| `default` | 默认 | `#5b6cd9` / `#8b9aff` | 0.625rem | 当前蓝紫中性（兼容现状） |
| `shadcn` | 类 shadcn | `#0a0a0a` / `#fafafa` | 0.5rem | 极简黑白锐利高对比 |
| `mui` | 类 MUI | `#1976d2` / `#90caf9` | 0.25rem | Material Design 蓝色阴影 |
| `cartoon` | 卡通 | `#ff8a00` / `#ffb74d` | 1rem | 鲜艳橙黄圆润，配合现有 ZCOOL 字体 |
| `dark` | 暗黑 | `#00e5ff` / `#00e5ff` | 0.5rem | 纯黑底 + 霓虹青强调色 |
| `illustration` | 莫兰迪 | `#a8b5a0` / `#9fa89a` | 0.75rem | 柔和米白莫兰迪色 |

`theme`（浅深）与 `colorScheme`（色板）正交组合，6 × 2 = 12 种最终视觉。`theme: "system"` 时跟随本机时区（18:00-06:00 视为深色）决定浅深，再叠加 `colorScheme`。

## 架构

```
User selects colorScheme
  ↓
SettingsDialog (localSettings.colorScheme)
  ↓ (250ms debounce)
App.vue handleSaveSettings → saveSettings
  ↓
watch(settings.value.colorScheme) → applyTheme()
  ↓
1) document.documentElement.setAttribute("data-theme", scheme)   ← CSS 变量切换
2) <a-config-provider :theme="{ algorithm, token: {...} }">     ← antdv token 同步
  ↓
[data-theme="x"] 块在 :root 与 .dark 下的 CSS 变量生效
所有子组件（自定义 + antdv）通过 var(--xxx) 读取新色板
```

## 数据流

```
SettingsDialog ──emit('save')──> App.vue
                                    ↓
                             saveSettings(value)
                                    ↓
                             settings.value = value
                                    ↓
                             watch → applyTheme()
                                    ↓
               ┌────────────────────┴────────────────────┐
               ↓                                         ↓
  setAttribute('data-theme', id)            <a-config-provider :theme="getAntTheme()">
               ↓                                         ↓
       CSS 变量切换                                antdv CSS-in-JS token 注入
               ↓                                         ↓
               └──────────────┬──────────────────────────┘
                              ↓
                       UI 全部组件重绘
```

## 数据模型

### `src/types/index.ts` 修改

新增类型与字段：

```ts
export type ColorScheme = "default" | "shadcn" | "mui" | "cartoon" | "dark" | "illustration";

export interface AppSettings {
  // ... 现有字段 ...
  theme: "system" | "light" | "dark";
  colorScheme: ColorScheme;   // 新增，默认 "default"
  // ...
}
```

老用户迁移：DB 读出 settings 若 `colorScheme` 字段缺失，运行时回退 `"default"`，不写回（避免意外覆盖其他字段）。

## 组件设计

### 1. `src/constants/themePresets.ts`（新增）

主题元数据集中管理，单文件 < 250 行：

```ts
import type { ColorScheme } from "../types";

export interface ThemePreset {
  id: ColorScheme;
  name: string;
  description: string;
  preview: { primary: string; background: string };
  antToken: { colorPrimary: string; borderRadius: number };
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "default", name: "默认", description: "蓝紫中性", preview: { primary: "#5b6cd9", background: "#ffffff" }, antToken: { colorPrimary: "#5b6cd9", borderRadius: 10 } },
  { id: "shadcn", name: "类 shadcn", description: "极简黑白", preview: { primary: "#0a0a0a", background: "#fafafa" }, antToken: { colorPrimary: "#0a0a0a", borderRadius: 8 } },
  { id: "mui", name: "类 MUI", description: "Material 蓝", preview: { primary: "#1976d2", background: "#f5f5f5" }, antToken: { colorPrimary: "#1976d2", borderRadius: 4 } },
  { id: "cartoon", name: "卡通", description: "鲜艳圆润", preview: { primary: "#ff8a00", background: "#fff8e7" }, antToken: { colorPrimary: "#ff8a00", borderRadius: 16 } },
  { id: "dark", name: "暗黑", description: "霓虹强调", preview: { primary: "#00e5ff", background: "#000000" }, antToken: { colorPrimary: "#00e5ff", borderRadius: 8 } },
  { id: "illustration", name: "莫兰迪", description: "柔和米白", preview: { primary: "#a8b5a0", background: "#f5f1e8" }, antToken: { colorPrimary: "#a8b5a0", borderRadius: 12 } },
];

export function getPreset(id: ColorScheme): ThemePreset {
  return THEME_PRESETS.find(p => p.id === id) ?? THEME_PRESETS[0];
}
```

### 2. `src/style.css`（修改）

把现有 `:root` 与 `.dark` 重命名为 `:root[data-theme="default"]` 与 `:root[data-theme="default"].dark`，新增 5 套主题块：

```css
:root[data-theme="default"] { /* 18 个 token 浅色值 */ }
:root[data-theme="default"].dark { /* 18 个 token 深色值 */ }

:root[data-theme="shadcn"] { /* 18 个 token 浅色值 */ }
:root[data-theme="shadcn"].dark { /* 18 个 token 深色值 */ }

/* mui / cartoon / dark / illustration 同上 */

:root:not([data-theme]) { /* 同 :root[data-theme="default"]，兜底缺失 data-theme 的场景 */ }
```

每套主题必须包含完整 18 个 token（`--radius` 是全局共享，不按主题区分）：

`--background` / `--foreground` / `--primary` / `--primary-foreground` / `--secondary` / `--secondary-foreground` / `--muted` / `--muted-foreground` / `--accent` / `--accent-foreground` / `--destructive` / `--border` / `--input` / `--ring` / `--card` / `--card-foreground` / `--popover` / `--popover-foreground`。

### 3. `src/App.vue`（修改）

```ts
import { getPreset, THEME_PRESETS } from "./constants/themePresets";
import type { ColorScheme } from "./types";

const currentAlgorithm = ref(antTheme.defaultAlgorithm);
const colorScheme = computed<ColorScheme>(() => settings.value.colorScheme ?? "default");

function applyTheme(theme: "system" | "light" | "dark", scheme: ColorScheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", scheme);

  let dark: boolean;
  if (theme === "dark") dark = true;
  else if (theme === "light") dark = false;
  else dark = isBeijingNight();
  root.classList.toggle("dark", dark);

  currentAlgorithm.value = dark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;
}

function getAntTheme() {
  const preset = getPreset(colorScheme.value);
  return {
    algorithm: currentAlgorithm.value,
    token: { colorPrimary: preset.antToken.colorPrimary, borderRadius: preset.antToken.borderRadius },
  };
}
```

模板：

```vue
<a-config-provider :theme="getAntTheme()" :wave="wave" :locale="zhCN">
```

监听：

```ts
watch([() => settings.value.theme, () => settings.value.colorScheme], () => {
  applyTheme(settings.value.theme, colorScheme.value);
});
```

`onMounted` 初始化时同样调用 `applyTheme(settings.value.theme, "default")`，确保挂载前/SSR 不会出现 default 不一致。

`startSystemThemeTimer` 内 60s tick 同时读取 `colorScheme.value`。

### 4. `src/components/SettingsDialog.vue`（修改）

外观分类下，主题 radio 下方新增色彩风格下拉：

```vue
<div>
  <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2">色彩风格</h4>
  <a-select v-model:value="localSettings.colorScheme" size="small" class="w-full">
    <a-select-option v-for="preset in themePresets" :key="preset.id" :value="preset.id">
      <div class="flex items-center gap-2">
        <span class="inline-block w-3 h-3 rounded-sm" :style="{ background: preset.preview.primary }" />
        <span>{{ preset.name }}</span>
        <span class="text-[var(--muted-foreground)] text-xs ml-1">- {{ preset.description }}</span>
      </div>
    </a-select-option>
  </a-select>
</div>
```

`import { THEME_PRESETS } from "../constants/themePresets"`，`const themePresets = THEME_PRESETS`。

localSettings 默认值同步更新：

```ts
const localSettings = ref<AppSettings>({
  // ...
  colorScheme: "default",
  // ...
});
```

跟随现有 `watch(() => props.open)` 同步 props 时，自动覆盖（无需额外处理）。

## 错误处理

| 场景 | 行为 |
|------|------|
| 老用户 DB 无 `colorScheme` 字段 | 运行时 `settings.value.colorScheme ?? "default"`，不主动写回 |
| `setAttribute("data-theme", "x")` 调用失败 | try/catch 包裹，失败时回退 `removeAttribute("data-theme")` 触发 default 兜底 |
| antdv-next ConfigProvider 渲染异常 | 沿用现有 `a-app` 包裹，错误由 antdv 内部处理 |
| 用户选择 `default` 后清空 `data-theme` | 显式 `setAttribute("data-theme", "default")` 保持显式，避免依赖 :not 兜底 |
| `colorScheme` 值不在联合类型中 | TS 编译时阻止，运行时不会出现 |

## 兼容性

- **DB schema**: settings 字段是 JSON 整体存读，新增 `colorScheme` 字段不影响老用户数据
- **CSS 变量**: 现有 90% 组件用 `var(--primary)` 等读取，重命名 `:root` → `:root[data-theme="default"]` 后默认行为不变
- **antdv-next**: `ConfigProvider` 已有 `:theme`，新增 token 字段无破坏性
- **TypeScript**: `AppSettings` 新增可选字段，TypeScript `exactOptionalPropertyTypes` 关闭时兼容（项目当前配置）

## 验证

### 类型检查
```bash
npm run build
```

### 手动验证矩阵（必做）

启动应用，逐个切换 6 套色彩风格 × 3 套浅深模式（system/light/dark），关键组合肉眼检查（每种风格至少验证 light + dark 两种状态 = 12 个最终视觉）：

- [ ] 主色按钮/勾选框变色
- [ ] 背景/前景色对应变化
- [ ] 圆角变化生效（Modal、Button、Input）
- [ ] 与现有 antdv 组件（Modal/Select/Switch）一致
- [ ] 暗黑 + 卡通 = 黑底 + 橙红强调（验证正交性）
- [ ] system 模式下 18:00-06:00 自动切深色

### 回归测试

- [ ] 已有的 FLIP 拖拽动画、长按完成、右键菜单无破坏
- [ ] 关闭/打开设置弹窗，主题设置正确还原
- [ ] 关闭/启动应用，主题持久化

## 实施范围

新增/修改文件清单：

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/constants/themePresets.ts` | 新增 | 6 套主题元数据 |
| `src/types/index.ts` | 修改 | 新增 `ColorScheme` 类型与字段 |
| `src/style.css` | 修改 | 6 套主题 CSS 块 |
| `src/App.vue` | 修改 | applyTheme 扩展、ConfigProvider token、watch |
| `src/components/SettingsDialog.vue` | 修改 | 色彩风格下拉 UI |

预计改动：5 个文件，新增 ~80 行（不含 CSS 中的 token 值，CSS 约 +200 行）。
