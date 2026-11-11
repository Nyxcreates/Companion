import type { LivingEnvironmentId } from "@/types/profile";
import type { GuidePose, GuideGaze } from "@/components/character/LivingCompanionGuide";
import type { CompanionPose } from "@/components/character/CompanionCharacter";

export interface WorldPersonalityConfig {
  id: LivingEnvironmentId;
  name: string;
  toneNote: string;
  greetingLines: string[];
  idleAnimation: {
    pose: GuidePose;
    gaze: GuideGaze;
    companionPose: CompanionPose;
    expression: string;
  };
  themeChangeReaction: {
    line: string;
    pose: GuidePose;
    gaze: GuideGaze;
    companionPose: CompanionPose;
  };
  companionLook: {
    accentPrimary: string;
    accentSecondary: string;
    glowColor: string;
    haloColor: string;
    badgeLabel: string;
  };
}

export const WORLD_PERSONALITIES: Record<LivingEnvironmentId, WorldPersonalityConfig> = {
  "cosmic-dream": {
    id: "cosmic-dream",
    name: "Cosmic Dream",
    toneNote:
      "Dreamy, wondrous, and expansive. Contemplate big pictures, marvel at progress across time, and bring a serene starry warmth.",
    greetingLines: [
      "Welcome to the stars. The universe is unhurried, and so are we.",
      "Look up at the quiet cosmos with me—what shall we explore today?",
      "Under this starry sky, every step forward counts.",
    ],
    idleAnimation: {
      pose: "ponder",
      gaze: "up",
      companionPose: "think",
      expression: "dreamy",
    },
    themeChangeReaction: {
      line: "Look at the endless stars! Let's dream a little bigger today.",
      pose: "celebrate",
      gaze: "up",
      companionPose: "celebrate",
    },
    companionLook: {
      accentPrimary: "#5ee7e0",
      accentSecondary: "#7c5cff",
      glowColor: "rgba(94, 231, 224, 0.4)",
      haloColor: "#ffd166",
      badgeLabel: "Starlight Nikki",
    },
  },

  "enchanted-garden": {
    id: "enchanted-garden",
    name: "Enchanted Garden",
    toneNote:
      "Fresh, grounded, and gently nurturing. Celebrate small seeds taking root, daily steady watering, and natural blossoming.",
    greetingLines: [
      "Welcome back to the garden. Breathe in the green air.",
      "Fresh buds and fireflies—ready to tend to your day?",
      "Every small action is a seed well planted.",
    ],
    idleAnimation: {
      pose: "idle",
      gaze: "center",
      companionPose: "idle",
      expression: "nurturing",
    },
    themeChangeReaction: {
      line: "Ah, the fresh earth and green meadow! Let's nurture something good today.",
      pose: "greet",
      gaze: "center",
      companionPose: "wave",
    },
    companionLook: {
      accentPrimary: "#34d399",
      accentSecondary: "#10b981",
      glowColor: "rgba(52, 211, 153, 0.42)",
      haloColor: "#fbbf24",
      badgeLabel: "Meadow Nikki",
    },
  },

  "abyssal-dreams": {
    id: "abyssal-dreams",
    name: "Abyssal Dreams",
    toneNote:
      "Deep, tranquil, and reflective. Bring slow calming breaths, immersive focus, and deep serenity like drifting through calm bioluminescent ocean depths.",
    greetingLines: [
      "Down here in the quiet blue, all the noise melts away.",
      "Calm currents and peaceful thoughts. Take your time.",
      "Take a slow breath—let's dive deep into what matters.",
    ],
    idleAnimation: {
      pose: "ponder",
      gaze: "center",
      companionPose: "sit",
      expression: "tranquil",
    },
    themeChangeReaction: {
      line: "Diving into the deep calm... let all the surface noise wash away.",
      pose: "ponder",
      gaze: "center",
      companionPose: "think",
    },
    companionLook: {
      accentPrimary: "#38bdf8",
      accentSecondary: "#0284c7",
      glowColor: "rgba(56, 189, 248, 0.42)",
      haloColor: "#5ee7e0",
      badgeLabel: "Abyssal Nikki",
    },
  },

  "midnight-academia": {
    id: "midnight-academia",
    name: "Midnight Academia",
    toneNote:
      "Cosy, bookish, and scholarly. Emphasize quiet evening focus, hot tea, curiosity, study, and the soft rustle of rainy parchment.",
    greetingLines: [
      "Welcome to our library study. The kettle is warm.",
      "Rain against dark glass, soft candlelight, and good work to do.",
      "Let's settle in with a curious mind and quiet focus.",
    ],
    idleAnimation: {
      pose: "greet",
      gaze: "center",
      companionPose: "sit",
      expression: "scholarly",
    },
    themeChangeReaction: {
      line: "Welcome to our candlelit sanctuary. Let's pull up a chair and dive in.",
      pose: "greet",
      gaze: "center",
      companionPose: "sit",
    },
    companionLook: {
      accentPrimary: "#fbbf24",
      accentSecondary: "#f59e0b",
      glowColor: "rgba(251, 191, 36, 0.38)",
      haloColor: "#f97316",
      badgeLabel: "Scholar Nikki",
    },
  },

  "aurora-sanctuary": {
    id: "aurora-sanctuary",
    name: "Aurora Sanctuary",
    toneNote:
      "Calm, quiet, and crystal-clear. Bring cool stillness, serene starlight clarity, and crisp unhurried peace like dancing northern lights over snow.",
    greetingLines: [
      "The northern lights are dancing over the peaks.",
      "Crisp starlight and quiet snow. A peaceful sanctuary just for you.",
      "Breathe in the still mountain air. Everything is clear now.",
    ],
    idleAnimation: {
      pose: "ponder",
      gaze: "up",
      companionPose: "lookAhead",
      expression: "serene",
    },
    themeChangeReaction: {
      line: "The quiet aurora is glowing... breathe in the crisp, pure air.",
      pose: "ponder",
      gaze: "up",
      companionPose: "lookAhead",
    },
    companionLook: {
      accentPrimary: "#5ee7e0",
      accentSecondary: "#a855f7",
      glowColor: "rgba(168, 85, 247, 0.38)",
      haloColor: "#5ee7e0",
      badgeLabel: "Aurora Nikki",
    },
  },

  "autumn-reverie": {
    id: "autumn-reverie",
    name: "Autumn Reverie",
    toneNote:
      "Warm, nostalgic, and comforting. Celebrate harvesting efforts, winding down gracefully, golden twilight gratitude, and peaceful reflection.",
    greetingLines: [
      "Golden leaves are tumbling in the twilight breeze.",
      "A warm drink, lanterns lit, and a gentle evening ahead.",
      "Look how far you've come this season. Let's celebrate that.",
    ],
    idleAnimation: {
      pose: "greet",
      gaze: "center",
      companionPose: "wave",
      expression: "cozy",
    },
    themeChangeReaction: {
      line: "Warm amber twilight and falling leaves... let's enjoy this cozy pace.",
      pose: "greet",
      gaze: "center",
      companionPose: "wave",
    },
    companionLook: {
      accentPrimary: "#fb923c",
      accentSecondary: "#ea580c",
      glowColor: "rgba(251, 146, 60, 0.42)",
      haloColor: "#fbbf24",
      badgeLabel: "Autumn Nikki",
    },
  },

  "cloud-kingdom": {
    id: "cloud-kingdom",
    name: "Cloud Kingdom",
    toneNote:
      "Uplifting, lighthearted, and hopeful. Encourage soaring horizons, fresh optimism, rising above fog, and limitless possibilities in the sky.",
    greetingLines: [
      "High above the clouds with you! Look at that golden sunrise.",
      "Floating sky islands and fresh breezes. What horizon shall we chase?",
      "Rise above the heavy fog—the view up here is wide open.",
    ],
    idleAnimation: {
      pose: "celebrate",
      gaze: "up",
      companionPose: "celebrate",
      expression: "uplifting",
    },
    themeChangeReaction: {
      line: "Soaring into the golden clouds! What new heights are we reaching?",
      pose: "celebrate",
      gaze: "up",
      companionPose: "celebrate",
    },
    companionLook: {
      accentPrimary: "#facc15",
      accentSecondary: "#f472b6",
      glowColor: "rgba(250, 204, 21, 0.42)",
      haloColor: "#facc15",
      badgeLabel: "Skylark Nikki",
    },
  },

  "moonlit-sakura": {
    id: "moonlit-sakura",
    name: "Moonlit Sakura",
    toneNote:
      "Graceful, mindful, and poetic. Cherish passing moments, gentle flow, lantern glow, and tranquil reflection.",
    greetingLines: [
      "Cherry blossom petals dancing in the moonlight.",
      "Ripples on the quiet pond—find your stillness here.",
      "A quiet moment under the blossoms. I'm right here with you.",
    ],
    idleAnimation: {
      pose: "greet",
      gaze: "center",
      companionPose: "wave",
      expression: "graceful",
    },
    themeChangeReaction: {
      line: "Under the moonlit cherry blossoms... let's move with quiet grace.",
      pose: "greet",
      gaze: "center",
      companionPose: "wave",
    },
    companionLook: {
      accentPrimary: "#f472b6",
      accentSecondary: "#c084fc",
      glowColor: "rgba(244, 114, 182, 0.42)",
      haloColor: "#ffd166",
      badgeLabel: "Sakura Nikki",
    },
  },

  // Legacy ID aliases
  space: undefined as unknown as WorldPersonalityConfig,
  garden: undefined as unknown as WorldPersonalityConfig,
  ocean: undefined as unknown as WorldPersonalityConfig,
};

WORLD_PERSONALITIES.space = WORLD_PERSONALITIES["cosmic-dream"];
WORLD_PERSONALITIES.garden = WORLD_PERSONALITIES["enchanted-garden"];
WORLD_PERSONALITIES.ocean = WORLD_PERSONALITIES["abyssal-dreams"];

export function getWorldPersonality(envId: string | null | undefined): WorldPersonalityConfig {
  if (!envId) return WORLD_PERSONALITIES["cosmic-dream"];
  if (envId === "space") return WORLD_PERSONALITIES["cosmic-dream"];
  if (envId === "garden") return WORLD_PERSONALITIES["enchanted-garden"];
  if (envId === "ocean") return WORLD_PERSONALITIES["abyssal-dreams"];
  return (WORLD_PERSONALITIES as Record<string, WorldPersonalityConfig>)[envId] ?? WORLD_PERSONALITIES["cosmic-dream"];
}

