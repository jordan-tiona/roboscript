import type { BotState, VisibilityPair } from "./types.js";
import { VISIBILITY_RANGE } from "./constants.js";
import { distanceSq } from "./util.js";

/**
 * Returns all observer→target pairs where the target is within VISIBILITY_RANGE.
 * MVP implementation: pure range-based. Will be replaced with raycasting once
 * arena terrain/obstacles are introduced.
 */
export function computeVisibility(bots: readonly BotState[]): readonly VisibilityPair[] {
  const pairs: VisibilityPair[] = [];
  const rangeSq = VISIBILITY_RANGE * VISIBILITY_RANGE;

  for (const observer of bots) {
    if (!observer.isAlive) continue;
    for (const target of bots) {
      if (target.id === observer.id || !target.isAlive) continue;
      if (distanceSq(observer.position, target.position) <= rangeSq) {
        pairs.push({ observerId: observer.id, targetId: target.id });
      }
    }
  }

  return pairs;
}
