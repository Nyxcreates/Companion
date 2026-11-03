/** Lightweight placeholder for the Garden environment — calm, warm, alive with fireflies. Ready to be replaced with the full Memory Garden visuals later. */
export function GardenScene() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 25% 20%, rgba(52,211,153,0.16), transparent 55%), radial-gradient(circle at 75% 75%, rgba(244,114,182,0.10), transparent 50%), linear-gradient(180deg, #0c1a16 0%, #0b1f19 60%, #0a1a15 100%)",
        }}
      />
      <div className="absolute inset-0" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => {
          const left = (i * 37) % 100;
          const top = (i * 53) % 100;
          const duration = 5 + (i % 5);
          return (
            <span
              key={i}
              className="animate-firefly absolute h-1 w-1 rounded-full bg-accent-emerald/70"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animationDuration: `${duration}s`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}