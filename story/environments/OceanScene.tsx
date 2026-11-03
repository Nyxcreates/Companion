/** Lightweight placeholder for the Ocean environment — deep blue, quiet, slow rising bubbles. */
export function OceanScene() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 15%, rgba(94,231,224,0.16), transparent 55%), radial-gradient(circle at 70% 80%, rgba(124,92,255,0.12), transparent 50%), linear-gradient(180deg, #061620 0%, #081c28 55%, #071a24 100%)",
        }}
      />
      <div className="absolute inset-0" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => {
          const left = (i * 29) % 100;
          const size = 2 + (i % 3);
          const duration = 9 + (i % 6) * 2;
          return (
            <span
              key={i}
              className="animate-bubble-rise absolute rounded-full border border-accent-secondary/30 bg-accent-secondary/10"
              style={{
                left: `${left}%`,
                bottom: "-5%",
                width: size,
                height: size,
                animationDuration: `${duration}s`,
                animationDelay: `${i * 0.9}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}