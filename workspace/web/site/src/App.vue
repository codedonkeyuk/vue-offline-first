<script setup lang="ts">
import { RouterView } from "vue-router";
import MainToolbar from "./components/MainToolbar.vue";
import Button from "./components/Button.vue";
import Container from "./components/Container.vue";
</script>
<template>
  <MainToolbar>
    <Button size="sm" to="/">Text Documents</Button>
    <Button size="sm" to="/test-bed">Test Bed</Button>
  </MainToolbar>
  <Container><RouterView /></Container>
</template>
