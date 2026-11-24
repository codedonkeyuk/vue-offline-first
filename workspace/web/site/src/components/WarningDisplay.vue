<script setup lang="ts">
import { useWarning } from "../composable/useWarning";

const props = withDefaults(
  defineProps<{
    scope?: string;
  }>(),
  {
    scope: "global",
  },
);

const { getScopedWarnings, dismiss } = useWarning();
const scopedWarnings = getScopedWarnings(props.scope);
</script>

<template>
  <TransitionGroup
    v-if="scopedWarnings.length"
    name="alert-fade"
    tag="div"
    class="alert-stack"
    role="alert"
    aria-live="polite"
  >
    <div
      v-for="item in scopedWarnings"
      :key="item.id"
      class="alert-banner"
      :class="`alert--${item.type}`"
    >
      <!-- Message Content -->
      <div class="alert-content">
        <strong v-if="item.title" class="alert-title">{{ item.title }}</strong>
        <p class="alert-message">{{ item.message }}</p>
      </div>

      <!-- Actions -->
      <div class="alert-actions">
        <button
          v-if="item.actionLabel"
          type="button"
          class="alert-action-btn"
          @click="item.onAction?.()"
        >
          {{ item.actionLabel }}
        </button>
        <button
          v-if="item.dismissible"
          type="button"
          class="alert-dismiss-btn"
          aria-label="Dismiss message"
          @click="dismiss(item.id)"
        >
          ✕
        </button>
      </div>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.alert-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  margin-bottom: 1rem;
}

.alert-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--alert-border);
  border-left: 4px solid var(--alert-accent);
  border-radius: 0.5rem;
  background-color: var(--alert-bg);
  color: var(--alert-text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Info (Blue) */
.alert--info {
  --alert-bg: #eff6ff;
  --alert-border: #93c5fd;
  --alert-accent: #3b82f6;
  --alert-title: #1e3a8a;
  --alert-text: #1e40af;
  --alert-btn-bg: #dbeafe;
  --alert-btn-hover: #bfdbfe;
}

/* Warning / Alert (Amber) */
.alert--warning {
  --alert-bg: #fffbeb;
  --alert-border: #fcd34d;
  --alert-accent: #f59e0b;
  --alert-title: #451a03;
  --alert-text: #78350f;
  --alert-btn-bg: #fef3c7;
  --alert-btn-hover: #fde68a;
}

/* Error (Red) */
.alert--error {
  --alert-bg: #fef2f2;
  --alert-border: #fca5a5;
  --alert-accent: #ef4444;
  --alert-title: #7f1d1d;
  --alert-text: #991b1b;
  --alert-btn-bg: #fee2e2;
  --alert-btn-hover: #fecaca;
}

.alert-content {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  line-height: 1.4;
}

.alert-title {
  display: block;
  font-weight: 600;
  color: var(--alert-title);
  margin-bottom: 0.125rem;
}

.alert-message {
  margin: 0;
}

.alert-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.alert-action-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--alert-title);
  background-color: var(--alert-btn-bg);
  border: 1px solid var(--alert-accent);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.alert-action-btn:hover {
  background-color: var(--alert-btn-hover);
}

.alert-dismiss-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  font-size: 0.875rem;
  color: var(--alert-text);
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.alert-dismiss-btn:hover {
  background-color: var(--alert-btn-hover);
  color: var(--alert-title);
}

.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: all 0.2s ease;
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
