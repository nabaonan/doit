<script setup lang="ts">
import { VueDraggable } from "vue-draggable-plus";
import { computed } from "vue";
import TodoItem from "./TodoItem.vue";
import type { TodoItemNode, AppSettings } from "../types";

defineOptions({ name: "NestedTodoList" });

const props = defineProps<{
  modelValue: TodoItemNode[];
  settings: AppSettings;
  editingId: string | null;
  editContent: string;
  depth?: number;
  toggleComplete: (id: string) => void;
  startEdit: (node: TodoItemNode) => void;
  saveEdit: (content: string) => void;
  cancelEdit: () => void;
  deleteTodo: (id: string) => void;
  setTag: (id: string, tagId: string | null) => void;
  setCat: (id: string, catId: string | null) => void;
  addSubTodo: (parentId: string, content: string) => void;
}>();

const currentDepth = props.depth ?? 0;

const emit = defineEmits<{
  (e: "update:modelValue", value: TodoItemNode[]): void;
}>();

const list = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
</script>

<template>
  <VueDraggable
    v-model="list"
    group="todos"
    :animation="200"
    ghost-class="opacity-50"
    :force-fallback="true"
    :bubble-scroll="true"
    :scroll-sensitivity="100"
    :scroll-speed="20"
    :delay="500"
    :delay-on-touch-only="false"
  >
    <div v-for="element in list" :key="element.id" :data-todo-id="element.id">
      <TodoItem
        :todo="element"
        :settings="settings"
        :is-editing="editingId === element.id"
        :edit-content="editContent"
        :has-children="element.children.length > 0"
        :is-sub-task="!!element.parentId"
        :depth="currentDepth"
        @toggle-complete="toggleComplete(element.id)"
        @start-edit="startEdit(element)"
        @save-edit="(content: string) => saveEdit(content)"
        @cancel-edit="cancelEdit"
        @delete-todo="deleteTodo(element.id)"
        @set-tag="(tagId: string | null) => setTag(element.id, tagId)"
        @set-cat="(catId: string | null) => setCat(element.id, catId)"
        @add-sub-todo="(content: string) => addSubTodo(element.id, content)"
      />
      <NestedTodoList
        v-if="element.children.length > 0"
        v-model="element.children"
        :settings="settings"
        :editing-id="editingId"
        :edit-content="editContent"
        :depth="currentDepth + 1"
        :toggle-complete="toggleComplete"
        :start-edit="startEdit"
        :save-edit="saveEdit"
        :cancel-edit="cancelEdit"
        :delete-todo="deleteTodo"
        :set-tag="setTag"
        :set-cat="setCat"
        :add-sub-todo="addSubTodo"
      />
    </div>
  </VueDraggable>
</template>