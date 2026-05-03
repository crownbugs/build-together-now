/**
 * Object-vs-object collision resolution (AABB / sphere). Honors `canCollide`
 * on BOTH parties — if either side opts out, the pair passes through.
 *
 * Anchored objects act as immovable walls; non-anchored ones are pushed out
 * along the minimum-translation axis and have their normal velocity zeroed.
 *
 * This is intentionally a cheap O(n²) sweep — fine for the dozens-to-low-
 * hundreds of parts a beginner-friendly engine deals with. Spatial hashing
 * is a future optimization.
 */
import type { RuntimeObject } from "../gameRuntime";

function half(o: RuntimeObject) {
  return {
    x: Math.max(0.05, (o.scale.x || 1) * 0.5),
    y: Math.max(0.05, (o.scale.y || 1) * 0.5),
    z: Math.max(0.05, (o.scale.z || 1) * 0.5),
  };
}

function resolvePair(a: RuntimeObject, b: RuntimeObject) {
  if (!a.canCollide || !b.canCollide) return;
  if (a.anchored && b.anchored) return;

  // Sphere-sphere fast path.
  if (a.primitiveType === "sphere" && b.primitiveType === "sphere") {
    const ra = Math.max(a.scale.x, a.scale.y, a.scale.z) * 0.5;
    const rb = Math.max(b.scale.x, b.scale.y, b.scale.z) * 0.5;
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const dz = b.position.z - a.position.z;
    const d = Math.hypot(dx, dy, dz);
    const min = ra + rb;
    if (d >= min || d < 1e-4) return;
    const nx = dx / d, ny = dy / d, nz = dz / d;
    const push = min - d;
    applyPush(a, b, nx, ny, nz, push);
    return;
  }

  // Otherwise treat both as AABB (cylinder/plane fall back here).
  const ha = half(a), hb = half(b);
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const dz = b.position.z - a.position.z;
  const ox = ha.x + hb.x - Math.abs(dx);
  const oy = ha.y + hb.y - Math.abs(dy);
  const oz = ha.z + hb.z - Math.abs(dz);
  if (ox <= 0 || oy <= 0 || oz <= 0) return;

  let nx = 0, ny = 0, nz = 0, push = 0;
  if (ox <= oy && ox <= oz) { nx = dx >= 0 ? 1 : -1; push = ox; }
  else if (oy <= oz) { ny = dy >= 0 ? 1 : -1; push = oy; }
  else { nz = dz >= 0 ? 1 : -1; push = oz; }

  applyPush(a, b, nx, ny, nz, push);
}

function applyPush(
  a: RuntimeObject, b: RuntimeObject,
  nx: number, ny: number, nz: number,
  push: number
) {
  // Distribute the push: anchored side doesn't move.
  let aShare = 0.5, bShare = 0.5;
  if (a.anchored) { aShare = 0; bShare = 1; }
  else if (b.anchored) { aShare = 1; bShare = 0; }

  a.position.x -= nx * push * aShare;
  a.position.y -= ny * push * aShare;
  a.position.z -= nz * push * aShare;
  b.position.x += nx * push * bShare;
  b.position.y += ny * push * bShare;
  b.position.z += nz * push * bShare;

  // Zero normal-component of relative velocity so they stop interpenetrating.
  if (!a.anchored) {
    const vDotN = a.velocity.x * nx + a.velocity.y * ny + a.velocity.z * nz;
    if (vDotN > 0) {
      a.velocity.x -= nx * vDotN;
      a.velocity.y -= ny * vDotN;
      a.velocity.z -= nz * vDotN;
    }
  }
  if (!b.anchored) {
    const vDotN = b.velocity.x * nx + b.velocity.y * ny + b.velocity.z * nz;
    if (vDotN < 0) {
      b.velocity.x -= nx * vDotN;
      b.velocity.y -= ny * vDotN;
      b.velocity.z -= nz * vDotN;
    }
  }
}

/** Resolve all collidable pairs in Workspace. Skips anchored↔anchored. */
export function resolveObjectCollisions(objects: RuntimeObject[]) {
  // Pre-filter once.
  const pool: RuntimeObject[] = [];
  for (const o of objects) {
    if (!o.visible) continue;
    if (o.container !== "Workspace") continue;
    if (o.type === "light" || o.type === "spawn") continue;
    if (!o.canCollide) continue;
    pool.push(o);
  }
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      resolvePair(pool[i], pool[j]);
    }
  }
}
