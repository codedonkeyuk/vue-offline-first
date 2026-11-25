<script setup lang="ts">
import { useRouter } from "vue-router";
import { useJobDb } from "../plugins/jobDb.js";
import type { TextDoc } from "@vue-offline-first/db-config";
import { onMounted, ref, toRaw } from "vue";
import InputTextArea from "../components/InputTextArea.vue";
import ButtonBar from "../components/ButtonBar.vue";
import Button from "../components/Button.vue";
import Card from "../components/Card.vue";
import Input from "../components/Input.vue";

const { id } = defineProps<{ id?: string }>();

const router = useRouter();

const { getById, saveTextDoc } = useJobDb();
const document = ref<TextDoc | null>(null);

onMounted(async () => {
  if (id) {
    document.value = await getById(id);
  }
});

const save = async () => {
  if (document?.value) {
    await saveTextDoc(document.value);
    router.push({ name: "main" });
  }
};
</script>
<template>
  <card>
    <h1>Edit Document</h1>
  </card>
  <card v-if="document">
    <Input
      id="document-content"
      label="Document Title"
      v-model="document.title"
    />
    <InputTextArea
      id="document-content"
      label="Document Content"
      :rows="15"
      :model-value="document.content ?? ''"
      @update:model-value="document.content = $event"
    />
  </card>
  <card v-if="document">
    <ButtonBar>
      <Button @click="save">Save</Button>
      <Button variant="secondary" :to="{ name: 'main' }">Close</Button>
    </ButtonBar>
  </card>
</template>
<style scoped></style>
