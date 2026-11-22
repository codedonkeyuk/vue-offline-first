<script setup lang="ts">
import { ref } from "vue";
import SyncStatus from "./SyncStatus.vue";
import SyncLoginForm from "./SyncLoginForm.vue";
import Container from "./Container.vue";
import Card from "./Card.vue";
import MainToolbar from "./MainToolbar.vue";
import Input from "./Input.vue";

const inputVar = ref<string>("Moo");

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
    <Input
      id="my_new_field"
      label="My New Field"
      type="text"
      v-model="inputVar"
      required
      help-text="You need help"
      error
    />
    value: {{ inputVar }}
  </Container>
</template>
