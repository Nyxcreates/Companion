import clsx from "clsx";

interface SkeletonProps {
  className?: string;
}

/** Calm loading placeholder for content that hasn't arrived yet. */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx("animate-pulse rounded-lg bg-white/10", className)} aria-hidden="true" />;
}