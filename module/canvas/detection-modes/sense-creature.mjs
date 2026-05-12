export default class DetectionModeSenseCreature extends foundry.canvas.perception.DetectionMode {

  /**
   * Glow colors for each rune.
   * @type {Readonly<Record<string, string>>}
   */
  static #GLOW_COLORS = Object.freeze({
    control: "#9647ff",
    death: "#a9ff81",
    earth: "#6ecb00",
    flame: "#ff6c00",
    frost: "#00faff",
    illumination: "#fff9bf",
    illusion: "#e21036",
    kinesis: "#d7d7d7",
    life: "#ff7190",
    lightning: "#ffb96c",
    oblivion: "#7a0b16",
    soul: "#029bff"
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

  /* -------------------------------------------- */

  /** @override */
  static getDetectionFilter() {
    const runeId = this.#pendingRune;
    this.#pendingRune = null;
    if ( !runeId ) return undefined;
    let filter = this.#filtersByRune.get(runeId);
    if ( !filter ) {
      const glowColor = [...Color.from(this.#GLOW_COLORS[runeId]).rgb, 1];
      filter = foundry.canvas.rendering.filters.GlowOverlayFilter.create({glowColor});
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
    const source = visionSource.object.document;
    const senseEffect = source.actor?.effects.get(SYSTEM.EFFECTS.getEffectId("sense"));
    const runeIds = senseEffect?.flags.crucible?.runes ?? source.actor?.flags.crucible?.senseRunes;
    if ( !runeIds?.length ) return false;
    const runeId = DetectionModeSenseCreature.#getTargetRune(target.actor);
    if ( !runeIds.includes(runeId) ) return false;
    DetectionModeSenseCreature.#pendingRune = runeId;
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Resolve the proper rune required to sense a target actor.
   * @param {CrucibleActor|null} actor
   */
  static #getTargetRune(actor) {
    if ( !actor ) return null;

    // TODO: Allow for overrides of rune per ancestry & taxonomy
    if ( actor.type === "hero" ) return SYSTEM.ACTOR.CREATURE_CATEGORIES.humanoid.sense;
    const taxonomy = actor.system.details?.taxonomy;
    if ( !taxonomy ) return null;
    return SYSTEM.ACTOR.CREATURE_CATEGORIES[taxonomy.category]?.sense;
  }
}
