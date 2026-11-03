/**
 * A single large, distant planet. Shading is built from layered
 * gradients rather than an image. A slow positional drift and a very
 * slow rotating light overlay give it the feel of a real body turning
 * in space, not a static circle.
 */
export function Planet() {
  return (
    <div
      className="animate-planet-drift absolute right-[2%] top-[6%] h-[160px] w-[160px] sm:right-[4%] sm:top-[8%] sm:h-[220px] sm:w-[220px] md:h-[300px] md:w-[300px]"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(124,92,255,0.5), transparent 70%)" }}
      />
      <div
        className="absolute -inset-3 rounded-full opacity-20 blur-2xl"
        style={{ background: "radial-gradient(circle at 30% 25%, rgba(190,180,255,0.5), transparent 60%)" }}
      />
      <div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, #ab9dff 0%, #615cffff 30%, #4a3aa0 55%, #241d52 78%, #100c2c 100%)",
          boxShadow: "inset -22px -18px 55px rgba(0,0,0,0.55), inset 10px 10px 26px rgba(255,255,255,0.10)",
        }}
      >
        <div
          className="animate-planet-rotate absolute inset-0 opacity-25"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.15) 15%, transparent 30%, transparent 55%, rgba(255,255,255,0.1) 70%, transparent 85%)",
          }}
        />
      </div>
    </div>
  );
}