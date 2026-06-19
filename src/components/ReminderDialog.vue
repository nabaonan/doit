<script setup lang="ts">
import { ref, watch } from "vue";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

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

type RemindMode = "time" | "duration";

const mode = ref<RemindMode>("time");
const timeValue = ref<string>("");
const durationValue = ref<number>(1);
const durationUnit = ref<"hour" | "minute" | "second">("hour");

watch(() => props.open, (val) => {
  if (val) {
    mode.value = "time";
    timeValue.value = "";
    durationValue.value = 1;
    durationUnit.value = "hour";
  }
});

const unitOptions = [
  { value: "hour", label: "小时" },
  { value: "minute", label: "分钟" },
  { value: "second", label: "秒" },
];

function getDisabledTime(now: dayjs.Dayjs) {
  const currentHour = now.hour();
  const currentMinute = now.minute();
  const hours: number[] = [];
  const minutes: number[] = [];
  for (let h = 0; h < currentHour; h++) {
    hours.push(h);
  }
  for (let m = 0; m < currentMinute; m++) {
    minutes.push(m);
  }
  return { disabledHours: () => hours, disabledMinutes: () => minutes };
}

function onConfirm() {
  if (mode.value === "time") {
    if (!timeValue.value) return
    const today = dayjs().format("YYYY-MM-DD")
    const remindAt = dayjs(`${today} ${timeValue.value}`)
    if (remindAt.isBefore(dayjs())) return
    emit("confirm", remindAt.toISOString())
  } else {
    const remindAt = dayjs().add(durationValue.value, durationUnit.value)
    emit("confirm", remindAt.toISOString())
  }
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
    :width="400"
    @cancel="onClose"
    centered
  >
    <div class="space-y-4">
      <a-radio-group v-model:value="mode" class="flex gap-x-4">
        <a-radio value="time">指定时刻</a-radio>
        <a-radio value="duration">间隔时长</a-radio>
      </a-radio-group>

      <div v-if="mode === 'time'">
        <a-time-picker
          v-model:value="timeValue"
          value-format="HH:mm"
          format="HH:mm"
          :minute-step="5"
          :disabled-time="getDisabledTime"
          class="w-full"
          placeholder="选择提醒时刻"
        />
      </div>

      <div v-else class="flex items-center gap-1">
        <a-input-number
          v-model:value="durationValue"
          :min="1"
          :max="durationUnit === 'hour' ? 12 : durationUnit === 'minute' ? 720 : 3600"
          :step="durationUnit === 'hour' ? 1 : durationUnit === 'minute' ? 5 : 10"
          class="min-w-0 flex-1"
        />
        <a-select
          v-model:value="durationUnit"
          :options="unitOptions"
          style="width: 80px"
        />
      </div>

      <div class="flex items-center gap-2 pt-2" v-if="currentRemindAt">
        <a-button danger size="small" @click="emit('cancel-reminder'); onClose()">
          取消提醒
        </a-button>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <a-button @click="onClose">取消</a-button>
        <a-button
          type="primary"
          :disabled="mode === 'time' && !timeValue"
          @click="onConfirm"
        >
          确认
        </a-button>
      </div>
    </div>
  </a-modal>
</template>
