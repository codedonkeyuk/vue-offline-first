<!-- FormField.vue -->
<script setup lang="ts">
import { computed } from "vue";

const {
  label,
  id,
  required = false,
  error = false,
  helpText,
  errorMessage,
} = defineProps<{
  label: string;
  id: string;
  required?: boolean;
  error?: boolean;
  helpText?: string;
  errorMessage?: string;
}>();

const hasError = computed(() => error || !!errorMessage);
const helpId = computed(() => `${id}-help`);
const errorId = computed(() => `${id}-error`);

const describedBy = computed(
  () =>
    [helpText ? helpId.value : null, errorMessage ? errorId.value : null]
      .filter(Boolean)
      .join(" ") || undefined,
);
</script>

<template>
  <div class="field" :class="{ 'field--error': hasError }">
    <label :for="id" class="field-label">
      {{ label }}
      <span v-if="required" class="field-required" aria-hidden="true">*</span>
    </label>

    <!-- Pass computed accessibility attributes down to the control -->
    <slot
      :id="id"
      :required="required"
      :aria-invalid="hasError || undefined"
      :aria-describedby="describedBy"
    />

    <small
      v-if="errorMessage"
      :id="errorId"
      class="field-error"
      aria-live="polite"
    >
      {{ errorMessage }}
    </small>
    <small v-if="helpText" :id="helpId" class="field-help">
      {{ helpText }}
    </small>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-error {
  color: #dc2626;
}

.field-help {
  font-size: 0.875rem;
  line-height: 1.25;
}
.field-label {
  font-size: 0.875rem;
  font-weight: 500;
}
.field-required {
  margin-right: 0.25rem;
}
/* Use :deep() so scoped styles reach child components like InputLabel */
.field--error :deep(.field-label),
.field--error :deep(.field-help) {
  color: #dc2626;
}
</style>
