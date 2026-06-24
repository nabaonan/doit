# 分类默认设置功能计划

## 概述

在 `CategoryDialog` 中增加「设为默认」能力。设置为默认的分类在应用启动后会自动选中，并默认加载该分类下的待办。用户可随时取消默认设置。

**关键决策**：
- 存储方式：在 `AppSettings` 新增独立字段 `defaultCategoryId: string | null`（不修改 `Category` 接口，保持模型简洁，避免多个"默认"的歧义）
- 按钮行为：可取消（toggle）—— 点击已是默认的分类会取消默认
- 视觉样式：文字「默认」徽标 + 右侧「设为默认」按钮（hover 出现）
- 持久化时机：随分类列表保存时一起持久化（沿用现有 save 模式）
- 应用时机：App 挂载时，若默认分类仍存在则自动选中；不存在则降级为「未分类」

---

## 当前状态分析

**已有能力**：
- 分类列表存储在 `AppSettings.categories: Category[]`（[src/types/index.ts:103](file:///Users/nbn/workspace/github/doit/src/types/index.ts#L103)）
- `CategoryDialog` 增删改已闭环，emit `save` 时由 App.vue 写回 settings
- `App.vue` 顶部 `selectedCatId`（[src/App.vue:67](file:///Users/nbn/workspace/github/doit/src/App.vue#L67)）驱动 `activeTodos` 过滤（[src/App.vue:88-96](file:///Users/nbn/workspace/github/doit/src/App.vue#L88-L96)）
- `settingsService` 负责读写 settings（[src/services/settingsService.ts](file:///Users/nbn/workspace/github/doit/src/services/settingsService.ts)）

**关键缺口**：
- `selectedCatId` 是内存变量，App 重启后重置为 `__none__`，无法记忆用户偏好
- `Category` 模型没有"默认"标记位
- `CategoryDialog` 不接受默认分类相关 prop

---

## 详细变更

### 1. 数据模型：[src/types/index.ts](file:///Users/nbn/workspace/github/doit/src/types/index.ts)

在 `AppSettings` 接口（约 95-113 行）中新增可选字段：

```ts
export interface AppSettings {
  // ... 现有字段 ...
  categories: Category[]
  defaultCategoryId?: string | null   // ← 新增
  // ... 其余字段 ...
}
```

设为可选 + `string | null`：
- `null` 或缺失 = 无默认分类
- 字符串 = 默认分类的 id

### 2. 设置读写服务：[src/services/settingsService.ts](file:///Users/nbn/workspace/github/doit/src/services/settingsService.ts)

**2.1 默认值初始化**（约 10-34 行 `defaultSettings`）：

```ts
const defaultSettings: AppSettings = {
  // ... 现有字段 ...
  defaultCategoryId: null,   // ← 新增
  // ...
}
```

**2.2 读取**（约 56-76 行 `getSettings` 返回值）：

```ts
return {
  // ... 现有字段 ...
  defaultCategoryId: kv["defaultCategoryId"]
    ? JSON.parse(kv["defaultCategoryId"])
    : null,
}
```

**2.3 写入**（约 79-127 行 `saveSettings`）：

新增一对 INSERT：

```ts
await (db as ...).execute(
  "INSERT INTO settings (key, value) VALUES ($1, $2)",
  ["defaultCategoryId", JSON.stringify(settings.defaultCategoryId ?? null)]
)
```

**注意**：`saveSettings` 当前是"全删全插"模式，缺字段会丢设置；新增这一行后必须配套。

### 3. 分类管理弹框：[src/components/CategoryDialog.vue](file:///Users/nbn/workspace/github/doit/src/components/CategoryDialog.vue)

**3.1 新增 props**：

```ts
const props = defineProps<{
  open: boolean;
  categories: Category[];
  defaultCategoryId?: string | null;   // ← 新增
  todos: TodoItem[];
}>();
```

**3.2 新增 emits**（替换/扩展 `save`）：

```ts
const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "save", payload: {
    categories: Category[];
    defaultCategoryId: string | null;
  }): void;   // ← 改成对象载荷
}>();
```

> **破坏性变更**：将 `save` emit 的载荷从 `Category[]` 改为对象 `{ categories, defaultCategoryId }`，避免父组件需要维护两次事件。

**3.3 新增本地状态**：

```ts
const localDefaultId = ref<string | null>(props.defaultCategoryId ?? null);
```

**3.4 watch 同步**：

```ts
watch(() => props.open, (val) => {
  if (val) {
    localCategories.value = JSON.parse(JSON.stringify(props.categories || []));
    localDefaultId.value = props.defaultCategoryId ?? null;   // ← 新增
    newCatColor.value = "#3B82F6";
    editingId.value = null;
  }
});
```

**3.5 新增 toggle 函数**：

```ts
function toggleDefault(id: string) {
  localDefaultId.value = localDefaultId.value === id ? null : id;
}

function clearDefaultIfDeleted() {
  if (localDefaultId.value && !localCategories.value.some(c => c.id === localDefaultId.value)) {
    localDefaultId.value = null;
  }
}
```

在 `removeCategory` 的 `remove` 闭包内调用 `clearDefaultIfDeleted()`（删除后自检）。

**3.6 修改 `onSave`**：

```ts
function onSave() {
  emit("save", {
    categories: JSON.parse(JSON.stringify(localCategories.value)),
    defaultCategoryId: localDefaultId.value,
  });
  emit("update:open", false);
}
```

**3.7 模板：行内新增"默认"徽标 + 按钮**

利用 [ColorLabelRow.vue](file:///Users/nbn/workspace/github/doit/src/components/ColorLabelRow.vue#L140) 已有的 `#actions` slot 扩展：

```vue
<ColorLabelRow
  v-for="cat in localCategories"
  :key="cat.id"
  :item="cat"
  :presets="colorPresets"
  :editing="editingId === cat.id"
  @update:editing="(val) => onEditChange(cat.id, val)"
  @update:name="updateName"
  @update:color="updateColor"
  @delete="removeCategory"
>
  <template #actions>
    <!-- 「默认」徽标：当前默认常驻显示 -->
    <span
      v-if="localDefaultId === cat.id"
      class="text-[10px] font-medium text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded"
    >
      默认
    </span>
    <!-- 「设为默认」按钮：hover 时显示 -->
    <a-button
      v-else
      type="text"
      size="small"
      class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
      title="设为默认"
      @click="toggleDefault(cat.id)"
    >
      设为默认
    </a-button>
  </template>
</ColorLabelRow>
```

**布局影响**：
- 默认分类行：色块 + 名称（flex-1） + 「默认」徽标 + 删除图标
- 非默认分类行：色块 + 名称（flex-1） + （hover）「设为默认」按钮 + 删除图标
- 两种状态下右侧区域总宽度接近（徽标紧凑、按钮短），不会引起行高跳变

**3.8 `localDefaultId` 类型修正**

`localDefaultId.value === id` 比较时 `localDefaultId` 可能为 `null`，需 `id` 与 `null` 比较：实际 `id` 必为 string，所以 `localDefaultId.value === id` 在 `localDefaultId` 为 `null` 时始终 false（合法），无需特殊处理。

### 4. 应用层：[src/App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue)

**4.1 默认 settings 增加字段**（约 30-62 行）：

```ts
const settings = ref<AppSettings>({
  // ... 现有字段 ...
  categories: [],
  defaultCategoryId: null,   // ← 新增
  // ...
});
```

**4.2 `onMounted` 中应用默认分类**（约 139-207 行）：

在 `settings.value = await getSettings();` 之后、用户任何操作之前插入：

```ts
// 若设置了默认分类且仍存在，自动选中
if (settings.value.defaultCategoryId) {
  const exists = (settings.value.categories || []).some(
    c => c.id === settings.value.defaultCategoryId
  );
  if (exists) {
    selectedCatId.value = settings.value.defaultCategoryId;
  }
}
```

**4.3 模板 CategoryDialog 传新 prop**：

```vue
<CategoryDialog
  v-model:open="showCategoryDialog"
  :categories="settings.categories"
  :default-category-id="settings.defaultCategoryId"
  :todos="todos"
  @save="handleSaveCategories"
/>
```

**4.4 改造 `handleSaveCategories`**（约 242-263 行）：

```ts
async function handleSaveCategories(payload: {
  categories: Category[];
  defaultCategoryId: string | null;
}) {
  const oldIds = new Set(settings.value.categories.map((c) => c.id));
  const newIds = new Set(payload.categories.map((c) => c.id));
  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  settings.value.categories = payload.categories;
  settings.value.defaultCategoryId = payload.defaultCategoryId;
  try {
    await saveSettings(settings.value);
  } catch {
    try {
      settings.value = await getSettings();
    } catch {}
  }
  if (removedIds.length > 0) {
    for (const todo of todos.value) {
      if (todo.catId && removedIds.includes(todo.catId)) {
        await updateTodo(todo.id, { catId: null });
      }
    }
    todos.value = await getAllTodos();
    // 若当前选中的就是被删除的分类，且没有新的默认承接，降级为「未分类」
    if (
      selectedCatId.value !== "__none__" &&
      removedIds.includes(selectedCatId.value) &&
      payload.defaultCategoryId !== selectedCatId.value
    ) {
      selectedCatId.value = "__none__";
    }
  } else if (
    payload.defaultCategoryId &&
    payload.defaultCategoryId !== selectedCatId.value
  ) {
    // 没删除任何分类但用户改了默认，立即应用（更直观的反馈）
    selectedCatId.value = payload.defaultCategoryId;
  }
  showCategoryDialog.value = false;
}
```

**4.5 自检：被删除的分类若是默认，自动清空**（已在 CategoryDialog 3.5 `clearDefaultIfDeleted` 实现，App.vue 不必重复）。

### 5. 数据库迁移

- `settings` 表是 `key-value` 文本表，新 key `defaultCategoryId` 直接插入即可
- 老用户首次启动后 `getSettings` 读不到该 key，返回 `null` —— 行为正确，无需迁移脚本

### 6. 类型校验

- `defaultCategoryId` 类型为 `string | null`（undefined 也安全，JSON 序列化 null 字符串还原回 null）
- `JSON.parse(null_string)` 会抛错；故 `kv["defaultCategoryId"] ? JSON.parse(...) : null` 用真值判断兼容
- `settingsService.saveSettings` 写入时 `JSON.stringify(null)` 得到字符串 `"null"`，读时 `JSON.parse("null")` 得 `null`，完全对称

---

## 涉及文件清单

| 文件 | 变更类型 | 摘要 |
|------|---------|------|
| [src/types/index.ts](file:///Users/nbn/workspace/github/doit/src/types/index.ts) | 编辑 | `AppSettings` 新增 `defaultCategoryId` |
| [src/services/settingsService.ts](file:///Users/nbn/workspace/github/doit/src/services/settingsService.ts) | 编辑 | 默认值 / 读 / 写 三处增 `defaultCategoryId` |
| [src/components/CategoryDialog.vue](file:///Users/nbn/workspace/github/doit/src/components/CategoryDialog.vue) | 编辑 | 新增 prop / emit 改载荷 / `localDefaultId` 状态 / 行内徽标与按钮 / `onSave` 改 |
| [src/App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue) | 编辑 | 默认 settings / onMounted 应用默认 / CategoryDialog 传 prop / `handleSaveCategories` 改载荷 |

未涉及文件（无需改动）：
- `ColorLabelRow.vue` —— 已有 `#actions` slot，直接复用
- `ColorLabelAdder.vue` —— 与默认分类无关
- `TagDialog.vue` / 标签相关 —— 标签不参与"默认"概念
- `TitleBar.vue` —— 默认分类的下拉选中在 onMounted 中通过 `selectedCatId` 自动驱动，无需改 TitleBar
- `todoService.ts` —— 选中分类的过滤逻辑不变

---

## 验证步骤

### 编译验证
- `npm run build` 退出码 0
- 无 TypeScript 报错（特别注意 `handleSaveCategories` 的载荷类型与 `emit("save", ...)` 类型一致）

### 功能验证（手动）
1. **基本设置**：
   - 打开分类管理 → 列表中点"设为默认"（hover 出现）→ 徽标「默认」显示
   - 取消选中分类（顶部分类下拉切到「未分类」） → 点「保存」关闭弹框
   - 关闭应用再打开 → 顶部下拉自动选中默认分类，待办列表只显示该分类
   
2. **切换默认**：
   - 设置 A 为默认 → 徽标「默认」在 A 行
   - 设置 B 为默认（hover B 行点击按钮） → 徽标「默认」自动从 A 移到 B
   - 关闭弹框 → 顶部下拉自动切到 B

3. **取消默认**：
   - hover 当前默认分类 → 显示「默认」徽标（不是按钮） → 此时想取消默认该怎么办？
   
   **注意**：用户已选「文字徽标」样式，但徽标是状态显示。取消默认的入口在哪？
   - 选项 X：徽标本身点击可取消（徽标可点击）
   - 选项 Y：需再 hover 一次，让徽标切换为按钮（不直观）
   
   **建议调整为**：徽标也是可点击的，hover 时显示 "× 取消默认" 提示。后续在执行时与用户确认这个细节。

4. **删除默认分类**：
   - 默认 A → 删除 A（确认弹框）→ A 消失，徽标消失 → 保存 → 顶部下拉降级为「未分类」
   
5. **兼容老用户**：
   - 清掉 settings 表（dev 模式）→ 启动 → 无默认分类 → 顶部下拉仍为「未分类」

6. **数据完整性**：
   - 关闭应用时 DB 写入 → 重新打开 → 恢复默认分类
   - 在「按时间查看」视图下也应自动应用（onMounted 不区分视图，只在 App 根级别）

---

## 关键决策与假设

- **决策 1**：默认分类信息存放在 `AppSettings` 顶层字段（而非 `Category.isDefault`）
  - 理由：单点真相，避免多默认歧义；删除分类时 `handleSaveCategories` 容易补刀（清空已不存在的 id 引用）
  
- **决策 2**：`save` 事件的载荷从 `Category[]` 升级为 `{ categories, defaultCategoryId }` 对象
  - 理由：父组件一次拿到完整状态，避免维护两次 emit
  - 代价：破坏 API 兼容性，但目前仅 `App.vue` 一处使用，影响范围小

- **决策 3**：不在 TitleBar 顶部加"已默认"标识（星星/徽章）
  - 理由：UI 简洁优先，徽标已在管理弹框中提供，顶部下拉选中已能表达"当前选中"
  - 可选：后续若需要可在 `TitleBar` 加个空心/实心小图标指示（不在本计划范围）

- **决策 4**：保存分类后立即应用默认选中（无需重启）
  - 理由：用户操作 → 立即看到反馈，符合预期
  - 副作用：保存后用户被"瞬移"到默认分类视图（可接受，已是惯常模式）

- **假设**：用户已用 `TagDialog` 模式管理过标签，对「按行操作 + 徽标指示 + hover 按钮」的模式已熟悉
