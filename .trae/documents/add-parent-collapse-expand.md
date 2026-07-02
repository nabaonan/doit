# 父任务展开/收起功能

## Summary

为有子任务的父任务添加展开/收起功能。父任务最左侧新增一个箭头按钮，点击后切换其子树可见性。状态仅在内存中维护（不持久化），保持改动最小且不污染数据模型。

## Current State Analysis

- `TodoItem.vue` 已通过 `hasChildren` prop 标识父任务，父任务左侧的勾选框已禁用并置灰
- `NestedTodoList.vue` 通过 `v-if="element.children.length > 0"` 递归渲染子任务列表
- `TodoList.vue` 维护 `nestedTodos` 树形状态，并通过 `data-todo-id` 属性配合 `getBoundingClientRect` 实现 FLIP 动画
- `types/index.ts` 中 `TodoItem` / `TodoItemNode` 都不含 `collapsed` 字段；`todoService.ts` 也没有相关持久化逻辑
- 整个项目没有现成的 collapse/expand 模式（grep 验证：无 `collapsed` / `CaretRight` / `Chevron`）

## Proposed Changes

### 1. `src/components/TodoList.vue`

**新增**：
- 引入 `collapsedIds: Set<string>` ref，存放当前收起的父任务 id
- 引入 `handleToggleCollapse(id: string)` 方法：在 set 中添加/删除该 id
- 将 `collapsedIds` 与 `toggleCollapse` 通过 props 传给根 `NestedTodoList`

**为什么**：与现有 `editingId` / `editContent` 的状态归属模式保持一致；`TodoList` 负责所有 UI 视图状态。

### 2. `src/components/NestedTodoList.vue`

**新增 props**：
- `collapsedIds: Set<string>` — 收起状态集合
- `toggleCollapse: (id: string) => void` — 切换回调

**修改**：
- 把当前 `<NestedTodoList v-if="element.children.length > 0" ... />` 条件改为
  `v-if="element.children.length > 0 && !collapsedIds.has(element.id)"`
- 将新增 props 透传给递归调用的子 `NestedTodoList`

**为什么**：只有最外层 `TodoList` 拥有状态，递归实例通过 props 透传（树深度有限，prop drilling 可接受；不引入 provide/inject 以保持改动最小）。

### 3. `src/components/TodoItem.vue`

**修改 import**：
- 从 `@antdv-next/icons` 增补 `CaretRightOutlined`（用于箭头图标）

**新增 emit**：
- `(e: "toggle-collapse"): void`

**修改 template（非 readonly、非编辑态的 flex 容器内）**：
- 在最左侧（`<a-config-provider>` 之前）插入：
  ```html
  <button
    v-if="hasChildren"
    type="button"
    class="shrink-0 w-5 h-5 flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-transform duration-200"
    :class="{ 'rotate-90': /* expanded */ }"
    @click.stop="emit('toggle-collapse')"
    @mousedown.stop
  >
    <CaretRightOutlined :style="{ fontSize: '14px' }" />
  </button>
  ```
- `rotate-90` 的判定来源：根据当前是否收起（`collapsed`），收起时为 0deg（默认），展开时旋转 90° 朝下
- 为此新增一个 `defineProps` 字段：`collapsed?: boolean`（可选，默认 `false`），由父级 `NestedTodoList` 传入 `!collapsedIds.has(element.id)`

**为什么**：
- 位置在最左侧：满足"父级任务最左侧"的要求
- `@click.stop` 阻断冒泡，避免误触发行级 dblclick 编辑或 contextmenu
- `@mousedown.stop` 阻断 SortableJS 拖拽拦截（与 CLAUDE.md 中"交互按钮"规则一致）
- `rotate-90` 用 Tailwind transition，比切换两个图标更轻量
- 箭头 `CaretRightOutlined` 与现有 `@antdv-next/icons` 风格统一

**修改 props 定义**：增补 `collapsed?: boolean`（新增字段，不破坏现有调用）

**为什么 readonly 分支不加按钮**：CLAUDE.md 显示 `readonly` 模式当前未被 `NestedTodoList` 使用，是历史遗留，不在本任务范围。

## State Flow

```
NestedTodoList 渲染 TodoItem
       │
       │  props: collapsed = !collapsedIds.has(parent.id)
       │  emit:  toggle-collapse
       ▼
TodoList 监听 toggleCollapse(id)
       │
       ▼
更新 collapsedIds（Set 增删）
       │
       ▼
props 变化触发 NestedTodoList 重渲染
       │
       ▼
v-if 条件控制子树渲染
       │
       ▼
FLIP 动画（TodoList.vue 已有的 watch + getBoundingClientRect）平滑过渡
```

## Assumptions & Decisions

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 持久化 | 仅内存（`Set`） | 用户未要求持久化；最小改动原则。如需持久化可后续扩展为在 `TodoItem` 加 `collapsed: boolean` 字段 + DB schema 迁移 |
| 状态归属 | `TodoList.vue` 拥有 | 与现有 `editingId` 等 UI 状态模式一致 |
| 图标 | `CaretRightOutlined` + `rotate-90` | 与现有 antdv-next 图标体系统一；旋转动画比切换图标更轻量 |
| 收起时的子树动画 | 不做 | 复杂度高于价值；FLIP 已处理可见项的位移 |
| 展开时的新子项动画 | 不做 | 同上；保持简单 |

## Verification Steps

1. `npm run dev` 启动 Vite 开发服务器
2. 创建父任务 A 并为其添加 2-3 个子任务
3. 验证：父任务最左侧出现箭头按钮（朝右），勾选框保持置灰禁用
4. 点击箭头 → 箭头旋转 90° 朝下，子任务列表消失，下方任务上移（FLIP 动画平滑）
5. 再次点击 → 箭头回正，子任务重新出现
6. 验证：拖拽父任务仍正常工作（点击按钮不会误触拖拽）
7. 验证：右键父任务仍能弹出菜单（按钮不阻断 contextmenu）
8. 验证：父任务的勾选框点击仍然无效
9. 验证：普通（无子）任务不显示箭头按钮
10. 验证：折叠状态下新增子任务（通过右键菜单"子任务"），子任务出现且新子任务进入编辑态
11. `npm run build` 确保 TypeScript 类型检查通过
