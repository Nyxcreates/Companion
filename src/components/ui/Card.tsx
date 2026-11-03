import { type HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated";
  hoverable?: boolean;
}

export function Card({ variant = "default", hoverable = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "glass-card p-6",
        variant === "elevated" && "shadow-float",
        hoverable && "cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-float",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}