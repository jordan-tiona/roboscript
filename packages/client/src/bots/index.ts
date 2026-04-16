import { TRACKER_BOT_NAME, TRACKER_BOT_CODE } from "./tracker.js";
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
    description: "Sweeps radar and fires on any scanned enemy.",
    entry: { id: "bot-builtin-tracker", name: TRACKER_BOT_NAME, code: TRACKER_BOT_CODE },
  },
];
