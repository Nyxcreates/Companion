import type { CinematicSceneDefinition } from "../../types/story";

export const CINEMATIC_SCENES: CinematicSceneDefinition[] = [
  {
    id: "the-beginning",
    index: 0,
    title: "Somewhere Between",
    badge: "01 / The Beginning",
    blocks: [
      {
        id: "b1-1",
        lines: [
          "Somewhere between who you are...",
          "...and who you're becoming...",
        ],
        pauseAfterMs: 800,
      },
      {
        id: "b1-2",
        lines: [
          "There is a space that belongs to you.",
        ],
      },
    ],
  },
  {
    id: "reality-of-life",
    index: 1,
    title: "The Reality of Life",
    badge: "02 / Reality of Life",
    blocks: [
      {
        id: "b2-1",
        lines: [
          "Life doesn't always follow a plan.",
        ],
        pauseAfterMs: 600,
      },
      {
        id: "b2-2",
        lines: [
          "Some days, you have a hundred dreams.",
          "Some days, finding your next step is enough.",
        ],
        pauseAfterMs: 800,
      },
      {
        id: "b2-3",
        lines: [
          "You're allowed to grow at your own pace.",
        ],
      },
    ],
  },
  {
    id: "arrival-of-companion",
    index: 2,
    title: "The Arrival of Companion",
    badge: "03 / The Arrival",
    blocks: [
      {
        id: "b3-1",
        lines: [
          "You don't have to figure it all out alone.",
          "Companion is a space built around your life.",
        ],
        pauseAfterMs: 600,
      },
      {
        id: "b3-2",
        lines: [
          "Not to judge. Not to overwhelm.",
          "Just to walk with you, day by day.",
        ],
        pauseAfterMs: 800,
      },
      {
        id: "b3-3",
        lines: [
          "Welcome to Companion.",
        ],
      },
    ],
  },
  {
    id: "life-understood",
    index: 3,
    title: "Your Life, Understood",
    badge: "04 / Understanding & Memory",
    featureHighlight: {
      tag: "Conversations & Long-term Memory",
      description: "Meaningful preferences, recurring habits, and memories you keep.",
    },
    blocks: [
      {
        id: "b4-1",
        lines: [
          "A companion who listens.",
          "Nikki remembers the things that matter to you—",
        ],
        pauseAfterMs: 600,
      },
      {
        id: "b4-2",
        lines: [
          "your goals, your habits, the promises you make to yourself.",
        ],
        pauseAfterMs: 700,
      },
      {
        id: "b4-3",
        lines: [
          "Every conversation helps her understand how to support you better.",
        ],
      },
    ],
  },
  {
    id: "dreams-become-steps",
    index: 4,
    title: "Your Dreams Become Steps",
    badge: "05 / Goals, Tasks & Time",
    featureHighlight: {
      tag: "Adaptive Planning",
      description: "Goals turn into daily actions, scheduled around your real energy and commitments.",
    },
    blocks: [
      {
        id: "b5-1",
        lines: [
          "Big dreams are built from small, quiet steps.",
        ],
        pauseAfterMs: 600,
      },
      {
        id: "b5-2",
        lines: [
          "Organize your day without the anxiety of rigid schedules.",
          "Set goals that reflect what you truly care about.",
        ],
        pauseAfterMs: 700,
      },
      {
        id: "b5-3",
        lines: [
          "When life changes, Nikki helps you adapt—without guilt.",
        ],
      },
    ],
  },
  {
    id: "space-to-begin-again",
    index: 5,
    title: "Space to Begin Again",
    badge: "06 / Reflection & Focus",
    featureHighlight: {
      tag: "Focus Mode & Journal",
      description: "Distraction-free focus sessions and compassionate evening reflections.",
    },
    blocks: [
      {
        id: "b6-1",
        lines: [
          "When the world is too loud...",
        ],
        pauseAfterMs: 600,
      },
      {
        id: "b6-2",
        lines: [
          "...find your focus.",
          "Journal your thoughts. Clear your mind. Reset your day.",
        ],
        pauseAfterMs: 700,
      },
      {
        id: "b6-3",
        lines: [
          "Every day is a fresh canvas.",
        ],
      },
    ],
  },
  {
    id: "your-world-your-way",
    index: 6,
    title: "Your World, Your Way",
    badge: "07 / Your Space",
    hasCharacterStageSlot: true,
    featureHighlight: {
      tag: "Your Companion",
      description: "An intelligent presence designed to evolve alongside your growth.",
    },
    blocks: [
      {
        id: "b7-1",
        lines: [
          "Your companion. Your pace. Your space.",
        ],
        pauseAfterMs: 600,
      },
      {
        id: "b7-2",
        lines: [
          "A presence designed to grow alongside you.",
        ],
        pauseAfterMs: 700,
      },
      {
        id: "b7-3",
        lines: [
          "Customizable, personal, and always by your side.",
        ],
      },
    ],
  },
  {
    id: "enter-companion",
    index: 7,
    title: "Enter Companion",
    badge: "08 / Enter Companion",
    blocks: [
      {
        id: "b8-1",
        lines: [
          "Your journey doesn't start with perfection.",
          "It starts with showing up.",
        ],
        pauseAfterMs: 700,
      },
      {
        id: "b8-2",
        lines: [
          "Welcome to Companion.",
        ],
      },
    ],
  },
];
