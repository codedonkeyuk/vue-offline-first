<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md" | "lg";

const {
  variant = "primary",
  size = "md",
  disabled = false,
  href,
  to,
} = defineProps<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  href?: string;
  to?: RouteLocationRaw;
}>();

const componentTag = computed(() => {
  if (disabled) return "button";
  if (to) return RouterLink;
  if (href) return "a";
  return "button";
});
</script>

<template>
  <component
    :is="componentTag"
    :to="!disabled ? to : undefined"
    :href="!disabled && !to ? href : undefined"
    :disabled="componentTag === 'button' ? disabled : undefined"
    :aria-disabled="disabled || undefined"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'is-disabled': disabled }]"
  >
    <slot />
  </component>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-weight: 600;
  line-height: 1.25;
  text-decoration: none;
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
  border-color: var(--button-primary-background-bdr);
  color: var(--button-primary-color);
}

.btn--primary:hover:not(.is-disabled) {
  background-color: var(--button-primary-background-hover);
}

.btn--secondary {
  background-color: var(--button-secondary-background);
  border-color: var(--button-secondary-background-bdr);
  color: var(--button-secondary-color);
}

.btn--secondary:hover:not(.is-disabled) {
  background-color: var(--button-secondary-background-hover);
}

.btn:active:not(.is-disabled) {
  transform: translateY(1px);
}

.btn:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

.btn.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
