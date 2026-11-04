"use client";

import { usePathname } from "next/navigation";
import { useWorldTheme } from "@/context/WorldThemeContext";
import { normalizeLivingEnvironmentId } from "@/lib/world/worldThemes";
import { SpaceLivingWorld } from "./SpaceLivingWorld";
import { GardenLivingWorld } from "./GardenLivingWorld";
import { OceanLivingWorld } from "./OceanLivingWorld";
import { MidnightAcademiaLivingWorld } from "./MidnightAcademiaLivingWorld";
import { MoonlitSakuraLivingWorld } from "./MoonlitSakuraLivingWorld";
import { AuroraSanctuaryLivingWorld } from "./AuroraSanctuaryLivingWorld";
import { AutumnReverieLivingWorld } from "./AutumnReverieLivingWorld";
import { CloudKingdomLivingWorld } from "./CloudKingdomLivingWorld";
import type { LivingEnvironmentId } from "@/types/profile";

interface LivingWorldBackdropProps {
  environment?: LivingEnvironmentId;
  calm?: boolean;
  className?: string;
  isFocusMode?: boolean;
}

export function LivingWorldBackdrop({
  environment: overrideEnv,
  calm = true,
  className = "",
  isFocusMode: overrideFocus,
}: LivingWorldBackdropProps) {
  const pathname = usePathname();
  const { livingEnvironment } = useWorldTheme();

  const canonicalEnv = normalizeLivingEnvironmentId(overrideEnv ?? livingEnvironment);
  const isFocus = overrideFocus ?? (pathname === "/focus");
  // In focus mode and on dashboard, the world always animates calmly
  const effectiveCalm = calm || isFocus;

  const isContained = className.includes("absolute") || className.includes("relative");

  return (
    <div
      aria-hidden="true"
      className={`${
        isContained ? "w-full h-full" : "fixed inset-0 -z-10"
      } pointer-events-none overflow-hidden transition-opacity duration-1000 ${
        isFocus ? "opacity-[0.18]" : "opacity-100"
      } ${className}`}
    >
      {(canonicalEnv === "cosmic-dream" || canonicalEnv === "space") && <SpaceLivingWorld calm={effectiveCalm} />}
      {(canonicalEnv === "enchanted-garden" || canonicalEnv === "garden") && <GardenLivingWorld calm={effectiveCalm} />}
      {(canonicalEnv === "abyssal-dreams" || canonicalEnv === "ocean") && <OceanLivingWorld calm={effectiveCalm} />}
      {canonicalEnv === "midnight-academia" && <MidnightAcademiaLivingWorld calm={effectiveCalm} />}
      {canonicalEnv === "moonlit-sakura" && <MoonlitSakuraLivingWorld calm={effectiveCalm} />}
      {canonicalEnv === "aurora-sanctuary" && <AuroraSanctuaryLivingWorld calm={effectiveCalm} />}
      {canonicalEnv === "autumn-reverie" && <AutumnReverieLivingWorld calm={effectiveCalm} />}
      {canonicalEnv === "cloud-kingdom" && <CloudKingdomLivingWorld calm={effectiveCalm} />}
    </div>
  );
}
