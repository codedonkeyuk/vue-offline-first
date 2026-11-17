<script setup lang="ts">
import { ref } from "vue";
import { useJobDb } from "../plugins/jobDb.js";

const emit = defineEmits<{
  done: [];
}>();

const { logout } = useJobDb();

const error = ref<string | null>(null);
const isLoading = ref(false);

async function handleLogout() {
  error.value = null;
  isLoading.value = true;

  try {
    await logout();
    emit("done");
  } catch (err: any) {
    error.value = err?.message ?? "Could not log out";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div>
    <button type="button" :disabled="isLoading" @click="handleLogout">
      {{ isLoading ? "Logging out..." : "Logout" }}
    </button>

    <p v-if="error">{{ error }}</p>
  </div>
</template>
