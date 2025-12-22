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
  /*              Database Workflows              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    const updates = {};

    // Default document type should be our CrucibleBaseActiveEffect
    if ( (data.type ?? "base") === "base" ) {
      updates.type = "crucible";

      // TODO: Update this in v14
      updates["==system"] = data.system ?? {};
    };
    this.updateSource(updates);
  }
}
