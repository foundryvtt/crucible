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

    // Disallow turns- and months-unit durations
    if ( ["months", "turns"].includes(this.duration.units) ) {
      console.warn("The Crucible system does not support durations of unit \"turns\" or \"months\"!");
      return false;
    }

    // Set start combatant to targeted actor's combatant, if present. If turn start/end expiry, remove start turn and
    // adjust duration according to whether target combatant has yet acted this round
    if ( !(this.parent instanceof Actor) || !this.start?.combat.started || !["turnEnd", "turnStart"].includes(this.duration.expiry) ) return;
    const combatant = this.start.combat.getCombatantsByActor(this.parent)[0];
    if ( !combatant ) return;
    const effectUpdate = {start: {combatant: combatant.id, turn: null}};
    if ( this.duration.units === "rounds" ) {
      let decreaseDuration = combatant.turnNumber > this.start.combat.turn;
      if ( this.duration.expiry === "turnEnd" ) decreaseDuration ||= combatant.turnNumber === this.start.combat.turn;
      if ( decreaseDuration ) effectUpdate.duration = {value: this.duration.value - 1};
    }
    this.updateSource(effectUpdate);
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
    const {units, remaining, expiry} = this.duration;
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

    tags.activation.duration = this.duration.label;

    // Time-based duration
    if ( CONST.ACTIVE_EFFECT_TIME_DURATION_UNITS.includes(units) && Number.isFinite(remaining) ) {
      tags.context.section = "temporary";
      const s = Math.max(game.time.calendar.componentsToTime({[units.slice(0, -1)]: remaining}), 0);
      tags.context.t = s;
    }

    // Combat-based duration
    else if ( units === "rounds" && Number.isFinite(remaining) ) {
      tags.context.section = "temporary";
      const r = Math.max(remaining, 0);
      tags.context.t = SYSTEM.TIME.roundSeconds * r;
      const {combat, combatant} = this.start;
      if ( combat?.started && combat.combatants.has(combatant) ) {
        let addTurn = combat.combatants.get(combatant).turnNumber > combat.turn;
        if ( expiry === "turnEnd" ) addTurn ||= combat.combatant.id === combatant;
        const turnsRemaining = remaining + (addTurn ? 1 : 0);
        const pluralRule = game.i18n.pluralRules.select(turnsRemaining);
        tags.activation.duration = _loc(`EFFECT.DURATION.TURNS.${pluralRule}`, {turns: turnsRemaining});
      }
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
