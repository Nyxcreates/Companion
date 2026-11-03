import clsx from "clsx";

interface MoonBodyProps {
  className?: string;
}

/**
 * Pure visual sphere. Positioning and movement belong to whoever
 * places it — see OrbitingMoon, which carries it along the orbit path.
 */
export function MoonBody({ className }: MoonBodyProps) {
  return (
    <div className={clsx("relative", className)} aria-hidden="true">
      <div
        className="absolute inset-0 rounded-full opacity-50 blur-xl"
        style={{ background: "radial-gradient(circle, rgba(94,231,224,0.4), transparent 70%)" }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #e5f7f6 0%, #a9d8d4 40%, #5b7b79 75%, #2c3d3c 100%)",
          boxShadow: "inset -8px -8px 16px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}