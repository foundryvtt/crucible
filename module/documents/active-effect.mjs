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

  /** @inheritDoc */
  get isSuppressed() {
    if ( super.isSuppressed ) return true;
    if ( (this.parent instanceof crucible.api.documents.CrucibleItem)
      && this.parent.activeEffectsSuppressed ) return true;
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Obtain an object of tags which describe the Effect.
   * @returns {EffectTags}
   */
  getTags() {
    const {startRound, rounds, turns, seconds} = this.duration;
    const elapsed = game.combat ? game.combat.round - startRound : 0;
    const pluralRules = new Intl.PluralRules(game.i18n.lang);
    const tags = {
      context: {section: "persistent"},
      activation: {}
    };
    // Status tooltip tags
    tags.statuses = this.statuses.reduce((obj, conditionId) => {
      const cfg = CONFIG.statusEffects[conditionId];
      if (cfg) obj[conditionId] = _loc(cfg.name);
      return obj;
    }, {});

    // Time-based duration
    if ( Number.isFinite(seconds) ) {
      tags.context.section = "temporary";
      const s = Math.max(this.duration.remaining, 0);
      tags.context.t = s;
      // Use the calendar "ago" formatter, little hacky should ideally have a custom forward-looking formatter
      tags.activation.duration = game.time.earthCalendar.format(s, "ago").replace(" ago", "");
    }

    // Turn-based duration
    else if (Number.isFinite(turns)) {
      tags.context.section = "temporary";
      const remaining = turns - elapsed;
      tags.context.t = 10 * remaining;
      tags.activation.duration = `${remaining} ${_loc(`COMBAT.DURATION.TURNS.${pluralRules.select(remaining)}`)}`;
    }

    // Round-based duration
    else if (Number.isFinite(rounds)) {
      tags.context.section = "temporary";
      const remaining = rounds - elapsed;
      tags.context.t = 1000000 * remaining;
      tags.activation.duration = `${remaining} ${_loc(`COMBAT.DURATION.ROUNDS.${pluralRules.select(remaining)}`)}`;
    }

    // Persistent
    else {
      tags.context.t = Infinity;
      tags.activation.duration = "∞";
    }

    // Transfer
    if ( this.parent instanceof Item ) tags.activation.origin = this.parent.name;

    // Disabled Effects
    if ( this.disabled ) tags.context.section = "disabled";

    // Suppressed Effects
    if ( this.isSuppressed ) tags.context.section = "suppressed";
    return tags;
  }
}
