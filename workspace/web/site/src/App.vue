<script setup lang="ts">
import { RouterView } from "vue-router";
import MainToolbar from "./components/MainToolbar.vue";
import Container from "./components/Container.vue";
</script>
<template>
  <MainToolbar />
  <Container><RouterView /></Container>
</template>
