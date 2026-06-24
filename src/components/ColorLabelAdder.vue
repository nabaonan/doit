<script setup lang="ts">
import { ref, watch } from "vue";
import ColorPickerPanel from "./ColorPickerPanel.vue";

interface PresetGroup {
  label?: string;
  key?: string;
  colors: string[];
  defaultOpen?: boolean;
}

const props = withDefaults(
  defineProps<{
    presets: PresetGroup[];
    placeholder?: string;
    addText?: string;
    triggerSize?: number;
    defaultColor?: string;
  }>(),
  {
    placeholder: "输入名称，回车添加",
    addText: "添加",
    triggerSize: 32,
    defaultColor: "#3B82F6",
  },
);

const emit = defineEmits<{
  (e: "add", payload: { name: string; color: string }): void;
}>();

const name = ref("");
const color = ref(props.defaultColor);

// 父组件重置 defaultColor 时同步本地
watch(
  () => props.defaultColor,
  (v) => {
    if (v) color.value = v;
  },
);

function add() {
  const n = name.value.trim();
  if (!n) return;
  emit("add", { name: n, color: color.value });
  // 重置名称输入，颜色保留（方便连续添加同色项）
  name.value = "";
}

function onColorChange(val: string | string[]) {
  color.value = Array.isArray(val) ? val[0] : val;
}
</script>

<template>
  <div class="flex gap-2 mb-3">
    <ColorPickerPanel
      :value="color"
      :presets="presets"
      :trigger-size="triggerSize"
      @update:value="onColorChange"
    />
    <a-input
      v-model:value="name"
      :placeholder="placeholder"
      size="middle"
      @pressEnter="add"
      class="flex-1"
    />
    <a-button type="primary" :disabled="!name.trim()" @click="add">
      {{ addText }}
    </a-button>
  </div>
</template>
