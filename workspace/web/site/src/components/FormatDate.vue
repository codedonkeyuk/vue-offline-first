<script setup lang="ts">
import { computed } from "vue";

const {
  locale = "en-GB",
  includeTime = true,
  date,
} = defineProps<{
  date: string;
  includeTime?: boolean;
  locale?: Intl.LocalesArgument;
}>();

const formattedText = computed(() =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: includeTime ? "short" : undefined,
  }).format(new Date(date)),
);
</script>

<template>
  <time :datetime="date">{{ formattedText }}</time>
</template>
