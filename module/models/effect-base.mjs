/**
 * @import CrucibleAction from "./action.mjs";
 * @import {CrucibleActionContext} from "./action.mjs";
 */

/**
 * Active Effect subtype containing crucible-specific system schema.
 */
export default class CrucibleBaseActiveEffect extends foundry.data.ActiveEffectTypeDataModel {

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    return Object.assign(schema, {
      dc: new fields.NumberField({required: false, integer: true, nullable: true, initial: null}),
      dot: new fields.ArrayField(new fields.SchemaField({
        amount: new fields.NumberField({required: true, integer: true, nullable: false, positive: true}),
        damageType: new fields.StringField({required: false, choices: SYSTEM.DAMAGE_TYPES, nullable: false}),
        resource: new fields.StringField({required: true, choices: SYSTEM.RESOURCES, nullable: false}),
        restoration: new fields.BooleanField()
      }), {nullable: false, initial: []}),
      lights: new fields.SetField(new fields.DocumentUUIDField({type: "AmbientLight", nullable: false})),
      maintenance: new fields.SchemaField({
        cost: new fields.NumberField({required: false, integer: true, nullable: true, min: 1, initial: null}),
        hands: new fields.NumberField({required: true, integer: true, nullable: false, min: 0, max: 2, initial: 0})
      }),
      properties: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.EFFECTS.PROPERTIES})),
      regions: new fields.SetField(new fields.DocumentUUIDField({type: "Region", nullable: false})),
      summons: new fields.SetField(new fields.DocumentUUIDField({type: "Token", nullable: false})),
      suppression: new fields.TypedObjectField(new fields.BooleanField())
    });
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTIVE_EFFECT", "BASE_EFFECT"];

  /* -------------------------------------------- */

  /**
   * Is this effect suppressed for any recorded reason? Read by {@link foundry.documents.ActiveEffect#isSuppressed}.
   * Returns undefined rather than false so that core falls back to duration expiry.
   * @type {true|undefined}
   */
  get isSuppressed() {
    return Object.values(this.suppression).some(Boolean) || undefined;
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    // An effect which is not removable, or has no removal DC, cannot be removed; represent that as infinite difficulty
    if ( !this.properties.has("removable") || (this.dc === null) ) this.dc = Infinity;
  }


  /* -------------------------------------------- */

  /**
   * Descriptive tags rendered on the effect sheet header.
   * @returns {Record<string, string>}
   */
  getTags() {
    const effect = this.parent;
    const tags = {};
    const origin = effect.origin ? fromUuidSync(effect.origin) : null;
    if ( origin && (origin !== effect.parent) ) tags.origin = origin.name;
    if ( effect.disabled ) tags.suspended = _loc("BASE_EFFECT.Suspended");
    if ( effect.isTemporary ) tags.duration = Number.isFinite(effect.duration.value) ? effect.duration.label : "∞";
    for ( const s of effect.statuses ) {
      tags[s] = {label: _loc(CONFIG.statusEffects[s]?.name ?? s), tooltipType: "condition", dataset: {condition: s}};
    }
    this.dot.forEach((d, i) => {
      const label = d.damageType ? SYSTEM.DAMAGE_TYPES[d.damageType]?.label : SYSTEM.RESOURCES[d.resource]?.label;
      tags[`dot${i}`] = `${d.restoration ? "+" : ""}${d.amount} ${label}`;
    });
    for ( const p of this.properties ) {
      if ( p !== "removable" ) tags[p] = SYSTEM.EFFECTS.PROPERTIES[p]?.label ?? p; // The difficulty tag stands in
    }
    for ( const [reason, suppressed] of Object.entries(this.suppression) ) {
      if ( !suppressed ) continue;
      const key = (reason === "maintenance") ? "maintained" : `suppression.${reason}`; // Due replaces Maintained
      tags[key] = SYSTEM.EFFECTS.SUPPRESSION_REASONS[reason]?.label ?? reason;
    }
    if ( Number.isFinite(this.dc) ) tags.difficulty = _loc("BASE_EFFECT.Difficulty", {dc: this.dc});
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Construct the action which pays this effect's maintenance Focus cost.
   * @returns {CrucibleAction|null}     The action, or null if this effect is not maintained by an Actor
   */
  getMaintainAction() {
    const effect = this.parent;
    if ( !(effect.parent instanceof Actor) || !this.properties.has("maintained") ) return null;
    return new crucible.api.models.CrucibleAction({
      id: "maintain",
      name: _loc("BASE_EFFECT.ACTIONS.MaintainName", {effect: effect.name}),
      img: effect.img,
      cost: {action: 0},
      description: _loc("BASE_EFFECT.ACTIONS.MaintainDetail", {effect: effect.name}),
      target: {type: "self", scope: 1}
    }, {actor: effect.parent, usage: {maintainedEffectId: effect.id}});
  }

  /* -------------------------------------------- */

  /**
   * Retrieve the action which caused the creation of this effect.
   * TODO: Once storing more complete action data, make this more robust; this is mainly a placeholder proof of concept
   * @param {object} [options]                              Options which configure action reconstruction
   * @param {CrucibleActionContext} [options.actionContext] Specific action context, if any
   * @returns {CrucibleAction|undefined}
   */
  getOriginAction({actionContext={}}={}) {
    const actionId = this.parent.flags?.crucible?.originAction;
    if ( !actionId ) return;
    const actor = fromUuidSync(this.parent.origin);
    if ( !(actor?.system instanceof crucible.api.models.CrucibleBaseActor) ) return;
    // Construct lazily so the clone does not share live usage, then prepare explicitly
    const context = {actor, lazy: true, ...actionContext};
    const action = actionId.startsWith("spell.")
      ? crucible.api.models.CrucibleSpellAction.fromId(actionId, context)
      : actor.actions[actionId]?.clone({}, context);
    action?.prepare();
    return action;
  }
}
