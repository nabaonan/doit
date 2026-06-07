<script setup lang="ts">
import { ref, computed } from "vue";
import { Modal, message } from "antdv-next";
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@antdv-next/icons";
import { testConnection, uploadBackup, downloadBackup } from "../services/webdavService";
import type { TodoItem, AppSettings } from "../types";

const props = defineProps<{
  open: boolean;
  todos: TodoItem[];
  settings: AppSettings;
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "restore", data: { todos: TodoItem[]; settings: AppSettings }): void;
}>();

const connecting = ref(false);
const connected = ref<boolean | null>(null);
const uploading = ref(false);
const downloading = ref(false);
const uploadSuccess = ref(false);
const downloadSuccess = ref(false);

const webdavConfig = computed(() => props.settings.cloudSync);

async function handleTestConnection() {
  const { webdavUrl, webdavUsername, webdavPassword } = webdavConfig.value;
  if (!webdavUrl) {
    message.warning("请先配置 WebDAV 地址");
    return;
  }
  connecting.value = true;
  connected.value = null;
  try {
    const result = await testConnection(webdavUrl, webdavUsername, webdavPassword);
    connected.value = result.ok;
    if (result.ok) {
      message.success("连接成功");
    } else {
      message.error(result.message);
    }
  } catch {
    connected.value = false;
    message.error("连接失败，请检查地址和网络");
  } finally {
    connecting.value = false;
  }
}

async function handleUpload() {
  const { webdavUrl, webdavUsername, webdavPassword } = webdavConfig.value;
  if (!webdavUrl) {
    message.warning("请先配置 WebDAV 地址");
    return;
  }
  uploading.value = true;
  uploadSuccess.value = false;
  try {
    await uploadBackup(webdavUrl, webdavUsername, webdavPassword, {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        todos: props.todos,
        settings: props.settings,
      },
    });
    uploadSuccess.value = true;
    message.success("备份上传成功");
  } catch (e: any) {
    message.error(e.message || "上传失败");
  } finally {
    uploading.value = false;
  }
}

async function handleDownload() {
  const { webdavUrl, webdavUsername, webdavPassword } = webdavConfig.value;
  if (!webdavUrl) {
    message.warning("请先配置 WebDAV 地址");
    return;
  }

  Modal.confirm({
    title: "确认恢复备份？",
    content: "此操作将覆盖当前所有待办数据和设置，确认继续？",
    okText: "确认恢复",
    cancelText: "取消",
    okButtonProps: { danger: true },
    onOk: async () => {
      downloading.value = true;
      downloadSuccess.value = false;
      try {
        const data = await downloadBackup(webdavUrl, webdavUsername, webdavPassword);
        downloadSuccess.value = true;
        message.success("备份下载成功，正在恢复数据...");
        emit("restore", data.data);
      } catch (e: any) {
        message.error(e.message || "下载失败");
      } finally {
        downloading.value = false;
      }
    },
  });
}

function onCancel() {
  emit("update:open", false);
}
</script>

<template>
  <a-modal
    :open="props.open"
    title="云备份"
    :footer="null"
    :width="420"
    @cancel="onCancel"
    centered
    destroyOnHidden
  >
    <div class="flex flex-col gap-4">
      <!-- 连接状态 -->
      <div class="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
        <span class="text-sm text-[var(--foreground)]">WebDAV 连接</span>
        <div class="flex items-center gap-2">
          <span
            v-if="connected === true"
            class="text-xs text-green-600 flex items-center gap-1"
          >
            <CheckCircleOutlined /> 已连接
          </span>
          <span
            v-else-if="connected === false"
            class="text-xs text-red-500 flex items-center gap-1"
          >
            <CloseCircleOutlined /> 连接失败
          </span>
          <a-button
            size="small"
            :loading="connecting"
            @click="handleTestConnection"
          >
            {{ connected === null ? "测试连接" : "重新测试" }}
          </a-button>
        </div>
      </div>

      <!-- 上传 -->
      <div class="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
        <div class="flex flex-col">
          <span class="text-sm text-[var(--foreground)]">上传备份</span>
          <span class="text-xs text-[var(--muted-foreground)]">将当前数据上传到 WebDAV</span>
        </div>
        <a-button
          type="primary"
          :loading="uploading"
          :disabled="!webdavConfig.webdavUrl"
          @click="handleUpload"
        >
          <template #icon><CloudUploadOutlined /></template>
          {{ uploading ? "上传中..." : "上传" }}
        </a-button>
      </div>

      <!-- 下载 -->
      <div class="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
        <div class="flex flex-col">
          <span class="text-sm text-[var(--foreground)]">下载恢复</span>
          <span class="text-xs text-[var(--muted-foreground)]">从 WebDAV 下载备份并覆盖本地数据</span>
        </div>
        <a-button
          :loading="downloading"
          :disabled="!webdavConfig.webdavUrl"
          @click="handleDownload"
        >
          <template #icon><CloudDownloadOutlined /></template>
          {{ downloading ? "下载中..." : "恢复" }}
        </a-button>
      </div>

      <!-- 提示 -->
      <div class="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] p-2 rounded">
        <p>提示：WebDAV 地址和认证信息请在「设置」中配置。</p>
        <p>上传会同时创建带时间戳的备份文件和 latest.json。</p>
      </div>
    </div>
  </a-modal>
</template>
