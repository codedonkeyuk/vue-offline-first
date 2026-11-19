<script setup lang="ts">
import { ref } from "vue";
import { useJobDb } from "../plugins/jobDb.js";
import Button from "./Button.vue";

const emit = defineEmits<{
  done: [];
  cancel: [];
}>();

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL;
const COUCH_BASE_URL = import.meta.env.VITE_COUCH_BASE_URL;

const { connectSync } = useJobDb();

const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const isLoading = ref(false);

async function handleSubmit() {
  error.value = null;
  isLoading.value = true;

  try {
    const res = await fetch(`${AUTH_API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Login failed");
    }

    await connectSync({
      remoteBaseUrl: COUCH_BASE_URL,
      remoteDbName: data.dbName,
      token: data.token,
    });

    emit("done");
  } catch (err: any) {
    error.value = err?.message ?? "Could not connect";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div>
      <label>
        Username
        <input v-model="username" type="text" required />
      </label>
    </div>

    <div>
      <label>
        Password
        <input v-model="password" type="password" required />
      </label>
    </div>

    <p v-if="error">{{ error }}</p>

    <Button type="submit" :disabled="isLoading">
      {{ isLoading ? "Connecting..." : "Login & Sync" }}
    </Button>

    <Button
      type="button"
      :disabled="isLoading"
      variant="secondary"
      @click="emit('cancel')"
    >
      Cancel
    </Button>
  </form>
</template>
