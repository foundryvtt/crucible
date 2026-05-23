export default class DetectionModeEcholocation extends foundry.canvas.perception.DetectionMode {
  constructor() {
    super({
      id: "echolocation",
      label: "DETECTION_MODES.Echolocation",
      type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SOUND,
      walls: true,
      angle: false
    });
  }

  /** @override */
  static getDetectionFilter() {
    return this._detectionFilter ??= foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
      outlineColor: [1, 1, 0, 1],
      knockout: true,
      wave: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _canDetect(visionSource, target) {

    // Echolocation only works on creatures
    if ( !(target instanceof foundry.canvas.placeables.Token) ) return false;
    const source = visionSource.object.document;

    // Cannot use echolocation if deafened
    if ( source.hasStatusEffect("deafened") ) return false;

    // If constrained by walls, cannot see if either source or target is burrowing
    if ( this.walls ) {
      if ( source.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
      if ( target.document.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    }
    return true;
  }
}
