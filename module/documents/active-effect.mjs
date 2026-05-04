import CrucibleItem from "./item.mjs";
import {getEffectId} from "../const/effects.mjs";

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
  static async _fromStatusEffect(statusId, effectData, options) {
    const status = CONFIG.statusEffects[statusId];
    if ( status?.generator ) {
      foundry.utils.mergeObject(effectData, status.generator(), {overwrite: true});
      effectData.duration = {};
    }
    effectData._id = getEffectId(`Toggled ${statusId}`); // Unique effect _id for toggled statuses
    return super._fromStatusEffect(statusId, effectData, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDelete(options, userId) {
    await super._onDelete(options, userId);
    if ( !game.user.isActiveGM ) return;
    if ( this.system.regions ) {
      for ( const uuid of this.system.regions ) {
        const region = await fromUuid(uuid);
        if ( region ) await region.delete();
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;

    // Affix effects specifically
    if ( this.type === "affix" ) {
      if ( !this.parent ) return; // Compendium-level AE, no parent restrictions
      if ( !(this.parent instanceof foundry.documents.Item) ) {
        console.warn("Affix effects can only be applied to Item documents.");
        return false;
      }
      this.updateSource({duration: {value: null}});
      options.keepId = true;
      return;
    }

    if ( ["months", "turns"].includes(this.duration.units) ) {
      console.warn("The Crucible system does not support effect durations of unit \"turns\" or \"months\"!");
      return false;
    }
    if ( !(this.parent instanceof foundry.documents.Actor) || !this.start?.combat?.started ) return;

    // Set start combatant to targeted actor's combatant, if present.
    // Adjust the duration of round-based effects depending on the current turn order.
    // If the target combatant has not acted yet (or is currently acting) we may need to decrease the duration.
    const effectUpdate = {};
    const combat = this.start.combat;
    const combatant = combat.getCombatantsByActor(this.parent)[0];
    if ( combatant && (combatant.turnNumber !== null) ) {
      effectUpdate.start = {combatant: combatant.id};
      const {units, value, expiry} = this.duration;
      if ( (units === "rounds") && ["turnStart", "turnEnd"].includes(expiry) ) {
        const isTurn = combatant.turnNumber === this.start.combat.turn;
        const upcoming = combatant.turnNumber > this.start.combat.turn;
        const decreaseDuration = upcoming || ((expiry === "turnEnd") && isTurn);
        if ( decreaseDuration ) effectUpdate.duration = {value: value-1};

      }
    }
    this.updateSource(effectUpdate);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if ( allowed === false ) return false;

    // Affix effects specifically
    if ( this.type === "affix" ) {
      if ( ("system" in changes) && ("identifier" in changes.system)
        && (changes.system.identifier !== this.system.identifier) ) {
        console.warn("The identifier of an existing affix cannot be changed.");
        return false;
      }
      if ( "duration" in changes ) changes.duration = {value: null};
    }
  }

  /* -------------------------------------------- */

  /**
   * Pre-create operation for ActiveEffects. Validates the proposed affix composition on the parent Item.
   * TODO: https://github.com/foundryvtt/foundryvtt/issues/14133 - consolidate to CrucibleItem.validateJoint
   * @override
   */
  static async _preCreateOperation(documents, operation, user) {
    const allowed = await super._preCreateOperation(documents, operation, user);
    if ( allowed === false ) return false;
    const parent = operation.parent;
    if ( !(parent instanceof foundry.documents.Item) || !parent.system.constructor.AFFIXABLE ) return;
    const hasAffixes = documents.some(d => d.type === "affix");
    if ( !hasAffixes ) return;
    const source = parent.toObject();
    for ( const doc of documents ) {
      if ( doc.type === "affix" ) source.effects.push(doc.toObject());
    }
    try {
      CrucibleItem.validateJoint(source);
    } catch(err) {
      ui.notifications.warn(err.message);
      return false;
    }
  }

  /* -------------------------------------------- */

  /**
   * Pre-update operation for ActiveEffects. Validates the proposed affix composition on the parent Item.
   * TODO: https://github.com/foundryvtt/foundryvtt/issues/14133 - consolidate to CrucibleItem.validateJoint
   * @override
   */
  static async _preUpdateOperation(documents, operation, user) {
    const allowed = await super._preUpdateOperation(documents, operation, user);
    if ( allowed === false ) return false;
    const parent = operation.parent;
    if ( !(parent instanceof foundry.documents.Item) || !parent.system.constructor.AFFIXABLE ) return;
    const hasAffixes = documents.some(d => d.type === "affix");
    if ( !hasAffixes ) return;
    const source = parent.toObject();
    for ( const update of (operation.updates ?? []) ) {
      const idx = source.effects.findIndex(e => e._id === update._id);
      if ( idx >= 0 ) foundry.utils.mergeObject(source.effects[idx], update);
    }
    try {
      CrucibleItem.validateJoint(source);
    } catch(err) {
      ui.notifications.warn(err.message);
      return false;
    }
  }

  /* -------------------------------------------- */

  /**
   * Render this ActiveEffect as HTML for a tooltip card.
   * @returns {Promise<string>}
   */
  async renderCard() {
    await foundry.applications.handlebars.loadTemplates([this.constructor.TOOLTIP_TEMPLATE]);
    const descriptionHTML = await CONFIG.ux.TextEditor.enrichHTML(this.description, {relativeTo: this});
    return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_TEMPLATE, {
      effect: this,
      descriptionHTML,
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
   * @returns {ActionTags}
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
      tags.context.t = Math.max(game.time.calendar.componentsToTime({[units.slice(0, -1)]: remaining}), 0);
    }

    // Combat-based duration
    else if ( (units === "rounds") && Number.isFinite(remaining) ) {
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
