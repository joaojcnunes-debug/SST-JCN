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
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-11 w-full"
          style={{ opacity: 1 - i * 0.08 }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("skeleton-shimmer h-32 w-full rounded-2xl", className)} />
  );
}
