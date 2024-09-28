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

  const quadrants = [[-1,-1], [1,-1], [1,1], [-1, 1]];
  for ( const [si, sj] of quadrants ) {
    for ( let di=0; di<Infinity; di++ ) {
      const i = originOffset.i + (di * si);
      let hit = false;
      for ( let dj=0; dj<Infinity; dj++ ) {
        const j = originOffset.j + (dj * sj);
        const o = {i,j};
        const k = (i << 16) | j;
        if ( tested.has(k) ) {
          hit = true;
          continue;
        }
        tested.add(k);
        const c = canvas.grid.getCenterPoint(o);
        if ( !shape.contains(c.x, c.y) ) break;
        offsets.push(o);
        hit = true;
      }
      if ( !hit ) break;
    }
  }
  return offsets;
}


/**
 * TODO
 * Express the target area as a consolidated polygon.
 * Idea: classify all offsets into quadrants in getTargetAreaOffsets. Go quadrant-by-quadrant adding the perimeter edges
 * @param origin
 * @param offsets
 */
export function getTargetAreaPolygon(origin, offsets) {
}


/**
 * Test linear range between an attacker and a target.
 * @param {CrucibleTokenObject} attacker
 * @param {CrucibleTokenObject} target
 * @returns {number} The linear distance between attacker and target
 */
export function getLinearRangeCost(attacker, target) {
  const ab = attacker.bounds;
  const tb = target.bounds;
  if ( ab.overlaps(tb) ) return 0;
  const r = new Ray(attacker.center, target.center);
  const xAttacker = ab.segmentIntersections(r.A, r.B)[0];
  const xTarget = tb.segmentIntersections(r.A, r.B)[0];
  return canvas.grid.measurePath([xAttacker, xTarget]).distance;
}

