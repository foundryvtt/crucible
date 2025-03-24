
export default class CrucibleRuler extends foundry.canvas.interaction.Ruler {

  /**
   * The Movement action being measured, or null.
   * @type {CrucibleAction|null}
   */
  #action = null;

  /**
   * A reference to the Actor who is moving, or null.
   * @type {CrucibleActor|null}
   */
  #actor = null;

  /**
   * String labels applied to the measured distance
   * @type {{cost: string, distance: string}}
   */
  #labels = {
    distance: undefined,
    cost: undefined
  }

  /**
   * An array of offsets relative to the grid position of the token center which define the full base size of the token.
   * @type {[number, number][]}
   */
  #footprint = [];

  /**
   * A set of grid offsets which have already been highlighted.
   * @type {Set<number>}
   */
  #highlighted = new Set();

  get cost() {
    return this.#action?.cost.action || 0;
  }

  /* -------------------------------------------- */

  /**
   * Identify measurement origin.
   * Measurement origin is either (1) unsnapped, (2) a Token center, or (3) a grid space center.
   * @override
   */
  _getMeasurementOrigin(point, {snap=true}={}) {
    if ( !snap ) return {x: point.x, y: point.y};
    if ( this.token?.actor ) {
      point = this.token.center;
      const isEven = this.token.actor.size % 2 === 0;
      const mode = CONST.GRID_SNAPPING_MODES[isEven ? "VERTEX" : "CENTER"];
      return canvas.grid.getSnappedPoint(point, {mode})
    }
    else return canvas.grid.getCenterPoint(point);
  }

  /* -------------------------------------------- */

  /**
   * Identify measurement origin.
   * Measurement destination is either (1) unsnapped, (2) a Token center, or (3) a grid space center.
   * @override
   */
  _getMeasurementDestination(point, {snap=true}={}) {
    if ( !snap ) return {x: point.x, y: point.y};
    if ( this.token?.actor ) {
      const isEven = this.token.actor.size % 2 === 0;
      const mode = CONST.GRID_SNAPPING_MODES[isEven ? "VERTEX" : "CENTER"];
      return canvas.grid.getSnappedPoint(point, {mode})
    }
    else return canvas.grid.getCenterPoint(point);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _startMeasurement(origin, options={}) {
    super._startMeasurement(origin, options);
    this.#footprint.length = 0;
    this.#actor = null;
    this.#action = null;
    if ( this.token?.actor ) {
      this.#actor = this.token.actor;
      this.#action = this.#actor.actions.move.clone();
      this.#identifyFootprint();
    }
  }

  /* -------------------------------------------- */

  /**
   * Identify the grid offsets which comprise the token footprint relative to the measurement origin.
   */
  #identifyFootprint() {
    this.#footprint.length = 0;
    const {width, height} = this.token.document;
    const center = canvas.grid.getOffset(this.waypoints[0]);
    const origin = canvas.grid.getOffset(this.token);
    const i0 = origin.i - center.i;
    const j0 = origin.j - center.j;
    for ( let i=i0; i<i0+height; i++ ) {
      for ( let j=j0; j<j0+width; j++ ) {
        this.#footprint.push([i, j]);
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _computeDistance(gridSpaces) {
    super._computeDistance(gridSpaces);
    this.#computeCost()
  }

  /* -------------------------------------------- */

  /**
   * Compute the cost of the measured move
   */
  #computeCost() {
    this.#labels.distance = `${this.totalDistance.toFixed(2)} ${canvas.scene.grid.units}`;
    if ( !this.#action ) return;
    this.#action.usage.distance = this.totalDistance;
    SYSTEM.ACTION.TAGS.movement.prepare.call(this.#action);
    const ap = this.#action.cost.action;
    if ( ap === 0 ) this.#labels.cost = "Free";
    else if ( ap === Infinity ) this.#labels.cost = "Impossible";
    else this.#labels.cost = `${ap}AP`;
  }

  /* -------------------------------------------- */

  /** @override */
  _getSegmentLabel(segment, totalDistance) {
    if ( !segment.last ) return null;
    if ( !this.#action ) return this.#labels.distance;
    return `${this.#labels.distance} [${this.#labels.cost}]`;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _drawMeasuredPath() {
    super._drawMeasuredPath();
    if ( this.#actor?.isOwner && this.segments.length ) {
      const label = this.segments.at(-1).label;
      label.tint = this.cost > this.#actor.system.resources.action.value ? 0xDD0011 : 0xFFFFFF;
    }
    this.#highlighted.clear();
  }

  /* -------------------------------------------- */

  /** @override */
  _highlightMeasurementSegment(segment) {
    if ( !this.token || segment.teleport ) return; // No highlight
    const path = canvas.grid.getDirectPath([segment.ray.A, segment.ray.B]);
    for ( const offset of path ) {
      for ( const d of this.#footprint ) {
        const o = {i: offset.i + d[0], j: offset.j + d[1]};
        const k = (o.i << 16) + o.j;
        if ( this.#highlighted.has(k) ) continue;
        this.#highlighted.add(k);
        const p = canvas.grid.getTopLeftPoint(o);
        canvas.interface.grid.highlightPosition(this.name, {...p, color: this.color});
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _canMove(token) {
    super._canMove(token);
    if ( this.#action ) this.#action._canUse();
    return true;
  }

  /* -------------------------------------------- */

  /** @override */
  async _preMove(token) {
    if ( !this.totalDistance || !this.#action ) return;
    this.#action.updateSource({
      name: `Move ${this.#labels.distance}`,
      cost: this.#action.cost
    });
    await this.#action.use({token, chatMessage: true, dialog: false});
  }
}
