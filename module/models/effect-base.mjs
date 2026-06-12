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
      magical: new fields.BooleanField(),
      maintenance: new fields.SchemaField({
        cost: new fields.NumberField({required: true, integer: true, nullable: false})
      }, {nullable: true, initial: null}),
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
    if ( origin ) tags.origin = origin.name;
    if ( effect.disabled ) tags.suspended = _loc("BASE_EFFECT.Suspended");
    if ( effect.isTemporary ) tags.duration = effect.duration.label;
    if ( this.magical ) tags.magical = _loc("BASE_EFFECT.Magical");
    if ( Number.isFinite(this.dc) ) tags.difficulty = _loc("BASE_EFFECT.Difficulty", {dc: this.dc});
    return tags;
  }
}
