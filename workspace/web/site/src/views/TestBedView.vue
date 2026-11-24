<script setup lang="ts">
import { ref } from "vue";
import SyncStatus from "../components/SyncStatus.vue";
import SyncLoginForm from "../components/SyncLoginForm.vue";
import Container from "../components/Container.vue";
import Card from "../components/Card.vue";
import Input from "../components//Input.vue";
import InputTextArea from "../components/InputTextArea.vue";
import ToastContainer from "../components/ToastContainer.vue";
import WarningDisplay from "../components/WarningDisplay.vue";
import { useToast } from "../composable/useToast.js";
import { useWarning } from "../composable/useWarning.js";

const { error } = useWarning();
const inputVar = ref<string>("Moo");
const inputTextAreaVar = ref<string>("Poo");

const showLogin = ref(false);

const { warning } = useToast();

const triggerToastWarning = () => {
  warning("Your session will expire in 2 minutes.");
};

const triggerWarning = () => {
  error({ message: "Connection lost. Retrying...", scope: "global" });
};
</script>

<template>
  <ToastContainer />
  <WarningDisplay />
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
    <br />
    <InputTextArea
      id="my_new_text_area"
      label="My New Text Area"
      v-model="inputTextAreaVar"
      required
      help-text="You need help textarea"
      error
    />
    value: {{ inputTextAreaVar }}
    <br />
    <button @click="triggerToastWarning">show tost warning</button>
    <button @click="triggerWarning">show warning</button>
  </Container>
</template>
