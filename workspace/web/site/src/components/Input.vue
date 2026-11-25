<!-- TextInput.vue -->
<script setup lang="ts">
import { type InputTypeHTMLAttribute } from "vue";
import FormField from "./FormField.vue";

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
    <input
      v-bind="{ ...$attrs, ...slotProps }"
      :type="type"
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
