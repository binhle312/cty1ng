import { Toast as BaseToast } from "@base-ui/react/toast";

// Short notes after an action ("Saved v4 ✨"), on Base UI: screen readers hear them, and they
// close by themselves. A move to Trash has no Undo (buttons.md §6), so M1 toasts are text only.
export const toastManager = BaseToast.createToastManager();

export function showToast(title: string): void {
  toastManager.add({ title });
}

function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((toast) => (
    <BaseToast.Root
      key={toast.id}
      toast={toast}
      className="rounded-card border border-outline-strong bg-surface-raised px-4 py-3 text-on-surface shadow-xl"
    >
      <BaseToast.Content>
        <BaseToast.Title className="font-medium" />
      </BaseToast.Content>
    </BaseToast.Root>
  ));
}

// One place for every toast, at the bottom centre of the window.
export function Toaster() {
  return (
    <BaseToast.Provider toastManager={toastManager}>
      <BaseToast.Portal>
        <BaseToast.Viewport className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}
