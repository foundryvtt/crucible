export {default as CrucibleSelectiveGridShader} from "./grid-shader.mjs";
export {default as CrucibleGridLayer} from "./grid-layer.mjs";
export {default as CrucibleHitBoxShader} from "./hit-box-shader.mjs";

/**
 * @import {Point} from "@common/_types.mjs";
 * @import {TokenPosition} from "@common/documents/_types.mjs";
 */

/**
 * Get the grid offsets of an AOE template shape.
 * @param {Point} origin
 * @param {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon} shape
 * @returns {GridOffset[]}
 */
export function getTargetAreaOffsets(origin, shape) {
  const originOffset = canvas.grid.getOffset(origin);
  const k0 = (originOffset.i << 16) | originOffset.j;
  if ( !shape.contains(origin.x, origin.y) ) {
    throw new Error("The origin point must be contained within the shape.");
  }
  const offsets = [originOffset];
  const tested = new Set([k0]);

  const quadrants = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for ( const [si, sj] of quadrants ) {
    for ( let di=0; di<Infinity; di++ ) {
      const i = originOffset.i + (di * si);
      let hit = false;
      for ( let dj=0; dj<Infinity; dj++ ) {
        const j = originOffset.j + (dj * sj);
        const o = {i, j};
        const k = (i << 16) | j;
        if ( tested.has(k) ) {
          hit = true;
          continue;
        }
        tested.add(k);
        const c = canvas.grid.getCenterPoint(o);
        if ( !shape.contains(c.x, c.y) ) break;
        offsets.push(o);
        offsets.push(o);
        hit = true;
      }
      if ( !hit ) break;
    }
  }
  return offsets;
}

/* -------------------------------------------- */

/**
 * Measure the linear base-to-base range between two token-shaped footprints, accounting for elevation.
 * Inputs are typed as {@link TokenPosition} so a hypothetical placement (not yet a Token) can be measured.
 * @param {TokenPosition} a    The first footprint (top-left x/y in pixels, width/height/depth in grid spaces)
 * @param {TokenPosition} b    The second footprint
 * @returns {number}           The base-to-base distance in grid units (0 when the footprints overlap in 3D)
 */
export function getLinearRange(a, b) {
  const gs = canvas.grid.size;
  const ab = new PIXI.Rectangle(a.x, a.y, a.width * gs, a.height * gs);
  const {elevation: ae, depth: as} = a;
  const tb = new PIXI.Rectangle(b.x, b.y, b.width * gs, b.height * gs);
  const {elevation: te, depth: ts} = b;

  // Overlapping bounds
  if ( ab.overlaps(tb) ) {
    if ( (ae + as) < te ) return te - (ae + as);
    else if ( ae > (te + ts) ) return (te + ts) - ae;
    else return 0;
  }

  // Determine origin and target points of the ray
  const A = {elevation: ae}; // First footprint
  const T = {elevation: te}; // Second footprint
  if ( ab.bottom < tb.top ) {
    A.y = ab.bottom;
    T.y = tb.top;
  }
  else if ( ab.top > tb.bottom ) {
    A.y = ab.top;
    T.y = tb.bottom;
  }
  else A.y = T.y = (Math.max(ab.top, tb.top) + Math.min(ab.bottom, tb.bottom)) / 2;
  if ( ab.right < tb.left ) {
    A.x = ab.right;
    T.x = tb.left;
  }
  else if ( ab.left > tb.right ) {
    A.x = ab.left;
    T.x = tb.right;
  }
  else A.x = T.x = (Math.max(ab.left, tb.left) + Math.min(ab.right, tb.right)) / 2;

  // Measure distance
  return canvas.grid.measurePath([A, T]).distance;
}

/* -------------------------------------------- */

/**
 * Test linear range between an attacker and a target.
 * @param {CrucibleTokenObject} attacker
 * @param {CrucibleTokenObject} target
 * @returns {number} The linear distance between attacker and target
 */
export function getLinearRangeCost(attacker, target) {
  return getLinearRange(attacker.document, target.document);
}

/* -------------------------------------------- */

