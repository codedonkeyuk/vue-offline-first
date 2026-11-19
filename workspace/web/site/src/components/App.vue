<script setup lang="ts">
import { ref } from "vue";
import SyncStatus from "./SyncStatus.vue";
import SyncLoginForm from "./SyncLoginForm.vue";
import Container from "./Container.vue";
import Card from "./Card.vue";
import MainToolbar from "./MainToolbar.vue";

const showLogin = ref(false);
</script>

<template>
  <MainToolbar />
  <Container>
    <Card>
      <SyncLoginForm
        v-if="showLogin"
        @done="showLogin = false"
        @cancel="showLogin = false"
      />
      <SyncStatus v-else @open-login="showLogin = true" />
    </Card>
  </Container>
</template>
