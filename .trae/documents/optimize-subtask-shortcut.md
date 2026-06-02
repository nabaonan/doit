# 优化：子任务输入也支持快捷键提交

## 问题描述

当前设置的添加快捷键（如 `Ctrl+Enter`）只对顶部的主输入框生效。当通过右键菜单添加子任务时，子任务的编辑输入框只响应 `Enter` 键，没有使用用户配置的快捷键。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/components/TodoItem.vue` | 修改 `onKeydown`，使其支持配置的快捷键提交 |

## 实现方案

### 方案分析

子任务的编辑输入框在 [TodoItem.vue](file:///c:/Users/nbn/workspace/github/doit/src/components/TodoItem.vue#L228-L237) 中：

```html
<a-input
  ref="editInput"
  v-model:value="localEditContent"
  variant="underlined"
  size="large"
  class="flex-1"
  @keydown="onKeydown"
  @blur="onSave"
/>
```

当前的 `onKeydown` 只处理了 `Enter` 和 `Escape`：

```ts
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    onSave();
  } else if (e.key === "Escape") {
    onCancel();
  }
}
```

需要修改为：除了 `Enter` 和 `Escape` 之外，也检查用户配置的快捷键（`props.settings.addTodoShortcut`），如果匹配则调用 `onSave()`。

### 实现步骤

#### Step 1: 修改 TodoItem.vue 的 `onKeydown`

在 `onKeydown` 函数中，增加对 `props.settings.addTodoShortcut` 的检查：

```ts
function onKeydown(e: KeyboardEvent) {
  const sc = props.settings.addTodoShortcut;
  if (sc) {
    if (
      e.key === sc.key &&
      e.ctrlKey === sc.ctrl &&
      e.shiftKey === sc.shift &&
      e.altKey === sc.alt &&
      e.metaKey === sc.meta
    ) {
      e.preventDefault();
      onSave();
      return;
    }
  }
  if (e.key === "Enter") {
    onSave();
  } else if (e.key === "Escape") {
    onCancel();
  }
}
```

这样当用户按下配置的快捷键（如 `Ctrl+Enter`）时，子任务的编辑输入框也会提交保存。

### 注意事项

- 保持 `Enter` 键仍然可用，作为默认提交方式
- 快捷键匹配逻辑与 TodoList.vue 中的 `onInputKeydown` 保持一致
- 遵循项目规范：不加注释、使用分号
