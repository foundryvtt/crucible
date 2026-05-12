export default class DetectionModeSenseCreature extends foundry.canvas.perception.DetectionMode {

  /**
   * Glow colors for each rune.
   * @type {Readonly<Record<string, [number, number, number, number]>>}
   */
  static #GLOW_COLORS = Object.freeze({
    control: [0.588, 0.278, 1.0, 1],
    death: [0.663, 1.0, 0.506, 1],
    earth: [0.431, 0.796, 0.0, 1],
    flame: [1.0, 0.424, 0.0, 1],
    frost: [0.0, 0.98, 1.0, 1],
    illumination: [1.0, 0.976, 0.749, 1],
    illusion: [0.886, 0.063, 0.212, 1],
    kinesis: [0.843, 0.843, 0.843, 1],
    life: [1.0, 0.443, 0.565, 1],
    lightning: [1.0, 0.725, 0.424, 1],
    oblivion: [0.478, 0.043, 0.086, 1],
    soul: [0.008, 0.608, 1.0, 1]
  });

  /**
   * Cached glow filters keyed by rune id.
   * @type {Map<string, foundry.canvas.rendering.filters.GlowOverlayFilter>}
   */
  static #filtersByRune = new Map();

  /**
   * The rune id of the most recently detected target. Set by `_canDetect` and consumed by `getDetectionFilter`,
   * which the visibility loop calls immediately after a successful `testVisibility`.
   * @type {string|null}
   */
  static #pendingRune = null;

  /**
   * Which creature categories can be seen by which rune id.
   * TODO: Determine whether this should live elsewhere. Maybe a reverse association from creature category to rune
   * @type {Record<string, string[]>}
   */
  static #creaturesByRune = {
    control: ["fiend"],
    death: ["undead"],
    earth: ["ooze", "elementalEarth"],
    flame: ["dragon", "elementalFire"],
    frost: ["giant", "elementalFrost"],
    illumination: ["celestial"],
    illusion: ["fey"],
    kinesis: ["monstrosity"],
    life: ["plant", "beast"],
    lightning: ["construct", "elementalStorm"],
    oblivion: ["outsider"],
    soul: ["humanoid"]
  };

  /* -------------------------------------------- */

  /** @override */
  static getDetectionFilter() {
    const runeId = this.#pendingRune;
    this.#pendingRune = null;
    if ( !runeId ) return undefined;
    let filter = this.#filtersByRune.get(runeId);
    if ( !filter ) {
      filter = foundry.canvas.rendering.filters.GlowOverlayFilter.create({glowColor: this.#GLOW_COLORS[runeId]});
      this.#filtersByRune.set(runeId, filter);
    }
    return filter;
  }

  /* -------------------------------------------- */

  /** @override */
  _canDetect(visionSource, target) {

    // Sense only works on creatures (for our purposes)
    if ( !(target instanceof foundry.canvas.placeables.Token) ) return false;

    // Check which rune is in use
    // TODO: Determine the ideal way of storing this info
    const source = visionSource.object.document;
    const senseEffectId = SYSTEM.EFFECTS.getEffectId("sense");
    const senseEffect = source.actor?.effects.get(senseEffectId);
    const runeId = senseEffect?.flags.crucible?.senseRune ?? source.actor?.flags.crucible?.senseRune;
    if ( !runeId ) return false;
    const targetCategory = target.actor?.system.details?.taxonomy?.category ?? "humanoid";
    if ( !DetectionModeSenseCreature.#creaturesByRune[runeId].includes(targetCategory) ) return false;
    DetectionModeSenseCreature.#pendingRune = runeId;
    return true;
  }
}
