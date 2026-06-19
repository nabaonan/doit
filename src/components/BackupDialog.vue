<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { message } from "antdv-next";
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@antdv-next/icons";
import { testConnection, uploadDbBackup, downloadDbBackup } from "../services/webdavService";
import { closeDb, getDb } from "../services/db";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types";

async function diagnoseDbPaths() {
  try {
    await invoke("diagnose_db_paths");
  } catch (e) {
    console.error("diagnose_db_paths failed", e);
  }
}

const props = defineProps<{
  open: boolean;
  settings: AppSettings;
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "data-changed"): void;
}>();

// 弹窗打开时立即诊断 db 路径
onMounted(() => {
  diagnoseDbPaths();
});
watch(
  () => props.open,
  (open) => {
    if (open) diagnoseDbPaths();
  }
);

const connecting = ref(false);
const connected = ref<boolean | null>(null);
const connectionMessage = ref("");
const uploading = ref(false);
const downloading = ref(false);

const webdavConfig = computed(() => props.settings.cloudSync);

async function handleTestConnection() {
  const { webdavUrl, webdavUsername, webdavPassword } = webdavConfig.value;
  if (!webdavUrl) {
    message.warning("请先配置 WebDAV 地址");
    return;
  }
  connecting.value = true;
  connected.value = null;
  connectionMessage.value = "";
  try {
    const result = await testConnection(webdavUrl, webdavUsername, webdavPassword);
    connected.value = result.ok;
    connectionMessage.value = result.message;
    if (result.ok) {
      message.success("连接成功");
    } else {
      message.error(result.message);
    }
  } catch {
    connected.value = false;
    connectionMessage.value = "连接失败，请检查地址和网络";
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
  try {
    const result = await uploadDbBackup(webdavUrl, webdavUsername, webdavPassword);
    message.success(result || "数据库备份上传成功");
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

  uploading.value = true;
  try {
    await downloadDbBackup(webdavUrl, webdavUsername, webdavPassword);
    // 下载完成后重新初始化数据库
    await closeDb();
    await getDb();
    message.success("数据库恢复成功");
    emit("data-changed");
    emit("update:open", false);
  } catch (e: any) {
    message.error(e.message || "下载失败");
  } finally {
    uploading.value = false;
  }
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
      <!-- 连接测试 -->
      <div class="flex flex-col gap-2 p-3 rounded-lg border border-[var(--border)]">
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--foreground)]">WebDAV 连接</span>
          <a-button
            size="small"
            :loading="connecting"
            @click="handleTestConnection"
          >
            {{ connected === null ? "测试连接" : "重新测试" }}
          </a-button>
        </div>
        <div v-if="connected === true" class="flex items-center gap-1 text-xs text-green-600">
          <CheckCircleOutlined /> 已连接
        </div>
        <div v-else-if="connected === false" class="flex items-center gap-1 text-xs text-red-500">
          <CloseCircleOutlined /> 连接失败
        </div>
        <div
          v-if="connectionMessage"
          class="text-xs whitespace-pre-wrap break-all bg-[var(--muted)] p-2 rounded mt-1"
          :class="connected ? 'text-green-700' : 'text-red-600'"
        >
          {{ connectionMessage }}
        </div>
      </div>

      <!-- 上传 -->
      <div class="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
        <div class="flex flex-col">
          <span class="text-sm text-[var(--foreground)]">上传数据库</span>
          <span class="text-xs text-[var(--muted-foreground)]">将本地 SQLite 数据库同步到 WebDAV</span>
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
          <span class="text-xs text-[var(--muted-foreground)]">从 WebDAV 下载数据库并覆盖本地数据</span>
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
        <p>上传会同时创建带时间戳的备份文件 (.db) 和 doit-db-latest.db。</p>
      </div>
    </div>
  </a-modal>
</template>
