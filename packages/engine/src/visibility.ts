import type { BotState, VisibilityPair } from "./types.js";

/**
 * Returns all observer→target pairs for alive bots.
 * All alive bots are visible to each other — no range limit.
 * When arena terrain/obstacles are introduced this becomes a raycasting LOS check.
 */
export function computeVisibility(bots: readonly BotState[]): readonly VisibilityPair[] {
  const pairs: VisibilityPair[] = [];

  for (const observer of bots) {
    if (!observer.isAlive) continue;
    for (const target of bots) {
      if (target.id === observer.id || !target.isAlive) continue;
      pairs.push({ observerId: observer.id, targetId: target.id });
    }
  }

  return pairs;
}
