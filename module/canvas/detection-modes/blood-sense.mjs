/**
 * A custom DetectionMode for perceiving blooded creatures that are wounded.
 */
export default class DetectionModeBloodSense extends foundry.canvas.perception.DetectionMode {
  constructor() {
    super({
      id: "bloodSense",
      label: "DETECTION_MODES.BloodSense",
      type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.OTHER,
      walls: false
    });
  }

  /** @override */
  static getDetectionFilter() {
    return this._detectionFilter ??= foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
      outlineColor: [0.6, 0, 0, 1],
      knockout: true,
      wave: false
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _canDetect(visionSource, target) {

    // Blood sense only works on creatures
    if ( !(target instanceof foundry.canvas.placeables.Token) ) return false;
    const source = visionSource.object.document;

    // Cannot smell blood if burrowing, or if target is burrowing
    if ( source.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    if ( target.document.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;

    // If actor has no health attribute, allow detection
    const health = target.actor?.resources?.health;
    if ( !health ) return true;

    // If creature does not have blood, cannot detect
    const detailType = (target.actor.type === "hero") ? "ancestry" : "taxonomy";
    if ( !target.actor.system.details?.[detailType]?.characteristics?.blooded ) return false;

    // Otherwise, allow if any health is missing
    return health.value < health.max;
  }
}
