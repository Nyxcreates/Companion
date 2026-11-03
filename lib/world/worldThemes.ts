import type { LivingEnvironmentId } from "@/types/profile";

export interface WorldThemeDefinition {
  id: LivingEnvironmentId;
  name: string;
  subtitle: string;
  description: string;
  elements: string[];
  icon: string;
  accentColor: string;
  gradientDark: string;
  gradientLight: string;
}

export const WORLD_THEMES: WorldThemeDefinition[] = [
  {
    id: "cosmic-dream",
    name: "Cosmic Dream",
    subtitle: "Stars, crescent moon & deep cosmos",
    description: "Stars at varying depths, luminous crescent moon, moving constellations, and slow-cruising capsule voyagers.",
    elements: ["Crescent Moon", "Constellations", "Capsule Voyager", "Shooting Stars", "Cosmic Dust"],
    icon: "✦",
    accentColor: "#5ee7e0",
    gradientDark: "radial-gradient(circle at 75% 20%, rgba(94, 231, 224, 0.12) 0%, transparent 45%), radial-gradient(circle at 25% 65%, rgba(124, 92, 255, 0.18) 0%, transparent 50%), linear-gradient(180deg, #050512 0%, #0b0a22 55%, #070717 100%)",
    gradientLight: "radial-gradient(circle at 75% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 45%), linear-gradient(180deg, #f8fafc 0%, #ede9fe 100%)",
  },
  {
    id: "enchanted-garden",
    name: "Enchanted Garden",
    subtitle: "Blooming flowers, fireflies & gentle stream",
    description: "Rolling meadow hills, blooming goal blossoms, fluttering butterflies, glowing fireflies, and winding streams.",
    elements: ["Goal Blossoms", "Fireflies", "Adaptive Butterflies", "Timetable Stream", "Whispering Trees"],
    icon: "🌱",
    accentColor: "#34d399",
    gradientDark: "radial-gradient(circle at 30% 25%, rgba(52, 211, 153, 0.18) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(244, 114, 182, 0.12) 0%, transparent 50%), linear-gradient(180deg, #061713 0%, #0a241c 55%, #051410 100%)",
    gradientLight: "radial-gradient(circle at 30% 25%, rgba(52, 211, 153, 0.10) 0%, transparent 50%), linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)",
  },
  {
    id: "abyssal-dreams",
    name: "Abyssal Dreams",
    subtitle: "Bioluminescent jellyfish & ocean depth",
    description: "Sunbeams piercing calm waters, undulating jellyfish bells, ascending bubbles, and schools of wandering fish.",
    elements: ["Focus Jellyfish", "Reflective Pearl", "Swaying Kelp", "Rising Bubbles", "Filtering Sunbeams"],
    icon: "🌊",
    accentColor: "#38bdf8",
    gradientDark: "radial-gradient(circle at 50% 10%, rgba(94, 231, 224, 0.22) 0%, transparent 60%), radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.16) 0%, transparent 50%), linear-gradient(180deg, #04121a 0%, #061e2c 50%, #030d14 100%)",
    gradientLight: "radial-gradient(circle at 50% 10%, rgba(6, 182, 212, 0.12) 0%, transparent 60%), linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)",
  },
  {
    id: "midnight-academia",
    name: "Midnight Academia",
    subtitle: "Candlelit sanctuary, drifting dust & rain",
    description: "A cozy study lined with warm book spines, gentle candle embers, soft rain streaming down dark glass, and drifting amber dust.",
    elements: ["Candle Flame", "Raindrops on Glass", "Drifting Dust Motes", "Leather & Parchment"],
    icon: "🕯",
    accentColor: "#fbbf24",
    gradientDark: "radial-gradient(circle at 30% 70%, rgba(251, 191, 36, 0.14) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(180, 83, 9, 0.12) 0%, transparent 50%), linear-gradient(180deg, #120d09 0%, #1c140d 55%, #100b07 100%)",
    gradientLight: "radial-gradient(circle at 30% 70%, rgba(251, 191, 36, 0.10) 0%, transparent 50%), linear-gradient(180deg, #fefce8 0%, #fef3c7 100%)",
  },
  {
    id: "moonlit-sakura",
    name: "Moonlit Sakura",
    subtitle: "Cherry blossoms & lantern-lit water",
    description: "Drifting cherry blossom petals caught in a night breeze, floating stone lanterns, and ripples upon a tranquil pond.",
    elements: ["Falling Petals", "Water Lanterns", "Rippling Pond", "Full Moon Halo"],
    icon: "🌸",
    accentColor: "#f472b6",
    gradientDark: "radial-gradient(circle at 50% 30%, rgba(244, 114, 182, 0.18) 0%, transparent 50%), radial-gradient(circle at 75% 70%, rgba(124, 92, 255, 0.12) 0%, transparent 50%), linear-gradient(180deg, #170914 0%, #230d1f 55%, #150812 100%)",
    gradientLight: "radial-gradient(circle at 50% 30%, rgba(244, 114, 182, 0.12) 0%, transparent 50%), linear-gradient(180deg, #fdf2f8 0%, #fce7f3 100%)",
  },
  {
    id: "aurora-sanctuary",
    name: "Aurora Sanctuary",
    subtitle: "Shimmering borealis & snow crystals",
    description: "Waving curtains of emerald and violet aurora ribbons across frozen mountain ridges, with glistening snow crystals.",
    elements: ["Dancing Aurora Curtains", "Glittering Snowflakes", "Frost Pines", "Starlight Ice"],
    icon: "❄",
    accentColor: "#5ee7e0",
    gradientDark: "radial-gradient(circle at 40% 20%, rgba(94, 231, 224, 0.22) 0%, transparent 55%), radial-gradient(circle at 70% 35%, rgba(168, 85, 247, 0.16) 0%, transparent 50%), linear-gradient(180deg, #051419 0%, #071f28 55%, #041014 100%)",
    gradientLight: "radial-gradient(circle at 40% 20%, rgba(94, 231, 224, 0.14) 0%, transparent 55%), linear-gradient(180deg, #f0fdfa 0%, #ccfbf1 100%)",
  },
  {
    id: "autumn-reverie",
    name: "Autumn Reverie",
    subtitle: "Tumbling amber leaves & twilight glow",
    description: "Warm golden twilight with maple and oak leaves tumbling slowly through a gentle breeze, illuminated by paper lanterns.",
    elements: ["Spinning Maple Leaves", "Golden Lanterns", "Sunset Horizon", "Twilight Mist"],
    icon: "🍂",
    accentColor: "#fb923c",
    gradientDark: "radial-gradient(circle at 50% 60%, rgba(251, 146, 60, 0.18) 0%, transparent 50%), radial-gradient(circle at 80% 25%, rgba(244, 63, 94, 0.12) 0%, transparent 50%), linear-gradient(180deg, #180d07 0%, #25140b 55%, #150a05 100%)",
    gradientLight: "radial-gradient(circle at 50% 60%, rgba(251, 146, 60, 0.12) 0%, transparent 50%), linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)",
  },
  {
    id: "cloud-kingdom",
    name: "Cloud Kingdom",
    subtitle: "Floating islands & sunset cloud rivers",
    description: "Ethereal cloud strata drifting at sunrise, floating citadel silhouettes, and radiant golden shafts of light.",
    elements: ["Drifting Cloud Rivers", "Sky Islands", "Golden Sunbeams", "Soaring Skylarks"],
    icon: "☁",
    accentColor: "#facc15",
    gradientDark: "radial-gradient(circle at 50% 40%, rgba(250, 204, 21, 0.16) 0%, transparent 50%), radial-gradient(circle at 20% 70%, rgba(244, 114, 182, 0.14) 0%, transparent 50%), linear-gradient(180deg, #130f1a 0%, #20172e 55%, #120e18 100%)",
    gradientLight: "radial-gradient(circle at 50% 40%, rgba(250, 204, 21, 0.12) 0%, transparent 50%), linear-gradient(180deg, #fefce8 0%, #fae8ff 100%)",
  },
];

/** Normalizes legacy IDs ('space', 'garden', 'ocean') to new canonical IDs */
export function normalizeLivingEnvironmentId(id: string | null | undefined): LivingEnvironmentId {
  if (!id) return "cosmic-dream";
  if (id === "space") return "cosmic-dream";
  if (id === "garden") return "enchanted-garden";
  if (id === "ocean") return "abyssal-dreams";

  const found = WORLD_THEMES.find((w) => w.id === id);
  return found ? found.id : "cosmic-dream";
}
