<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useJobDb } from "../plugins/jobDb.js";
import Button from "./Button.vue";

const emit = defineEmits<{
  openLogin: [];
}>();

const {
  isSyncEnabled,
  syncState,
  syncError,
  disconnectSync,
  getAllByType,
  saveTextDoc,
} = useJobDb();

const docCount = ref<number | null>(null);
const statusMessage = ref<string | null>(null);

onMounted(async () => {
  try {
    const existing = await getAllByType("text_document");

    if (existing.length === 0) {
      await saveTextDoc({
        title: "My Diary",
        content: "It was a Tuesday, and I farted.",
      });
      docCount.value = 1;
      statusMessage.value = "Created initial test document.";
    } else {
      docCount.value = existing.length;
      statusMessage.value = "Loaded existing documents.";
    }
  } catch (err: any) {
    statusMessage.value = err?.message ?? "Failed to check documents";
  }
});

async function handleDisconnect() {
  await disconnectSync();
}
</script>

<template>
  <div>
    <div>
      <strong>Database:</strong>
      <span v-if="!isSyncEnabled">Local Only</span>
      <span v-else-if="syncState === 'syncing'">Syncing Remotely...</span>
      <span v-else-if="syncState === 'paused'">Synced Remotely</span>
      <span v-else-if="syncState === 'denied'">Sync Denied</span>
      <span v-else-if="syncState === 'error'">Sync Error</span>
      <span v-else>Connected (Idle)</span>
    </div>

    <p v-if="docCount !== null">
      <strong>Text Documents:</strong> {{ docCount }}
    </p>
    <p v-if="statusMessage">{{ statusMessage }}</p>
    <p v-if="syncError">{{ syncError }}</p>

    <Button v-if="!isSyncEnabled" type="button" @click="emit('openLogin')">
      Connect Remote Sync
    </Button>

    <Button v-else type="button" @click="handleDisconnect">
      Disconnect Sync
    </Button>

    <p v-if="syncError">{{ syncError }}</p>
  </div>
</template>
