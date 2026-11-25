<script setup lang="ts">
type Alignment = "left" | "right" | "center";
const { align = "right" } = defineProps<{ align?: Alignment }>();
</script>
<template>
  <div class="button-bar" :class="`button-bar--${align}`">
    <slot></slot>
  </div>
</template>
<style scoped>
.button-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.button-bar--left {
  justify-content: flex-start;
}

.button-bar--center {
  justify-content: center;
}

.button-bar--right {
  justify-content: flex-end;
}
</style>
