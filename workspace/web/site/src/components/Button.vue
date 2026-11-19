<script setup lang="ts">
export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md" | "lg";

const {
  variant = "primary",
  size = "md",
  disabled = false,
} = defineProps<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
}>();
</script>

<template>
  <button
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-weight: 600;
  line-height: 1.25;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
}

.btn--sm {
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.8rem;
}

.btn--md {
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.9rem;
}

.btn--lg {
  gap: 0.625rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

.btn--primary {
  background-color: var(--button-primary-background);
  color: var(--button-primary-color);
}

.btn--primary:hover:not(:disabled) {
  background-color: var(--button-primary-background-hover);
}

.btn--secondary {
  background-color: var(--button-secondary-background);
  color: var(--button-primary-color);
}

.btn--secondary:hover:not(:disabled) {
  background-color: var(--button-secondary-background-hover);
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
