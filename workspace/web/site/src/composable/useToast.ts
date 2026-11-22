import { ref, readonly } from "vue";

export type ToastType = "success" | "warning" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const toasts = ref<Toast[]>([]);

export function useToast() {
  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  };

  const addToast = (
    message: string,
    type: ToastType = "info",
    duration = 4000,
  ) => {
    const id = Date.now() + Math.random();
    toasts.value.push({ id, message, type });

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  };

  const warning = (message: string, duration?: number) => {
    addToast(message, "warning", duration);
  };

  return {
    toasts: readonly(toasts),
    warning,
    removeToast,
  };
}