/**
 * Clamp a summon placement so it neither overlaps the summoning token nor exceeds the maximum base-to-base range.
 * Summon anchor is its top-left corner, same as Token position. Naive placement would be asymmetric in distance.
 * Overlapping placements are pushed outwards along the placement vector.
 * Out-of-range placements are pulled inwards along the placement vector.
 * @param {TokenPosition} caster    The summoning token's footprint
 * @param {TokenPosition} summon    The candidate summon footprint; its x/y is the proposed top-left placement
 * @param {number} maxRange         The maximum permitted base-to-base range in grid units
 * @param {object} [options]
 * @param {boolean} [options.snap=true]    Vertex-snap the resulting placement without re-introducing overlap
 * @returns {Point}                  The adjusted top-left placement point
 */
export function clampSummonPlacement(caster, summon, maxRange, {snap=true}={}) {
  const gs = canvas.grid.size;
  const halfW = (summon.width * gs) / 2;
  const halfH = (summon.height * gs) / 2;
  const casterCenter = {x: caster.x + ((caster.width * gs) / 2), y: caster.y + ((caster.height * gs) / 2)};
  const casterBounds = new PIXI.Rectangle(caster.x, caster.y, caster.width * gs, caster.height * gs);

  // Unit vector of the placement ray from caster center toward the proposed summon center
  let ux = (summon.x + halfW) - casterCenter.x;
  let uy = (summon.y + halfH) - casterCenter.y;
  const dist = Math.hypot(ux, uy);
  if ( dist === 0 ) { ux = 1; uy = 0; } // Degenerate drop-on-caster: default to placing eastward
  else { ux /= dist; uy /= dist; }

  // Footprint at a candidate center distance along the ray, plus a strict-overlap test
  const footprintAt = t => ({...summon,
    x: (casterCenter.x + (ux * t)) - halfW, y: (casterCenter.y + (uy * t)) - halfH});
  const intersects = f => casterBounds.intersects(new PIXI.Rectangle(f.x, f.y, summon.width * gs, summon.height * gs));

  // Push out of caster overlap to the nearest adjacent position, then pull in to the maximum range
  const hiClear = (caster.width + caster.height + summon.width + summon.height) * gs;
  const tMin = _searchLowest(0, hiClear, t => !intersects(footprintAt(t)));
  let t = Math.max(dist, tMin);
  if ( getLinearRange(caster, footprintAt(t)) > maxRange ) {
    t = _searchHighest(tMin, t, tt => getLinearRange(caster, footprintAt(tt)) <= maxRange);
  }

  // Resolve the top-left placement, optionally vertex-snapped while stepping clear of any snap-induced overlap
  let point = {x: footprintAt(t).x, y: footprintAt(t).y};
  if ( snap ) {
    point = canvas.grid.getSnappedPoint(point, {mode: CONST.GRID_SNAPPING_MODES.VERTEX});
    for ( let guard = 0; intersects(point) && (guard < 8); guard++ ) {
      point = canvas.grid.getSnappedPoint({x: point.x + (ux * gs), y: point.y + (uy * gs)},
        {mode: CONST.GRID_SNAPPING_MODES.VERTEX});
    }
  }
  return point;
}

/* -------------------------------------------- */

/**
 * Binary search for the lowest value in [lo, hi] at which a monotonic false-then-true predicate becomes true.
 * @param {number} lo
 * @param {number} hi
 * @param {(t: number) => boolean} pred
 * @returns {number}
 */
function _searchLowest(lo, hi, pred) {
  for ( let i = 0; i < 24; i++ ) {
    const mid = (lo + hi) / 2;
    if ( pred(mid) ) hi = mid;
    else lo = mid;
  }
  return hi;
}

/* -------------------------------------------- */

/**
 * Binary search for the highest value in [lo, hi] at which a monotonic true-then-false predicate remains true.
 * @param {number} lo
 * @param {number} hi
 * @param {(t: number) => boolean} pred
 * @returns {number}
 */
function _searchHighest(lo, hi, pred) {
  for ( let i = 0; i < 24; i++ ) {
    const mid = (lo + hi) / 2;
    if ( pred(mid) ) lo = mid;
    else hi = mid;
  }
  return lo;
}
