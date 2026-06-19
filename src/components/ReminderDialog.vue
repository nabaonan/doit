<script setup lang="ts">
import { ref, watch } from "vue";
import dayjs from "dayjs";

const props = defineProps<{
  open: boolean;
  todoId: string;
  todoContent: string;
  currentRemindAt: string | null;
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "confirm", remindAt: string): void;
  (e: "cancel-reminder"): void;
}>();

const durationValue = ref<number>(1);
const durationUnit = ref<"hour" | "minute" | "second">("hour");

watch(() => props.open, (val) => {
  if (val) {
    durationValue.value = 1;
    durationUnit.value = "hour";
  }
});

const unitOptions = [
  { value: "hour", label: "小时" },
  { value: "minute", label: "分钟" },
  { value: "second", label: "秒" },
];

function onConfirm() {
  const remindAt = dayjs().add(durationValue.value, durationUnit.value)
  emit("confirm", remindAt.toISOString())
}

function onClose() {
  emit("update:open", false)
}
</script>

<template>
  <a-modal
    :open="props.open"
    title="设置提醒"
    :footer="null"
    width="auto"
    @cancel="onClose"
    centered
  >
    <div class="space-y-4 px-2">
      <div class="flex items-center justify-center">
        <span class="text-sm text-[var(--muted-foreground)]">在</span>
        <a-input-number
          v-model:value="durationValue"
          :min="1"
          :max="durationUnit === 'hour' ? 12 : durationUnit === 'minute' ? 720 : 3600"
          :step="durationUnit === 'hour' ? 1 : durationUnit === 'minute' ? 5 : 10"
          class="w-20"
        />
        <span class="w-2" />
        <a-select
          v-model:value="durationUnit"
          :options="unitOptions"
          style="width: 80px"
        />
        <span class="text-sm text-[var(--muted-foreground)] ml-2">后提醒</span>
      </div>

      <div class="flex items-center gap-2" v-if="currentRemindAt">
        <a-button danger size="small" @click="emit('cancel-reminder'); onClose()">
          取消提醒
        </a-button>
      </div>

      <div class="flex justify-end gap-2">
        <a-button @click="onClose">取消</a-button>
        <a-button type="primary" @click="onConfirm">确认</a-button>
      </div>
    </div>
  </a-modal>
</template>
