import type { BotState, ScannedRobotEvent } from "./types.js";
import { distance, normalizeAngle } from "./util.js";

/**
 * Returns a ScannedRobotEvent for every enemy bot whose center falls within
 * the radar arc swept this tick (from prevRadarHeading to scanner.radarHeading).
 */
export function computeRadarScans(
  scanner: BotState,
  prevRadarHeading: number,
  bots: readonly BotState[],
): ScannedRobotEvent[] {
  const events: ScannedRobotEvent[] = [];

  const sweepDelta = normalizeAngle(scanner.radarHeading - prevRadarHeading);

  for (const target of bots) {
    if (target.id === scanner.id || !target.isAlive) continue;

    const dx = target.position.x - scanner.position.x;
    const dy = target.position.y - scanner.position.y;
    // Angle from scanner to target in Robocode convention (0=north, CW, y-down)
    const angleToTarget = (Math.atan2(dx, -dy) * 180) / Math.PI;

    const relToPrev = normalizeAngle(angleToTarget - prevRadarHeading);

    const inArc =
      sweepDelta >= 0
        ? relToPrev >= 0 && relToPrev <= sweepDelta
        : relToPrev <= 0 && relToPrev >= sweepDelta;

    if (inArc) {
      events.push({
        type: "scannedRobot",
        sourceId: scanner.id,
        scannedId: target.id,
        bearing: normalizeAngle(angleToTarget - scanner.heading),
        distance: distance(scanner.position, target.position),
        energy: target.energy,
        heading: target.heading,
        velocity: target.velocity,
      });
    }
  }

  return events;
}
