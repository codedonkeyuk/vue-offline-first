<script setup lang="ts">
import { type InputTypeHTMLAttribute } from "vue";

defineOptions({ inheritAttrs: false });

const model = defineModel<string | number>({ required: true });

const {
  label,
  id,
  type = "text",
  required = false,
  error = false,
  helpText,
  errorMessage,
} = defineProps<{
  label: string;
  id: string;
  type?: InputTypeHTMLAttribute;
  required?: boolean;
  error?: boolean;
  helpText?: string;
  errorMessage?: string;
}>();

const helpId = `${id}-help`;
const errorId = `${id}-error`;
</script>

<template>
  <div class="field" :class="{ 'field--error': error || !!errorMessage }">
    <label :for="id" class="field-label">
      <span v-if="required" class="field-required" aria-hidden="true">*</span
      >{{ label }}
    </label>

    <input
      v-bind="$attrs"
      :id
      :type
      :required
      v-model="model"
      class="field-input"
      :aria-invalid="error || !!errorMessage || undefined"
      :aria-describedby="
        [helpText ? helpId : null, errorMessage ? errorId : null]
          .filter(Boolean)
          .join(' ') || undefined
      "
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

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.field-required {
  color: #dc2626;
  margin-right: 0.25rem;
}

.field-input {
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: #1f2937;
  background-color: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.field-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.field-help {
  font-size: 0.875rem;
  line-height: 1.25;
  color: #6b7280;
}

/* Error State */
.field--error .field-label {
  color: #dc2626;
}

.field--error .field-input {
  border-color: #dc2626;
}

.field--error .field-input:focus {
  border-color: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}

.field--error .field-help {
  color: #dc2626;
}
</style>
