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
      maintenance: new fields.SchemaField({
        cost: new fields.NumberField({required: false, integer: true, nullable: true, initial: null}),
        hands: new fields.NumberField({required: true, integer: true, nullable: false, min: 0, initial: 0})
      }),
      properties: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.EFFECTS.PROPERTIES})),
      regions: new fields.SetField(new fields.DocumentUUIDField({type: "Region", nullable: false})),
      summons: new fields.SetField(new fields.DocumentUUIDField({type: "Token", nullable: false}))
    });
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTIVE_EFFECT", "BASE_EFFECT"];

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    // An effect with no removal DC cannot be removed; represent that as an infinite difficulty
    if ( this.dc === null ) this.dc = Infinity;
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
    for ( const p of this.properties ) tags[p] = SYSTEM.EFFECTS.PROPERTIES[p]?.label ?? p;
    if ( Number.isFinite(this.dc) ) tags.difficulty = _loc("BASE_EFFECT.Difficulty", {dc: this.dc});
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Retrieve the action which caused the creation of this effect.
   * TODO: Once storing more complete action data, make this more robust; this is mainly a placeholder
   * @param {object} [options]
   * @param {CrucibleActionContext} [options.actionContext] Specific action context, if any
   * @returns {CrucibleAction|undefined}
   */
  getOriginAction({actionContext={}}={}) {
    const actor = fromUuidSync(this.parent.origin);
    if ( !(actor?.system instanceof crucible.api.models.CrucibleBaseActor) ) return;
    const actionId = this.parent.flags?.crucible?.originAction;
    if ( !actionId ) return;
    return actionId.startsWith("spell.")
      ? crucible.api.models.CrucibleSpellAction.fromId(actionId, {actor, ...actionContext})
      : actor.actions[actionId]?.clone({}, {actor, ...actionContext});
  }
}
