import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export default function LoadingSkeleton({
  rows = 4,
  className,
}: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 w-full animate-pulse rounded-lg bg-gray-200/70"
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-32 w-full animate-pulse rounded-xl bg-gray-200/70",
        className
      )}
    />
  );
}
