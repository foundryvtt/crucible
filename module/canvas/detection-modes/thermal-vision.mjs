export default class DetectionModeThermalVision extends foundry.canvas.perception.DetectionMode {
  /** @override */
  static getDetectionFilter() {
    this._detectionFilter ??= foundry.canvas.rendering.filters.GlowOverlayFilter.create({glowColor: [1, 0.5, 0, 1]});
    return this._detectionFilter;
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

    // Allow for specific creature overrides
    // TODO: Check the appropriate (as yet nonexistent) system.details field for this
    const override = target.actor?.flags?.ember?.warmBlooded;
    if ( typeof override === "boolean" ) return override;

    // If target is a Hero, default is detectable
    if ( target.actor?.type === "hero" ) return true;

    // Otherwise, check adversary creature category
    // TODO: Determine whether Thermal Vision should represent detection of heat-emitting creatures, or any creatures
    // with a variance in temperature. If the former, can remove this array & just check `=== "warm"`. If the latter,
    // should add "cold" to the `temps` array.
    const temps = ["warm"];
    return temps.includes(SYSTEM.ACTOR.CREATURE_CATEGORIES[target.actor.system.details.taxonomy?.category]?.warmBodied);
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
