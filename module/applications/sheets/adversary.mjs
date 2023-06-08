import CrucibleActorSheet from "./actor.mjs";

/**
 * The ActorSheet class which is used to display an Adversary Actor.
 */
export default class AdversarySheet extends CrucibleActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 700,
      height: 680,
    });
  }

  /** @override */
  static actorType = "adversary";

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    const {actor: a, source: s} = context;

    // Equipment
    context.displayMainhand = true;
    context.displayOffhand = false;

    // Taxonomy
    context.incomplete.taxonomy = !s.system.details.taxonomy?.name;
    context.taxonomyName = a.system.details.taxonomy?.name || game.i18n.localize("TAXONOMY.Configure");

    // Archetype
    context.incomplete.archetype = !s.system.details.archetype?.name
    context.archetypeName = a.system.details.archetype?.name || game.i18n.localize("ARCHETYPE.Configure");

    // Level and Threat
    context.threats = CONFIG.SYSTEM.THREAT_LEVELS;
    context.statures = CONFIG.SYSTEM.CREATURE_STATURES;
    context.threat = context.threats[a.system.details.threat];
    context.levelDisplay = this.#getLevelDisplay(a.system.details.level);
    context.canLevelUp = a.system.details.level < 24;
    context.canLevelDown = a.system.details.level > -12;
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareFeaturedEquipment() {
    const featuredEquipment = super._prepareFeaturedEquipment();
    if ( !this.actor.equipment.weapons.mainhand.id ) featuredEquipment.shift();
    return featuredEquipment;
  }

  /* -------------------------------------------- */

  #getLevelDisplay(level) {
    if ( level > 0 ) return String(level);
    if ( level === 0 ) return "0";
    return `1/${1 - level}`;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onClickControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    switch ( a.dataset.action ) {
      case "viewArchetype":
        return this.actor._viewDetailItem("archetype", {editable: true});
      case "viewTaxonomy":
        return this.actor._viewDetailItem("taxonomy", {editable: true});
      case "levelIncrease":
        return this.#levelUp();
      case "levelDecrease":
        return this.#levelDown();
    }
    return super._onClickControl(event);
  }

  /* -------------------------------------------- */

  #levelUp() {
    const l = this.actor.system.details.level;
    let next;
    if ( l === 0 ) next = -11;
    else if ( l === -1 ) next = 1;
    else next = Math.min(l + 1, 24);
    return this.actor.update({"system.details.level": next});
  }

  /* -------------------------------------------- */

  #levelDown() {
    const l = this.actor.system.details.level;
    let next;
    if ( l === 1 ) next = -1;
    else if ( l === -11 ) next = 0;
    else next = Math.max(l - 1, -11);
    return this.actor.update({"system.details.level": next});
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropItemCreate(itemData) {
    switch (itemData.type) {
      case "archetype":
        return this.actor.system.applyArchetype(itemData);
      case "taxonomy":
        return this.actor.system.applyTaxonomy(itemData);
    }
    return super._onDropItemCreate(itemData);
  }
}
