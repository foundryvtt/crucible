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

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;

    // Set start combatant to targeted actor's combatant, if present. If turn start/end expiry, remove start turn and
    // adjust duration according to whether target combatant has yet acted this round
    if ( this.parent instanceof Actor && this.start?.combat.started && ["turnStart", "turnEnd"].includes(this.duration.expiry) ) {
      const combatant = this.start.combat.getCombatantsByActor(this.parent)[0];
      if ( combatant ) {
        const effectUpdate = {start: {combatant: combatant.id, turn: null}};
        if ( this.duration.units === "rounds" ) {
          const combatantHasGone = combatant.turnNumber < this.start.combat.turn;
          switch ( this.duration.expiry ) {
            case "turnStart":
              if ( combatantHasGone ) effectUpdate.duration = {value: this.duration.value + 1};
              break;
            case "turnEnd":
              if ( !combatantHasGone ) effectUpdate.duration = {value: this.duration.value - 1};
              break;
          }
        }
        this.updateSource(effectUpdate);
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  isExpiryEvent(event, context) {
    if ( event !== "turnEnd" || event !== this.duration.expiry ) return super.isExpiryEvent(event, context);
    const combat = context.combat ?? game.combat;
    if ( !combat?.started ) return false;
    const combatantId = combat === this.start.combat
      ? this.start.combatant
      : combat.getCombatantsByActor(this.actor ?? "")[0]?.id;
    return combat.previous.combatantId === combatantId;
  }

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
    const {units, expiry, remaining} = this.duration;
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


    // TODO: Temporary, clean up prior to actual PR
    tags.activation.duration = this.duration.label;

    // Time-based duration
    if ( (units === "seconds") && Number.isFinite(remaining) ) {
      tags.context.section = "temporary";
      const s = Math.max(remaining, 0);
      tags.context.t = s;
      // Use the calendar "ago" formatter, little hacky should ideally have a custom forward-looking formatter
      // tags.activation.duration = game.time.earthCalendar.format(s, "ago").replace(" ago", "");
    }

    // Combat-based duration
    else if ( (units === "rounds") && Number.isFinite(remaining) ) {
      tags.context.section = "temporary";
      const r = Math.max(remaining, 0);
      tags.context.t = 10 * r;
      // const locKey = expiry === "turnEnd" ? "EFFECT.DURATION.TURNS" : "EFFECT.DURATION.ROUNDS";
      // tags.activation.duration = `${r} ${_loc(`${locKey}.${pluralRules.select(r)}`)}`;
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
