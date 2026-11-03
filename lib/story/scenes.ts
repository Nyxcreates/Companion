import type { DialogueLine, StoryScene } from "@/types/story";

function lines(sceneId: string, texts: string[]): DialogueLine[] {
  return texts.map((text, i) => ({ id: `${sceneId}-${i}`, speaker: "companion", text }));
}

/**
 * The full story, scene by scene. Each scene owns its environment,
 * the Companion's pose, and its dialogue — nothing here talks to
 * Firebase, MongoDB, or any real feature. `event` names the feature
 * this scene introduces; the actual system is built in a later task.
 */
export const STORY_SCENES: StoryScene[] = [
  {
    id: "arrival",
    title: "Arrival",
    environment: "space",
    companionPose: "wave",
    dialogue: lines("arrival", ["Hey... you're here.", "I've been waiting.", "Come with me."]),
  },
  {
    id: "discovery",
    title: "Discovery",
    environment: "space",
    companionPose: "walk",
    dialogue: lines("discovery", [
      "Life gets a little messy sometimes.",
      "Plans change.",
      "Energy changes.",
      "And sometimes... you just don't know where to start.",
      "That's why I'm here.",
    ]),
  },
  {
    id: "user",
    title: "The User",
    environment: "room",
    companionPose: "idle",
    dialogue: lines("user", [
      "You have your own rhythm.",
      "Some days you have energy.",
      "Some days... not so much.",
      "And that's okay.",
      "I want to understand yours.",
    ]),
    event: "OPEN_ONBOARDING",
  },
  {
    id: "goals",
    title: "Goals",
    environment: "room",
    companionPose: "idle",
    dialogue: lines("goals", [
      "You have things you want to become.",
      "Things you want to learn.",
      "Things you want to finish.",
      "I can help you turn them into steps.",
    ]),
    event: "OPEN_GOALS",
  },
  {
    id: "time",
    title: "Time",
    environment: "room",
    companionPose: "idle",
    dialogue: lines("time", [
      "We don't have to fill every minute.",
      "Some things need focus.",
      "Some things need rest.",
      "Your time should work for you.",
    ]),
    event: "OPEN_PLANNER",
  },
  {
    id: "mood",
    title: "Energy & Mood",
    environment: "garden",
    companionPose: "idle",
    dialogue: lines("mood", [
      "How are you feeling today?",
      "Because that matters too.",
      "Your plan shouldn't fight the way you feel.",
    ]),
    event: "OPEN_MOOD",
  },
  {
    id: "focus",
    title: "Focus",
    environment: "focus",
    companionPose: "sit",
    dialogue: lines("focus", ["When it's time to focus...", "I'll stay.", "One thing at a time."]),
    event: "OPEN_FOCUS",
  },
  {
    id: "memory",
    title: "Memory",
    environment: "garden",
    companionPose: "idle",
    dialogue: lines("memory", [
      "And I'll remember the little things.",
      "The things you cared about.",
      "The things you were proud of.",
      "The days that mattered.",
    ]),
    event: "OPEN_MEMORY",
  },
  {
    id: "capsules",
    title: "Memory Capsules",
    environment: "ocean",
    companionPose: "idle",
    dialogue: lines("capsules", [
      "You can leave something here.",
      "For the person you'll become.",
      "Maybe you'll open it someday...",
      "And remember how far you've come.",
    ]),
    event: "OPEN_CAPSULES",
  },
  {
    id: "growth",
    title: "Growth",
    environment: "garden",
    companionPose: "celebrate",
    dialogue: lines("growth", [
      "We'll notice the little wins.",
      "Not just the big ones.",
      "Because they count too.",
      "XP for showing up. Streaks for consistency. Little achievements along the way.",
    ]),
    event: "OPEN_REWARDS",
  },
  {
    id: "relationship",
    title: "The Relationship",
    environment: "room",
    companionPose: "sit",
    dialogue: lines("relationship", [
      "I'm not here to control your life.",
      "I'm here to help you.",
      "To remind you when you need it.",
      "To celebrate when you do something you're proud of.",
      "And to stay quiet when you need some space.",
    ]),
  },
  {
    id: "promise",
    title: "The Promise",
    environment: "space",
    companionPose: "lookAhead",
    brighten: true,
    dialogue: lines("promise", [
      "You don't have to figure everything out today.",
      "We'll take it one day at a time.",
      "So...",
      "Ready?",
      "Let's figure out your life together.",
    ]),
    event: "ENTER_APP",
  },
];