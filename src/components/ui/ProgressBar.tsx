import clsx from "clsx";

interface ProgressBarProps {
  percent: number;
  className?: string;
}

export function ProgressBar({ percent, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className="h-full rounded-full bg-accent-secondary transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}