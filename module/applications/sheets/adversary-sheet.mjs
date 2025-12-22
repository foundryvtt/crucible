import CrucibleBaseActorSheet from "./base-actor-sheet.mjs";

/**
 * A CrucibleBaseActorSheet subclass used to configure Actors of the "adversary" type.
 */
export default class AdversarySheet extends CrucibleBaseActorSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actor: {
      type: "adversary"
    },
    actions: {
      editArchetype: AdversarySheet.#onEditArchetype,
      editTaxonomy: AdversarySheet.#onEditTaxonomy,
      levelDecrease: AdversarySheet.#onLevelDecrease,
      levelIncrease: AdversarySheet.#onLevelIncrease
    }
  };

  static {
    this._initializeActorSheetClass();
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const {actor: a, source: s, incomplete: i} = context;
    const {threat, level} = a.system.advancement;

    // Expand Context
    Object.assign(context, {
      archetypeName: a.system.details.archetype?.name || game.i18n.localize("ARCHETYPE.SHEET.Choose"),
      taxonomyName: a.system.details.taxonomy?.name || game.i18n.localize("TAXONOMY.SHEET.CHOOSE"),
      canPurchaseTalents: false,
      threats: SYSTEM.THREAT_RANKS,
      threat: SYSTEM.THREAT_RANKS[threat],
      levelDisplay: this.#getLevelDisplay(level),
      canLevelUp: level < 24,
      canLevelDown: level > -5,
    });

    // Incomplete Tasks
    Object.assign(i, {
      taxonomy: !s.system.details.taxonomy?.name,
      archetype: !s.system.details.archetype?.name
    })
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Get the display string for the Adversary level.
   * @param {number} level    The true numerical level
   * @returns {string}        The displayed string level
   */
  #getLevelDisplay(level) {
    if ( level > 0 ) return String(level);
    if ( level === 0 ) return "0";
    return `1/${1 - level}`;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle click action to choose or edit the Archetype of this Adversary.
   * @this {AdversarySheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEditArchetype(event) {
    await this.actor._viewDetailItem("archetype", {editable: false});
  }

  /* -------------------------------------------- */

  /**
   * Handle click action to choose or edit the Taxonomy of this Adversary.
   * @this {AdversarySheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEditTaxonomy(event) {
    await this.actor._viewDetailItem("taxonomy", {editable: false});
  }

  /* -------------------------------------------- */

  /**
   * Handle click action to decrease the level of the Adversary.
   * @this {AdversarySheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onLevelDecrease(event) {
    const l = this.actor.system.advancement.level;
    let next;
    if ( l === 1 ) next = -1;
    else if ( l === -11 ) next = 0;
    else next = Math.max(l - 1, -11);
    return this.actor.update({"system.advancement.level": next});
  }

  /* -------------------------------------------- */

  /**
   * Handle click action to increase the level of the Adversary.
   * @this {AdversarySheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onLevelIncrease(event) {
    const l = this.actor.system.advancement.level;
    let next;
    if ( l === 0 ) next = -11;
    else if ( l === -1 ) next = 1;
    else next = Math.min(l + 1, 24);
    return this.actor.update({"system.advancement.level": next});
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return;
    switch (item.type) {
      case "ancestry":
        return this.actor.system.applyTaxonomy(item.system.toTaxonomy());
      case "archetype":
        return this.actor.system.applyArchetype(item);
      case "taxonomy":
        return this.actor.system.applyTaxonomy(item);
    }
    return super._onDropItem(event, item);
  }
}
