import trackerCode from "./code/tracker.js?raw";
import circlerCode from "./code/circler.js?raw";
import sniperCode from "./code/sniper.js?raw";
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
    name: "Tracker",
    description: "Aims at the nearest enemy and pursues last known position.",
    entry: { id: "bot-builtin-tracker", name: "Tracker", code: trackerCode },
  },
  {
    id: "circler",
    name: "Circler",
    description: "Continuously circles the arena while tracking and firing at the nearest enemy.",
    entry: { id: "bot-builtin-circler", name: "Circler", code: circlerCode },
  },
  {
    id: "sniper",
    name: "Sniper",
    description: "Patrols the walls and uses linear shot prediction to lead moving targets.",
    entry: { id: "bot-builtin-sniper", name: "Sniper", code: sniperCode },
  },
];
