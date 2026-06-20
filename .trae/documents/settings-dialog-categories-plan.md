# 设置弹窗改造：左侧分类菜单 + 右侧内容滚动

## 目标

重构 `SettingsDialog.vue`，采用左右两栏布局：

- 左侧：分类菜单（外观 / 交互 / 同步 / 数据），点击后右侧自动滚动到对应分类
- 右侧：可滚动内容区，按分类用分隔符（`<a-divider>`）切分各个设置项
- 加宽弹窗（460px → 760px），降低弹窗高度（依赖 modal 内部滚动，不再撑满视口）

## 分类与设置项映射

| 分类 | 设置项 | 锚点 id |
| --- | --- | --- |
| 外观 | 主题 / 字体 / 快乐工作 | `sec-appearance` |
| 交互 | 完成方式 / 添加快捷键 / 自定义标签 | `sec-interaction` |
| 同步 | 云同步 / 定时备份 / 定时恢复 | `sec-sync` |
| 数据 | 数据管理（导出/导入/清空） | `sec-data` |

## 需要修改的文件

只有一个文件需要改：

### `src/components/SettingsDialog.vue`

#### 1. 调整 modal 尺寸

- `:width="460"` → `:width="760"`
- 移除 implicit 全屏高度：modal body 内容用 `flex h-[520px] max-h-[70vh]` 容器包裹，让右侧内容区独立滚动

#### 2. 模板结构改造

弹窗内层从 `space-y-5` 单列流改为两列 flex 布局：

```html
<div class="flex h-[520px] max-h-[70vh] gap-0">
  <!-- 左侧菜单 -->
  <div class="w-[160px] shrink-0 border-r border-[var(--border)] py-2 overflow-y-auto">
    <a-menu
      mode="inline"
      :items="categoryMenuItems"
      :selectedKeys="[activeCategory]"
      @select="handleCategorySelect"
      style="border-inline-end: none !important;"
    />
  </div>

  <!-- 右侧内容 -->
  <div ref="contentRef" class="flex-1 overflow-y-auto pl-5 pr-1 py-1 space-y-5">
    <!-- 外观 -->
    <section id="sec-appearance" ref="sectionAppearance">
      <h3 class="text-xs font-medium text-[var(--muted-foreground)] mb-3">外观</h3>
      ...原"主题"、"字体"、"快乐工作"三个 block...
    </section>

    <a-divider />

    <!-- 交互 -->
    <section id="sec-interaction" ref="sectionInteraction">
      <h3 class="text-xs font-medium text-[var(--muted-foreground)] mb-3">交互</h3>
      ...原"完成方式"、"快捷键"、"自定义标签"三个 block...
    </section>

    <a-divider />

    <!-- 同步 -->
    <section id="sec-sync" ref="sectionSync">
      <h3 class="text-xs font-medium text-[var(--muted-foreground)] mb-3">同步</h3>
      ...原"云同步"、"定时备份"、"定时恢复"三个 block...
    </section>

    <a-divider />

    <!-- 数据 -->
    <section id="sec-data" ref="sectionData">
      <h3 class="text-xs font-medium text-[var(--muted-foreground)] mb-3">数据</h3>
      ...原"数据管理" block（导出/导入/清空）...
    </section>
  </div>
</div>
```

#### 3. 脚本部分

- 新增 `contentRef = ref<HTMLElement | null>(null)`，配合四个 `sectionAppearance/Interaction/Sync/Data` 模板 ref
- 新增 `activeCategory = ref("appearance")`
- 新增 `categoryMenuItems`：

```ts
const categoryMenuItems = [
  { key: "appearance",  label: "外观", icon: () => h(BgColorsOutlined) },
  { key: "interaction", label: "交互", icon: () => h(InteractionOutlined) },
  { key: "sync",        label: "同步", icon: () => h(CloudSyncOutlined) },
  { key: "data",        label: "数据", icon: () => h(DatabaseOutlined) },
];
```

- `handleCategorySelect({ key })`：
  ```ts
  function handleCategorySelect({ key }: { key: string }) {
    activeCategory.value = key;
    const map: Record<string, any> = {
      appearance: sectionAppearance.value,
      interaction: sectionInteraction.value,
      sync: sectionSync.value,
      data: sectionData.value,
    };
    const el = map[key] as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  ```

- （可选增强）`contentRef` 监听 scroll，自动更新 `activeCategory` 让左侧高亮跟随：

  ```ts
  function onContentScroll() {
    if (!contentRef.value) return;
    const containerTop = contentRef.value.getBoundingClientRect().top;
    let current = "appearance";
    for (const [key, ref] of [
      ["appearance", sectionAppearance.value],
      ["interaction", sectionInteraction.value],
      ["sync", sectionSync.value],
      ["data", sectionData.value],
    ] as const) {
      const el = ref as HTMLElement | null;
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top - containerTop < 40) current = key;
    }
    activeCategory.value = current;
  }
  ```

  模板中 `@scroll="onContentScroll"`。

- 在 `<a-modal>` 标签加 `:bodyStyle="{ padding: '16px 0' }"`，让左右两栏贴边。

- 图标导入补充：`BgColorsOutlined, InteractionOutlined, CloudSyncOutlined, DatabaseOutlined` from `@antdv-next/icons`。

## 编码规范遵守

- 不加注释
- `.vue` 文件使用分号
- 继续使用 `defineProps<T>()` / `defineEmits<T>()` 现有结构
- 不新增外部依赖，沿用 antdv-next `Menu` / `Divider`（项目其他文件已使用 `a-menu`，见 `TimeView.vue`）
- 不修改任何 props / emits 签名，外部 `App.vue` 调用无需改动

## 验证步骤

1. `npm run dev` 启动浏览器开发模式
2. 打开设置弹窗，目视检查：
   - 弹窗宽度明显变宽（≈760px）
   - 弹窗高度受限（≈520px），不再撑满屏幕
   - 左侧出现 4 项分类菜单（外观/交互/同步/数据）
   - 右侧内容按分组排列，组与组之间有 divider
3. 依次点击左侧 4 个分类，验证右侧平滑滚动到对应 section
4. 手动滚动右侧内容，验证左侧高亮项跟随切换
5. 逐项测试所有原有设置项（主题切换、字体、快乐工作、完成方式滑块、快捷键录制、标签增删、云同步/备份/恢复开关、导出/导入/清空）行为不变
6. 关闭弹窗后再打开，验证 `watch(props.open)` 同步逻辑仍正常工作
7. `npm run build` 确认无 TS 错误
