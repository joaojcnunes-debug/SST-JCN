"use client";

import { AlertTriangle } from "lucide-react";
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
      <div className="flex gap-3">
        {variant === "danger" && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="size-5 text-red-alert" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50",
            variant === "danger"
              ? "bg-red-alert hover:bg-red-700"
              : "bg-verde-primary hover:bg-verde-accent"
          )}
        >
          {loading ? "Aguarde..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
