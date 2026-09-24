import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "muted";

const VARIANTS: Record<Variant, string> = {
  default: "bg-gray-100 text-gray-700 border-gray-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  info: "bg-sky-100 text-sky-800 border-sky-200",
  muted: "bg-slate-100 text-slate-600 border-slate-200",
};

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  style?: React.CSSProperties;
  icon?: ReactNode;
}

export default function Badge({
  children,
  variant = "default",
  className,
  style,
  icon,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        VARIANTS[variant],
        className
      )}
      style={style}
    >
      {icon}
      {children}
    </span>
  );
}
