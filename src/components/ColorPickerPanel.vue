<script setup lang="ts">
import { computed, h } from "vue";

const props = withDefaults(
  defineProps<{
    value: string;
    presets: { label?: string; key?: string; colors: string[]; defaultOpen?: boolean }[];
    size?: "small" | "middle" | "large";
    triggerSize?: number;
    inline?: boolean;
  }>(),
  {
    size: "small",
    triggerSize: 32,
    inline: false,
  },
);

const emit = defineEmits<{
  (e: "update:value", value: string | string[]): void;
}>();

const triggerStyle = computed(() => ({
  width: `${props.triggerSize}px`,
  height: `${props.triggerSize}px`,
}));

function normalize(hex: string): string {
  if (!hex) return "";
  const v = hex.toLowerCase();
  return v.startsWith("#") ? v : `#${v}`;
}

function isCurrent(color: string): boolean {
  return normalize(color) === normalize(props.value);
}

function isBright(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 192;
}

function renderPresetsOnly({ extra }: { extra: { components: { Presets: any } } }) {
  return h(extra.components.Presets);
}

function onUpdate(val: string | string[]) {
  emit("update:value", val);
}

function pickColor(color: string) {
  emit("update:value", color);
}

const collapseItems = computed(() =>
  props.presets.map((preset, idx) => {
    const key = `panel-${preset.key ?? idx}`;
    return {
      key,
      label: preset.label,
      content: h(
        "div",
        { class: "ant-color-picker-presets-items" },
        preset.colors.map((color) =>
          h(
            "div",
            {
              key: color,
              class: [
                "ant-color-picker-presets-color",
                isCurrent(color) ? "ant-color-picker-presets-color-checked" : "",
                isBright(color) ? "ant-color-picker-presets-color-bright" : "",
              ],
              onClick: () => pickColor(color),
            },
            h("div", { class: "ant-color-picker-color-block" }, [
              h("div", {
                class: "ant-color-picker-color-block-inner",
                style: { background: color },
              }),
            ]),
          ),
        ),
      ),
    };
  }),
);

const activeKeys = computed(() =>
  collapseItems.value
    .map((item, idx) => {
      const preset = props.presets[idx];
      const { defaultOpen = true } = preset;
      return defaultOpen ? item.key : null;
    })
    .filter((k): k is string => !!k),
);
</script>

<template>
  <div
    v-if="inline"
    class="ant-color-picker-inner ant-color-picker-inner-content"
  >
    <div class="ant-color-picker-presets">
      <a-collapse
        :defaultActiveKey="activeKeys"
        ghost
        :items="collapseItems"
      />
    </div>
  </div>
  <a-color-picker
    v-else
    :value="props.value"
    :presets="props.presets"
    value-format="hex"
    :size="props.size"
    :panelRender="renderPresetsOnly"
    @update:value="onUpdate"
  >
    <div
      class="rounded-md border border-[var(--border)] cursor-pointer shrink-0 transition-shadow hover:shadow-md"
      :style="{ ...triggerStyle, backgroundColor: props.value }"
    />
  </a-color-picker>
</template>
