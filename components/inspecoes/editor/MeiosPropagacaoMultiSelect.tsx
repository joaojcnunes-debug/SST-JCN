"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  options: string[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function MeiosPropagacaoMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione um ou mais meios...",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm",
          "focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <span className="flex flex-wrap items-center gap-1 truncate">
          {value.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : value.length <= 3 ? (
            value.map((v) => (
              <span
                key={v}
                className="rounded bg-verde-light px-1.5 py-0.5 text-xs font-medium text-verde-primary"
              >
                {v}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="ml-1 inline-block cursor-pointer text-verde-primary/70 hover:text-verde-primary"
                >
                  <X className="inline size-3" />
                </span>
              </span>
            ))
          ) : (
            <span className="font-medium text-gray-900">
              {value.length} meios selecionados
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <ul className="max-h-64 overflow-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">
                Nenhuma opção disponível.
              </li>
            ) : (
              options.map((opt) => {
                const checked = value.includes(opt);
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => toggle(opt)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-verde-light",
                        checked && "bg-verde-light"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-verde-primary bg-verde-primary text-white"
                            : "border-gray-300 bg-white"
                        )}
                      >
                        {checked && <Check className="size-3" />}
                      </span>
                      <span className="font-medium text-gray-900">{opt}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
