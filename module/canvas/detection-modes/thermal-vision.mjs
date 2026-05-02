/**
 * A custom DetectionMode that is specialized in perceiving temperature changes from ambient equilibrium.
 */
export default class DetectionModeThermalVision extends foundry.canvas.perception.DetectionMode {

  /**
   * Glow colors for each detectable temperature tier. Hot tiers shade orange/red; cold tiers shade blue/purple.
   * @type {Readonly<Record<string, [number, number, number, number]>>}
   */
  static #GLOW_COLORS = Object.freeze({
    boiling: [1.0, 0.1, 0.0, 1],
    warm: [1.0, 0.55, 0.0, 1],
    cool: [0.25, 0.5, 1.0, 1],
    gelid: [0.6, 0.3, 1.0, 1]
  });

  /**
   * Cached glow filters keyed by temperature tier id.
   * @type {Map<string, foundry.canvas.rendering.filters.GlowOverlayFilter>}
   */
  static #filtersByTier = new Map();

  /**
   * The temperature tier id of the most recently detected target. Set by `_canDetect` and consumed by
   * `getDetectionFilter`, which the visibility loop calls immediately after a successful `testVisibility`.
   * @type {string|null}
   */
  static #pendingTier = null;

  /* -------------------------------------------- */

  /** @override */
  static getDetectionFilter() {
    const tierId = this.#pendingTier;
    this.#pendingTier = null;
    if ( !tierId ) return undefined;
    let filter = this.#filtersByTier.get(tierId);
    if ( !filter ) {
      filter = foundry.canvas.rendering.filters.GlowOverlayFilter.create({glowColor: this.#GLOW_COLORS[tierId]});
      this.#filtersByTier.set(tierId, filter);
    }
    return filter;
  }

  /* -------------------------------------------- */

  /** @override */
  _canDetect(visionSource, target) {

    // Thermal vision only works on creatures
    if ( !(target instanceof foundry.canvas.placeables.Token) ) return false;
    const source = visionSource.object.document;

    // Cannot see if blinded or incapacitated
    if ( source.hasStatusEffect(CONFIG.specialStatusEffects.BLIND) ) return false;
    if ( source.hasStatusEffect(CONFIG.specialStatusEffects.INCAPACITATED) ) return false;

    // If constrained by walls, cannot see if either source or target is burrowing
    if ( this.walls ) {
      if ( source.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
      if ( target.document.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    }

    // Resolve the target's temperature tier; thermal vision only sees creatures with thermal contrast
    const tierId = DetectionModeThermalVision.#getTargetTemperature(target.actor);
    if ( !tierId || (tierId === "neutral") ) return false;
    DetectionModeThermalVision.#pendingTier = tierId;
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Resolve the temperature tier id for a target actor.
   * @param {CrucibleActor|null} actor
   * @returns {string|null}
   */
  static #getTargetTemperature(actor) {
    if ( !actor ) return null;
    if ( actor.type === "hero" ) {
      return actor.system.details?.ancestry?.characteristics?.temperature
        || SYSTEM.ACTOR.CREATURE_CATEGORIES.humanoid.temperature;
    }
    const taxonomy = actor.system.details?.taxonomy;
    if ( !taxonomy ) return null;
    return taxonomy.characteristics?.temperature
      || SYSTEM.ACTOR.CREATURE_CATEGORIES[taxonomy.category]?.temperature
      || null;
  }

  /* -------------------------------------------- */

  /** @override */
  _testLOS(visionSource, mode, target, test) {

    // If outside vision angle, can't detect
    if ( this.angle && !this._testAngle(visionSource, mode, target, test) ) return false;

    // If not constrained by walls, can detect
    if ( !this.walls ) return true;

    // Otherwise, standard sight check, but ignoring darkness sources
    return !CONFIG.Canvas.polygonBackends.sight.testCollision(visionSource.origin, test.point, {
      type: "sight",
      mode: "any",
      source: visionSource,
      useThreshold: true,
      priority: Infinity
    });
  }
}
