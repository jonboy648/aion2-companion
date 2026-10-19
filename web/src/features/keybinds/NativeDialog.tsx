import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function NativeDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    return () => {
      if (dialog?.open && typeof dialog.close === "function") dialog.close();
      // Restore after the modal is detached; native dialog removal can reset focus.
      queueMicrotask(() => { if (!dialog?.isConnected) opener.current?.focus({ preventScroll: true }); });
    };
  }, []);
  return <dialog ref={ref} className="nq-dialog" aria-label={title} aria-modal="true"
    onCancel={event => { event.preventDefault(); close.current(); }}
    onClose={() => close.current()}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close.current();
    }}>
    <header className="nq-dialog-header"><h2>{title}</h2><button type="button" title="Close" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>
    {children}
  </dialog>;
}
