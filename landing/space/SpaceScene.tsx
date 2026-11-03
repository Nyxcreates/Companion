import { ParallaxProvider } from "./ParallaxProvider";
import { ParallaxLayer } from "./ParallaxLayer";
import { StarField } from "./StarField";
import { CosmicDust } from "./CosmicDust";
import { Planet } from "./Planet";
import { OrbitPath } from "./OrbitPath";
import { OrbitingMoon } from "./OrbitingMoon";
import { ShootingStar } from "./ShootingStar";

/**
 * The living space environment. Organized into depth layers — far
 * background, midground, nearer stars, and foreground dust — each
 * drifting at its own slow speed and reacting to the pointer by a
 * different, tiny amount, so the whole thing reads as a place with
 * depth rather than a flat backdrop with objects placed on top.
 */
export function SpaceScene() {
  return (
    <ParallaxProvider>
      <div className="absolute inset-0">
        {/* deep base — no motion, sits behind everything */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 22% 18%, rgba(124,92,255,0.20), transparent 50%), radial-gradient(circle at 78% 62%, rgba(94,231,224,0.10), transparent 45%), radial-gradient(circle at 50% 100%, rgba(60,40,120,0.25), transparent 60%), linear-gradient(180deg, #07071a 0%, #0b0b1e 55%, #0c0b21 100%)",
          }}
        />

        {/* far background — faint, distant, barely reactive */}
        <ParallaxLayer depth={3} className="absolute inset-0">
          <StarField density="far" />
        </ParallaxLayer>

        {/* midground — planet, orbit and the moon traveling along it */}
        <ParallaxLayer depth={7} className="absolute inset-0">
          <Planet />
          <OrbitPath />
          <OrbitingMoon />
        </ParallaxLayer>

        {/* nearer stars — a little brighter, a little more reactive */}
        <ParallaxLayer depth={10} className="absolute inset-0">
          <StarField density="near" />
        </ParallaxLayer>

        {/* foreground dust — closest layer, most reactive, still subtle */}
        <ParallaxLayer depth={14} className="absolute inset-0">
          <CosmicDust />
        </ParallaxLayer>

        <ShootingStar />
      </div>
    </ParallaxProvider>
  );
}