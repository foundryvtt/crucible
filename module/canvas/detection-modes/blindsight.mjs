/**
 * A custom DetectionMode for perceiving creatures and objects within 60 feet without sight.
 */
export default class DetectionModeBlindsight extends foundry.canvas.perception.DetectionMode {
  constructor() {
    super({
      id: "blindsight",
      label: "DETECTION_MODES.Blindsight",
      type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.OTHER,
      walls: true,
      angle: false
    });
  }

  /** @override */
  static getDetectionFilter() {
    return this._detectionFilter ??= foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
      outlineColor: [1, 1, 1, 1],
      knockout: true,
      wave: false
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _canDetect(visionSource, target) {
    if ( !(target instanceof foundry.canvas.placeables.Token) ) return false;
    const source = visionSource.object.document;
    if ( this.walls ) {
      if ( source.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
      if ( target.document.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    }
    return true;
  }
}
