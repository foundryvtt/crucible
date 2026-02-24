import {SYSTEM} from "../const/system.mjs";
import * as crucibleFields from "./fields.mjs";
import CrucibleAffixData from "./item-affix.mjs";

/**
 * @import {CrucibleItemCategory, ItemProperty} from "../const/items.mjs";
 */

/**
 * A data structure which is shared by all physical items.
 */
export default class CruciblePhysicalItem extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      identifier: new crucibleFields.ItemIdentifierField(),
      category: new fields.StringField({required: true, choices: this.ITEM_CATEGORIES, initial: this.DEFAULT_CATEGORY}),
      quantity: new fields.NumberField({required: true, nullable: false, integer: true, initial: 1, min: 0}),
      weight: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0, min: 0}),
      price: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0, min: 0}),
      quality: new fields.StringField({required: true, choices: SYSTEM.ITEM.QUALITY_TIERS, initial: "standard"}),
      broken: new fields.BooleanField({initial: false}),
      enchantment: new fields.StringField({required: true, choices: SYSTEM.ITEM.ENCHANTMENT_TIERS, initial: "mundane"}),
      equipped: new fields.BooleanField(),
      invested: new fields.BooleanField(),
      properties: new fields.SetField(new fields.StringField({required: true, choices: this.ITEM_PROPERTIES})),
      description: new fields.SchemaField({
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      }),
      actions: new fields.ArrayField(new crucibleFields.CrucibleActionField()),
      actorHooks: new crucibleFields.ItemActorHooks(),
      affixes: new fields.ArrayField(new fields.EmbeddedDataField(CrucibleAffixData))
    };
  }

  /**
   * Allowed categories for this item type.
   * @type {Record<string, CrucibleItemCategory>}
   */
  static ITEM_CATEGORIES = {};

  /**
   * The default category for new items of this type
   * @type {string}
   */
  static DEFAULT_CATEGORY = "";

  /**
   * Define the set of property tags which can be applied to this item type.
   * @type {Record<string, ItemProperty>}
   */
  static ITEM_PROPERTIES = {};

  /**
   * The Handlebars template used to render this item as a line item for tooltips or as a partial.
   * @type {string}
   */
  static TOOLTIP_TEMPLATE = "systems/crucible/templates/tooltips/tooltip-physical.hbs";

  /**
   * Is this item type equipable?
   * @type {boolean}
   */
  static EQUIPABLE = true;

  /**
   * Does this item type support embedded affixes?
   * @type {boolean}
   */
  static AFFIXABLE = false;

  /**
   * Which tags should be considered "stateful", appearing in the first row of tags in a tooltip.
   * @type {string[]}
   */
  static STATEFUL_TAGS = ["equipped", "dropped", "invested"];

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM"];

  /* -------------------------------------------- */

  /**
   * Item configuration data.
   * @type {{category: CrucibleItemCategory, quality: ItemQualityTier, enchantment: ItemEnchantmentTier}}
   */
  config;

  /**
   * Item rarity score.
   * @type {number}
   */
  rarity;

  /**
   * The budget of affix cost-points available and spent for this item.
   * Only present on item types where AFFIXABLE is true.
   * @type {{total: number, spent: number, available: number}|undefined}
   */
  affixBudget;

  /**
   * Does this item require investment?
   * @type {boolean}
   */
  get requiresInvestment() {
    return this.properties.has("investment");
  }

  /**
   * Should this item's effects be suppressed?
   * @type {boolean}
   */
  get activeEffectsSuppressed() {
    if ( !this.constructor.EQUIPABLE ) return false;
    return !this.equipped || (this.requiresInvestment && !this.invested);
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Prepare base data used by all physical items.
   */
  prepareBaseData() {

    // Item Category
    const categories = this.constructor.ITEM_CATEGORIES;
    const category = categories[this.category] || categories[this.constructor.DEFAULT_CATEGORY];

    // Item Quality
    const qualities = SYSTEM.ITEM.QUALITY_TIERS;
    const quality = qualities[this.quality] || qualities.standard;

    // Enchantment Level
    const enchantments = SYSTEM.ITEM.ENCHANTMENT_TIERS;
    const enchantment = enchantments[this.enchantment] || enchantments.mundane;

    // Item Configuration
    this.config = {category, quality, enchantment};
    this.rarity = quality.rarity + enchantment.rarity;

    // Item Properties
    for ( const p of this.properties ) {
      const prop = this.constructor.ITEM_PROPERTIES[p];
      if ( prop.rarity ) this.rarity += prop.rarity;
    }

    // Affix Budget
    if ( this.constructor.AFFIXABLE ) {
      const affixCost = this.affixes.reduce((sum, a) => sum + a.cost, 0);
      this.affixBudget = {
        total: enchantment.budget,
        spent: affixCost,
        available: enchantment.budget - affixCost
      };
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare derived data used by all physical items.
   */
  prepareDerivedData() {
    this.price = this._preparePrice();
  }

  /* -------------------------------------------- */

  /**
   * Compute the price that would be charged for the item based on its base price and rarity.
   * @returns {number}
   * @protected
   */
  _preparePrice() {
    const rarity = this.rarity;
    if ( rarity < 0 ) return Math.floor(this.price / Math.abs(rarity - 1));
    else return this.price * Math.pow(rarity + 1, 3);
  }

  /* -------------------------------------------- */
  /*  Actor Hooks                                 */
  /* -------------------------------------------- */

  /**
   * Get all actor hooks contributed by this item, including hooks from each embedded affix.
   * For non-affixable item types this returns the item's own actorHooks directly.
   * For affixable item types this aggregates inline hooks from all affixes and resolves any
   * module-level hooks registered under crucible.api.hooks.affix for each affix identifier.
   * @returns {Array<{hook: string, fn: Function|string}>}
   */
  getActorHooks() {
    if ( !this.constructor.AFFIXABLE || !this.affixes.length ) return this.actorHooks;
    const hooks = [...this.actorHooks];
    for ( const affix of this.affixes ) {
      hooks.push(...affix.actorHooks);
      const moduleHooks = crucible.api.hooks.affix?.[affix.identifier];
      if ( moduleHooks ) {
        for ( const [hook, fn] of Object.entries(moduleHooks) ) {
          if ( hook in SYSTEM.ACTOR.HOOKS ) hooks.push({hook, fn});
        }
      }
    }
    return hooks;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Compose an item name from the names of its embedded affixes.
   * Affixes with a namePrefix contribute text before the item category label.
   * Affixes with a nameSuffix contribute text after "of" at the end of the name.
   * Returns null if no affixes contribute to the name, indicating that no automatic name applies.
   * Only available on item types where AFFIXABLE is true.
   * @returns {string|null}
   */
  composeItemName() {
    if ( !this.constructor.AFFIXABLE ) return null;
    const prefixes = this.affixes.flatMap(a => a.namePrefix ? [a.namePrefix] : []);
    const suffixes = this.affixes.flatMap(a => a.nameSuffix ? [a.nameSuffix] : []);
    if ( !prefixes.length && !suffixes.length ) return null;
    const base = this.config.category.label;
    let name = prefixes.length ? prefixes.join(" ") + " " + base : base;
    if ( suffixes.length ) name += " of " + suffixes.join(" and ");
    return name;
  }

  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @param {string} [scope="full"]       The scope of tags being retrieved, "full" or "short"
   * @returns {Record<string, string>}    The tags which describe this item
   */
  getTags(scope="full") {
    const {QUALITY_TIERS: QT, ENCHANTMENT_TIERS: ET} = SYSTEM.ITEM;
    const tags = {};
    tags.category = this.config.category.label;
    if ( this.quality && (this.quality !== "standard") ) tags.quality = QT[this.quality].label;
    if ( this.enchantment && (this.enchantment !== "mundane") ) tags.quality = ET[this.enchantment].label;
    if ( this.broken ) tags.broken = this.schema.fields.broken.label;
    if ( this.equipped ) tags.equipped = this.schema.fields.equipped.label;
    else if ( this.parent.parent && !this.dropped ) tags.equipped = game.i18n.localize("ITEM.PROPERTIES.Unequipped");
    if ( this.dropped ) tags.dropped = this.schema.fields.dropped.label;
    if ( this.requiresInvestment ) tags.invested = this.invested ? this.schema.fields.invested.label
      : game.i18n.localize("ITEM.PROPERTIES.NotInvested");
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Render this physical item as HTML for a tooltip card.
   * @returns {Promise<string>}
   */
  async renderCard() {
    await foundry.applications.handlebars.loadTemplates([this.constructor.TOOLTIP_TEMPLATE]);
    const preparedTags = {
      stateful: {},
      permanent: this.getTags("full")
    };
    for ( const tag of this.constructor.STATEFUL_TAGS ) {
      if ( preparedTags.permanent[tag] ) {
        preparedTags.stateful[tag] = preparedTags.permanent[tag];
        delete preparedTags.permanent[tag];
      }
    }
    return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_TEMPLATE, {
      item: this.parent,
      tags: preparedTags
    });
  }
}
