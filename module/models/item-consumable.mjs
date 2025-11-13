import CruciblePhysicalItem from "./item-physical.mjs";
import * as CONSUMABLE from "../const/consumable.mjs";

/**
 * Data schema, attributes, and methods specific to "consumable" type Items.
 */
export default class CrucibleConsumableItem extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = CONSUMABLE.CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "flask";

  /** @override */
  static ITEM_PROPERTIES = CONSUMABLE.PROPERTIES;

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "CONSUMABLE"];

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    delete schema.actorHooks; // Consumables don't provide actor hooks
    const fields = foundry.data.fields;
    return foundry.utils.mergeObject(schema, {
      uses: new fields.SchemaField({
        value: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 1}),
        max: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, initial: 1})
      })
    });
  }

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Is this consumable or consumable stack depleted?
   * @type {boolean}
   */
  get isDepleted() {
    return !this.uses.value || !this.quantity;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Consume a certain number of uses of the consumable.
   * @param {number} [uses=1]           A number of uses to consume. A negative number will restore uses of the item
   * @returns {Promise<CrucibleItem>}   The updated item
   */
  async consume(uses=1) {
    let {value, max} = this.uses;
    let quantity = this.quantity;
    const currentUses = (max * (quantity - 1)) + value;
    const newUses = Math.max(currentUses - uses, 0);
    const targetQuantity = this.properties.has("stackable") ? Math.ceil(newUses / max) : 1;
    const targetUses = Math.clamp(newUses - (max * (targetQuantity - 1)), 0, max);
    await this.parent.update({system: {quantity: targetQuantity, uses: {value: targetUses}}});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getTags(scope="full") {
    const {category, ...parentTags} = super.getTags(scope);
    const tags = {
      category,
      quality: this.config.quality.label,
      ...parentTags
    };
    if ( this.isDepleted ) tags.uses = "Depleted";
    else {
      const {value, max} = this.uses;
      const plurals = new Intl.PluralRules(game.i18n.lang);
      const usesLabel = {one: "Use", other: "Uses"}[plurals.select(max)];
      tags.uses = value === max ? `${value} ${usesLabel}` : `${value}/${max} ${usesLabel}`;
    }
    return tags;
  }
}
