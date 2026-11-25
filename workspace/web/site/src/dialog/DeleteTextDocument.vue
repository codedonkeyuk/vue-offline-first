<script setup lang="ts">
import { ref } from "vue";
import { useJobDb } from "../plugins/jobDb.js";
import Button from "../components/Button.vue";
import Dialog from "../components/Dialog.vue";
import type { TextDoc } from "@vue-offline-first/db-config";

const emit = defineEmits<{
  (e: "deleted"): void;
}>();

const { record } = defineProps<{
  record: TextDoc;
}>();

const { remove } = useJobDb();

const isOpen = ref(false);

var onDelete = async () => {
  if (record._id) {
    await remove(record._id);
    emit("deleted");
  }
  isOpen.value = false;
};
</script>

<template>
  <Button size="sm" variant="secondary" @click="isOpen = true">Delete</Button>

  <Dialog v-model="isOpen" title="Delete Document">
    <p>
      <strong> Are you sure you want to delete "{{ record.title }}"? </strong>
    </p>
    <template #footer>
      <Button variant="primary" size="sm" @click="onDelete"> Delete </Button>
      <Button variant="secondary" size="sm" @click="isOpen = false">
        Close
      </Button>
    </template>
  </Dialog>
</template>
