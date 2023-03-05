import CrucibleActorSheet from "./actor.mjs";
import ArchetypeConfig from "../config/archetype.mjs";
import TaxonomyConfig from "../config/taxonomy.mjs";

/**
 * The ActorSheet class which is used to display an Adversary Actor.
 */
export default class AdversarySheet extends CrucibleActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 720,
      height: 640,
    });
  }

  /** @override */
  static actorType = "adversary";

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    const {actor: a, source: s} = context;

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
    context.canLevelUp = a.system.details.level < 24;
    context.canLevelDown = a.system.details.level > 0;
    return context;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onClickControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    switch ( a.dataset.action ) {
      case "configureArchetype":
        new ArchetypeConfig(this.actor.system.details.archetype).render(true);
        break;
      case "configureTaxonomy":
        new TaxonomyConfig(this.actor.system.details.taxonomy).render(true);
        break;
      case "levelIncrease":
        await this.actor.update({
          "system.details.level": Math.clamped(this.actor.system.details.level + 1, 0, 24)
        });
        break;
      case "levelDecrease":
        await this.actor.update({
          "system.details.level": Math.clamped(this.actor.system.details.level - 1, 0, 24)
        });
        break;
    }
    return super._onClickControl(event);
  }
}
