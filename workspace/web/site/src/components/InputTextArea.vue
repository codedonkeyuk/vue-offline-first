<script setup lang="ts">
import FormField from "./FormField.vue";

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ required: true });

const {
  label,
  id,
  rows = 4,
  required = false,
  error = false,
  helpText,
  errorMessage,
} = defineProps<{
  label: string;
  id: string;
  rows?: number;
  required?: boolean;
  error?: boolean;
  helpText?: string;
  errorMessage?: string;
}>();
</script>

<template>
  <FormField
    v-slot="slotProps"
    :id="id"
    :label="label"
    :required="required"
    :error="error"
    :help-text="helpText"
    :error-message="errorMessage"
  >
    <textarea
      v-bind="{ ...$attrs, ...slotProps }"
      :rows="rows"
      v-model="model"
      class="field-input"
    />
  </FormField>
</template>

<style scoped>
.field-input {
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: #1f2937;
  background-color: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  outline: none;
  resize: vertical;
  font-family: inherit;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.field-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.field--error .field-input {
  border-color: #dc2626;
}

.field--error .field-input:focus {
  border-color: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}
</style>
