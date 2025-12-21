/**
 * An active effect subclass which handles system specific logic for active effects.
 */
export default class CrucibleActiveEffect extends foundry.documents.ActiveEffect {
  /**
   * The Handlebars template used to render this ActiveEffect as a line item for tooltips or as a partial.
   * @type {string}
   */
  static TOOLTIP_TEMPLATE = "systems/crucible/templates/tooltips/tooltip-active-effect.hbs";

  /* -------------------------------------------- */

  /**
   * Render this ActiveEffect as HTML for a tooltip card.
   * @returns {Promise<string>}
   */
  async renderCard() {
    await foundry.applications.handlebars.loadTemplates([this.constructor.TOOLTIP_TEMPLATE]);
    return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_TEMPLATE, {
      effect: this,
      tags: this.getTags()
    });
  }

  /* -------------------------------------------- */

  /**
   * Obtain an object of tags which describe the Effect.
   * @returns {EffectTags}
   */
  getTags() {
    const {startRound, rounds, turns} = this.duration;
    const elapsed = game.combat ? game.combat.round - startRound : 0;
    const pluralRules = new Intl.PluralRules(game.i18n.lang);
    const tags = {
      context: {section: "persistent"},
      activation: {}
    };
    // Status tooltip tags
    tags.statuses = this.statuses.reduce((obj, conditionId) => {
      const cfg = CONFIG.statusEffects.find(c => c.id === conditionId);
      if (cfg) obj[conditionId] = game.i18n.localize(cfg.name);
      return obj;
    }, {});

    // Turn-based duration
    if (Number.isFinite(turns)) {
      tags.context.section = "temporary";
      const remaining = turns - elapsed;
      tags.context.t = remaining;
      tags.activation.duration = `${remaining} ${game.i18n.localize(`COMBAT.DURATION.TURNS.${pluralRules.select(remaining)}`)}`;
    }

    // Round-based duration
    else if (Number.isFinite(rounds)) {
      tags.context.section = "temporary";
      const remaining = rounds - elapsed;
      tags.context.t = 1000000 * remaining;
      tags.activation.duration = `${remaining} ${game.i18n.localize(`COMBAT.DURATION.ROUNDS.${pluralRules.select(remaining)}`)}`;
    }

    // Persistent
    else {
      tags.context.t = Infinity;
      tags.activation.duration = "∞";
    }

    // Disabled Effects
    if ( this.disabled ) tags.context.section = "disabled";
    return tags;
  }

  /* -------------------------------------------- */

  /** inheritDoc */
  static migrateData(source) {
    if ( source.type === "base" ) {
      if ( source._id === SYSTEM.EFFECTS.getEffectId("flanked") ) source.type = "flanked";
      else source.type = "crucible";
      const crucibleFlags = source.flags.crucible ?? {};
      const migrationMap = {
        maintainedCost: "system.maintenance.cost",
        summons: "system.summons",
        engagedEnemies: "system.engagement.enemies",
        engagedAllies: "system.engagement.allies",
        flanked: "system.engagement.flanked"
      };
      for ( const [oldProperty, newProperty] of Object.entries(migrationMap)) {
        if ( !(oldProperty in crucibleFlags) ) continue;
        if ( oldProperty === "flanked" ) source.type = "flanked";
        foundry.utils.setProperty(source, newProperty, crucibleFlags[oldProperty]);
        delete crucibleFlags[oldProperty];
      }
      if ( crucibleFlags.dot ) {
        let dot = [];
        for ( const resource of ["health", "morale"] ) {
          if ( !(resource in crucibleFlags.dot) ) continue;
          const amount = crucibleFlags.dot[resource];
          if ( amount > 0 ) {
            dot.push({
              amount,
              damageType: crucibleFlags.dot.damageType,
              resource
            });
          } else {
            dot.push({
              amount: -amount,
              resource,
              restoration: true
            });
          }
        }
        foundry.utils.setProperty(source, "system.dot", dot);
        delete crucibleFlags.dot;
      }
      if ( foundry.utils.isEmpty(crucibleFlags) ) delete source.flags.crucible;
    }
    return super.migrateData(source);
  }
}
