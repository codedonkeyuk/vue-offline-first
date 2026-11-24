<script setup lang="ts">
import { ref, watch } from "vue";
import { useJobDb } from "../plugins/jobDb.js";
import Button from "../components/Button.vue";
import Dialog from "../components/Dialog.vue";
import Input from "../components/Input.vue";

const emit = defineEmits<{
  (e: "created"): void;
}>();

const { saveTextDoc } = useJobDb();

const isOpen = ref(false);
const inputVar = ref<string>("");

watch(isOpen, (newValue) => {
  if (newValue) {
    inputVar.value = "";
  }
});

var onCreate = async () => {
  await saveTextDoc({
    title: inputVar.value,
    content: "New Document",
  });
  emit("created");
  isOpen.value = false;
};
</script>

<template>
  <Button size="sm" @click="isOpen = true">Create Text Documnent</Button>

  <Dialog v-model="isOpen" title="Create Documnent">
    <Input
      id="document-name"
      label="Document Name"
      type="text"
      v-model="inputVar"
      required
      autofocus
    />
    <template #footer>
      <Button
        variant="primary"
        size="sm"
        @click="onCreate"
        :disabled="!inputVar"
      >
        Create &amp; open
      </Button>
      <Button variant="secondary" size="sm" @click="isOpen = false">
        Close
      </Button>
    </template>
  </Dialog>
</template>
