<script setup lang="ts">
import { ref } from "vue";
import SyncStatus from "./SyncStatus.vue";
import SyncLoginForm from "./SyncLoginForm.vue";

const showLogin = ref(false);
</script>

<template>
  <SyncLoginForm
    v-if="showLogin"
    @done="showLogin = false"
    @cancel="showLogin = false"
  />
  <SyncStatus v-else @open-login="showLogin = true" />
</template>
