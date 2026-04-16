import { TRACKER_BOT_NAME, TRACKER_BOT_CODE } from "./tracker.js";
import { CIRCLER_BOT_NAME, CIRCLER_BOT_CODE } from "./circler.js";
import type { BotEntry } from "../game/GameDriver.js";

export interface BuiltInBot {
  id: string;
  name: string;
  description: string;
  entry: BotEntry;
}

export const BUILT_IN_BOTS: BuiltInBot[] = [
  {
    id: "tracker",
    name: TRACKER_BOT_NAME,
    description: "Aims at the nearest enemy and pursues last known position.",
    entry: { id: "bot-builtin-tracker", name: TRACKER_BOT_NAME, code: TRACKER_BOT_CODE },
  },
  {
    id: "circler",
    name: CIRCLER_BOT_NAME,
    description: "Continuously circles the arena while tracking and firing at the nearest enemy.",
    entry: { id: "bot-builtin-circler", name: CIRCLER_BOT_NAME, code: CIRCLER_BOT_CODE },
  },
];
