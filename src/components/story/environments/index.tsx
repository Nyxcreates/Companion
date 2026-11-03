import type { ComponentType } from "react";
import type { EnvironmentId } from "@/types/story";
import { SpaceScene } from "@/components/landing/space/SpaceScene";
import { GardenScene } from "./GardenScene";
import { OceanScene } from "./OceanScene";
import { RoomScene } from "./RoomScene";
import { FocusScene } from "./FocusScene";

/**
 * Registry mapping each EnvironmentId to its component. Space reuses
 * the fully-developed environment from earlier milestones; the other
 * four are intentionally lightweight placeholders, each isolated in
 * its own file so it can be replaced with a fully animated world
 * later without touching the story engine.
 */
export const ENVIRONMENTS: Record<EnvironmentId, ComponentType> = {
  space: SpaceScene,
  garden: GardenScene,
  ocean: OceanScene,
  room: RoomScene,
  focus: FocusScene,
};