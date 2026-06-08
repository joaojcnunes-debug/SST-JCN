"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <div className="flex gap-4">
        {variant === "danger" && (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-100">
            <AlertTriangle className="size-5 text-red-500" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{description}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50",
            variant === "danger"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-verde-primary hover:bg-verde-accent"
          )}
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          {loading ? "Aguarde..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
