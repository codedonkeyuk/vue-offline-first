<script setup lang="ts">
import { ref } from "vue";
import Button from "../components/Button.vue";
import Dialog from "../components/Dialog.vue";

const isOpen = ref(false);
</script>

<template>
  <Button size="sm" @click="isOpen = true">Setting</Button>

  <Dialog v-model="isOpen" title="Settings">
    <p>Settings options go here.</p>

    <template #footer>
      <Button variant="secondary" size="sm" @click="isOpen = false">
        Close
      </Button>
    </template>
  </Dialog>
</template>
