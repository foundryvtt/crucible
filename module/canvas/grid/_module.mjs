export {default as CrucibleSelectiveGridShader} from "./grid-shader.mjs";
export {default as CrucibleGridLayer} from "./grid-layer.mjs";
export {default as CrucibleHitBoxShader} from "./hit-box-shader.mjs";

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

/**
 * Test linear range between an attacker and a target.
 * @param {CrucibleTokenObject} attacker
 * @param {CrucibleTokenObject} target
 * @returns {number} The linear distance between attacker and target
 */
export function getLinearRangeCost(attacker, target) {
  const ab = attacker.bounds;
  const {elevation: ae, size: as} = attacker.document;
  const tb = target.bounds;
  const {elevation: te, size: ts} = target.document;

  // Overlapping bounds
  if ( ab.overlaps(tb) ) {
    if ( (ae + as) < te ) return te - (ae + as);
    else if ( ae > (te + ts) ) return (te + ts) - ae;
    else return 0;
  }

  // Determine origin and target points of the ray
  const A = {elevation: ae}; // Attacker
  const T = {elevation: te}; // Target
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
