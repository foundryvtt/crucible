import { SYSTEM } from "../config/system.js";

/**
 * The ActorSheet class which is used to display an Adversary Actor.
 */
export default class AdversarySheet extends ActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 760,
      height: 760,
      classes: [SYSTEM.id, "sheet", "actor", "adversary"],
      template: `systems/${SYSTEM.id}/templates/sheets/adversary.hbs`,
      resizable: false,
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes"}],
      scrollY: []
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    context.systemData = context.data.system;

    // Abilities
    context.abilityScores = this._formatAbilities(this.actor.system.abilities);

    // Resources
    context.resources = this._formatResources(this.actor.system.resources);

    // Resistances
    context.resistances = this._formatResistances(this.actor.system.resistances);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Format ability scores for display on the Actor sheet.
   * @param {object} abilities
   * @return {object[]}
   * @private
   */
  _formatAbilities(abilities) {
    return Object.entries(SYSTEM.ABILITIES).map(e => {
      let [a, ability] = e;
      const attr = foundry.utils.deepClone(ability);
      attr.id = a;
      attr.value = abilities[a].value;
      return attr;
    });
  }

  /* -------------------------------------------- */

  /**
   * Format the display of resource attributes on the actor sheet
   * @param {object} resources       The ActorData.system.resources object
   * @private
   */
  _formatResources(resources) {
    return Object.entries(resources).map(([id, resource]) => {
      const r = foundry.utils.mergeObject(SYSTEM.RESOURCES[id], resource, {inplace: false});
      r.id = id;
      r.pct = Math.round(r.value * 100 / r.max);

      // Determine resource bar color
      const p = r.pct / 100;
      const c0 = r.color.low.rgb;
      const c1 = r.color.high.rgb;
      const bg = c0.map(c => c * 0.25 * 255);
      const fill = c1.map((c, i) => ((c * p) + (c0[i] * (1-p))) * 255);
      r.color.bg = `rgb(${bg.join(",")})`;
      r.color.fill = `rgb(${fill.join(",")})`;
      return r;
    });
  }

  /* -------------------------------------------- */

  /**
   * Organize resistances data for rendering
   * @param {object} resistances    The Actor's resistances data
   * @return {object}               Resistances data organized by category
   * @private
   */
  _formatResistances(resistances) {
    const categories = foundry.utils.deepClone(SYSTEM.DAMAGE_CATEGORIES);
    return Object.entries(resistances).reduce((categories, e) => {

      // Merge resistance data for rendering
      let [id, r] = e;
      const resist = foundry.utils.mergeObject(r, SYSTEM.DAMAGE_TYPES[id]);

      // Add the resistance to its category
      const cat = categories[resist.type];
      cat.resists = cat.resists || {};
      cat.resists[id] = resist;
      return categories;
    }, categories);
  }
}
