import { ref, computed, readonly } from "vue";

export type AlertType = "info" | "warning" | "error";

export interface WarningItem {
  id: string;
  type: AlertType;
  title?: string;
  message: string;
  scope: string;
  dismissible?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve?: (value: boolean) => void;
}

type NotifyOptions = Omit<WarningItem, "id" | "scope" | "type"> & {
  scope?: string;
  type?: AlertType;
};

const warnings = ref<WarningItem[]>([]);
const confirmState = ref<ConfirmDialogState>({
  isOpen: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
});

export function useWarning(defaultScope = "global") {
  const notify = (options: NotifyOptions) => {
    const id = crypto.randomUUID();
    warnings.value.push({
      id,
      type: options.type ?? "warning",
      scope: options.scope ?? defaultScope,
      dismissible: options.dismissible ?? true,
      ...options,
    });
    return id;
  };

  // Convenient shorthand helpers
  const info = (options: Omit<NotifyOptions, "type">) =>
    notify({ ...options, type: "info" });

  const warn = (options: Omit<NotifyOptions, "type">) =>
    notify({ ...options, type: "warning" });

  const error = (options: Omit<NotifyOptions, "type">) =>
    notify({ ...options, type: "error" });

  const dismiss = (id: string) => {
    warnings.value = warnings.value.filter((w) => w.id !== id);
  };

  const clearScope = (scope = defaultScope) => {
    warnings.value = warnings.value.filter((w) => w.scope !== scope);
  };

  const getScopedWarnings = (scope = defaultScope) =>
    computed(() => warnings.value.filter((w) => w.scope === scope));

  const confirmWarning = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmState.value = {
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Continue",
        cancelLabel: options.cancelLabel ?? "Cancel",
        resolve,
      };
    });
  };

  const handleConfirmDecision = (result: boolean) => {
    confirmState.value.resolve?.(result);
    confirmState.value.isOpen = false;
  };

  return {
    warnings: readonly(warnings),
    confirmState: readonly(confirmState),
    notify,
    info,
    warn,
    error,
    dismiss,
    clearScope,
    getScopedWarnings,
    confirmWarning,
    handleConfirmDecision,
  };
}
