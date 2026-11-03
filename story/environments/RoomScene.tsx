/**
 * Lightweight placeholder for the cozy personal Room environment —
 * warm, intimate, gently glowing. Kept simple on purpose (soft shapes,
 * no illustration), but per spec needs to read as an actual place, not
 * a plain gradient: a lamp glow, a window's light, a couple of drifting
 * dust motes, and one small object silhouette (a plant).
 */
export function RoomScene() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(251,191,36,0.10), transparent 55%), radial-gradient(circle at 20% 80%, rgba(124,92,255,0.14), transparent 50%), linear-gradient(180deg, #14101f 0%, #100c1a 60%, #0d0a16 100%)",
        }}
      />

      {/* lamp glow */}
      <div
        className="animate-room-glow absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-accent-gold/10 blur-3xl"
        aria-hidden="true"
      />

      {/* a window of light in the corner, with dust drifting through it */}
      <div
        className="absolute right-[8%] top-[12%] h-56 w-40 rounded-2xl opacity-70"
        style={{ background: "linear-gradient(200deg, rgba(94,231,224,0.14), transparent 70%)" }}
        aria-hidden="true"
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const left = 15 + ((i * 23) % 70);
          const duration = 12 + (i % 4) * 3;
          return (
            <span
              key={i}
              className="animate-dust-vertical absolute h-1 w-1 rounded-full bg-white/50"
              style={{
                left: `${left}%`,
                bottom: "0%",
                animationDuration: `${duration}s`,
                animationDelay: `${i * 1.6}s`,
              }}
            />
          );
        })}
      </div>

      {/* a small plant silhouette, bottom-left — one quiet "object" in the room */}
      <div className="absolute bottom-[10%] left-[8%] h-24 w-16 opacity-60" aria-hidden="true">
        <div className="absolute bottom-0 left-1/2 h-8 w-10 -translate-x-1/2 rounded-t-md bg-white/10" />
        <div className="absolute bottom-7 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-accent-emerald/15 blur-md" />
      </div>
    </div>
  );
}