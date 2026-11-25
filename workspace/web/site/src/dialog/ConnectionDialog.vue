<script setup lang="ts">
import { ref } from "vue";
import Button from "../components/Button.vue";
import Dialog from "../components/Dialog.vue";
import Input from "../components/Input.vue";

const isOpen = ref(false);
import { useJobDb } from "../plugins/jobDb.js";

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL;
const COUCH_BASE_URL = import.meta.env.VITE_COUCH_BASE_URL;

const { connectSync, logout, isSyncEnabled, syncState } = useJobDb();

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
  } catch (err: any) {
    error.value = err?.message ?? "Could not connect";
  } finally {
    isLoading.value = false;
    username.value = "";
    password.value = "";
  }
}

async function handleLogout() {
  error.value = null;
  isLoading.value = true;

  try {
    await logout();
  } catch (err: any) {
    error.value = err?.message ?? "Could not log out";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <Button size="sm" @click="isOpen = true">
    Connection:
    <span v-if="!isSyncEnabled">Not Connected</span>
    <span v-else-if="syncState === 'denied'">Denied</span>
    <span v-else-if="syncState === 'error'">Error</span>
    <span v-else>Connected</span>
  </Button>
  <form @submit.prevent="handleSubmit">
    <Dialog v-model="isOpen" title="Settings" alertVariant="error">
      <template v-if="error" #alert>
        {{ error }}
      </template>
      <p>
        Connection Status:
        <strong>
          <span v-if="!isSyncEnabled">Not Connected</span>
          <span v-else-if="syncState === 'denied'">Connection Denied</span>
          <span v-else-if="syncState === 'error'">Connection Error</span>
          <span v-else>Connected</span>
        </strong>
      </p>

      <div v-if="isLoading || !isSyncEnabled">
        <Input
          id="username"
          label="Username"
          v-model="username"
          required
          :error="error != null"
        />
        <Input
          id="password"
          label="Password"
          v-model="password"
          type="password"
          required
          :error="error != null"
        />
      </div>

      <template #footer>
        <Button type="submit" :disabled="isLoading || isSyncEnabled">
          Login
        </Button>

        <Button
          type="button"
          :disabled="isLoading || !isSyncEnabled"
          @click="handleLogout"
        >
          Logout
        </Button>

        <Button
          type="button"
          variant="secondary"
          @click="isOpen = false"
          :disabled="isLoading"
        >
          Close
        </Button>
      </template>
    </Dialog>
  </form>
</template>
