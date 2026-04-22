import type { BotState, VisibilityPair, Polygon } from "./types.js";

/**
 * Returns all observer→target pairs for alive bots whose line of sight
 * is not blocked by a terrain obstacle.
 */
export function computeVisibility(bots: readonly BotState[], obstacles: readonly Polygon[]): readonly VisibilityPair[] {
  const pairs: VisibilityPair[] = [];

  for (const observer of bots) {
    if (!observer.isAlive) continue;
    for (const target of bots) {
      if (target.id === observer.id || !target.isAlive) continue;
      if (!losBlocked(observer.position.x, observer.position.y,
                      target.position.x, target.position.y, obstacles)) {
        pairs.push({ observerId: observer.id, targetId: target.id });
      }
    }
  }

  return pairs;
}

function losBlocked(x1: number, y1: number, x2: number, y2: number, obstacles: readonly Polygon[]): boolean {
  for (const obs of obstacles) {
    if (segmentIntersectsPolygon(x1, y1, x2, y2, obs)) return true;
  }
  return false;
}

function segmentsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  const d1x = ax2 - ax1, d1y = ay2 - ay1;
  const d2x = bx2 - bx1, d2y = by2 - by1;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-9) return false;
  const t = ((bx1 - ax1) * d2y - (by1 - ay1) * d2x) / cross;
  const u = ((bx1 - ax1) * d1y - (by1 - ay1) * d1x) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i]!.x, yi = poly[i]!.y;
    const xj = poly[j]!.x, yj = poly[j]!.y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentIntersectsPolygon(x1: number, y1: number, x2: number, y2: number, poly: Polygon): boolean {
  if (pointInPolygon(x1, y1, poly) || pointInPolygon(x2, y2, poly)) return true;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (segmentsIntersect(x1, y1, x2, y2, poly[j]!.x, poly[j]!.y, poly[i]!.x, poly[i]!.y)) return true;
  }
  return false;
}
