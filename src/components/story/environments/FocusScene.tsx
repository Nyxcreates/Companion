/**
 * Lightweight placeholder for the Focus environment — minimal, still,
 * one soft breathing light. Per spec this still needs a few calm
 * geometric objects and particles, just very quiet ones — movement
 * here should read as "reduced," not "absent."
 */
export function FocusScene() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(124,92,255,0.16), transparent 60%), linear-gradient(180deg, #0a0a18 0%, #0b0b1e 100%)",
        }}
      />
      <div
        className="animate-breathe absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-primary/10 blur-3xl"
        aria-hidden="true"
      />

      {/* two calm geometric rings, barely moving */}
      <div
        className="animate-orbit-glow absolute left-[20%] top-[25%] h-24 w-24 rounded-full border border-accent-secondary/15"
        aria-hidden="true"
      />
      <div
        className="animate-orbit-glow absolute right-[18%] bottom-[22%] h-16 w-16 rounded-full border border-white/10"
        style={{ animationDelay: "3s" }}
        aria-hidden="true"
      />

      {/* a few slow, quiet particles */}
      {Array.from({ length: 5 }).map((_, i) => {
        const left = 20 + ((i * 31) % 60);
        const duration = 22 + (i % 3) * 6;
        return (
          <span
            key={i}
            className="animate-dust-vertical absolute h-1 w-1 rounded-full bg-white/30"
            style={{
              left: `${left}%`,
              bottom: "-2%",
              animationDuration: `${duration}s`,
              animationDelay: `${i * 3}s`,
            }}
          />
        );
      })}
    </div>
  );
}