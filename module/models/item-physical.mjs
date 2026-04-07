import {SYSTEM} from "../const/system.mjs";
import * as crucibleFields from "./fields.mjs";

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
      enchantment: new fields.StringField({required: true, choices: SYSTEM.ITEM.ENCHANTMENT_TIERS, initial: "mundane"}), // TODO: derive from affixes instead of storing directly
      equipped: new fields.BooleanField(),
      invested: new fields.BooleanField(),
      properties: new fields.SetField(new fields.StringField({required: true, choices: this.ITEM_PROPERTIES})),
      description: new fields.SchemaField({
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      }),
      actions: new fields.ArrayField(new crucibleFields.CrucibleActionField()),
      actorHooks: new crucibleFields.ItemActorHooks()
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
   * The affix capacity for this item, split between prefix and suffix budgets.
   * Each half of the item's quality capacity is allocated to one affix type.
   * Only present on item types where AFFIXABLE is true.
   * @type {{prefix: {total: number, spent: number, available: number}, suffix: {total: number, spent: number, available: number}}|undefined}
   */
  affixCapacity;

  /**
   * A mapping of affix ActiveEffects on this item, keyed by their unique identifier.
   * Populated during prepareBaseData for affixable item types.
   * @type {Record<string, CrucibleActiveEffect>}
   */
  affixes = {};

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
    this.rarity = quality.rarity;

    // Item Properties
    for ( const p of this.properties ) {
      const prop = this.constructor.ITEM_PROPERTIES[p];
      if ( prop.rarity ) this.rarity += prop.rarity;
    }

    // Compute affix capacity and current affix consumption
    if ( this.constructor.AFFIXABLE && !this.properties.has("unique") ) {
      const affixes = this.affixes = {};
      let prefixSpent = 0;
      let suffixSpent = 0;
      for ( const effect of this.parent.effects ) {
        if ( effect.type === "affix" ) {
          affixes[effect.system.identifier] = effect;
          if ( effect.system.affixType === "prefix" ) prefixSpent += effect.system.tier.value;
          else suffixSpent += effect.system.tier.value;
        }
      }
      const halfCapacity = quality.capacity / 2;
      this.affixCapacity = {
        prefix: {total: halfCapacity, spent: prefixSpent, available: halfCapacity - prefixSpent},
        suffix: {total: halfCapacity, spent: suffixSpent, available: halfCapacity - suffixSpent}
      };
      const totalTier = prefixSpent + suffixSpent;
      if ( totalTier > 0 ) {
        this.config.enchantment = CruciblePhysicalItem.#deriveEnchantmentTier(totalTier);
        this.config.enchantmentDerived = true;
      }
      this.rarity += totalTier;
    }
    else this.rarity += enchantment.rarity;
  }

  /* -------------------------------------------- */

  /**
   * Prepare derived data used by all physical items.
   */
  prepareDerivedData() {
    if ( this.constructor.AFFIXABLE ) this.#prepareAffixActions();
    this.price = this._preparePrice();
  }

  /* -------------------------------------------- */

  /**
   * Absorb actions provided by affixes, appending them to the item's own actions array.
   * Affix actions with IDs that collide with item-level actions are skipped with a warning.
   */
  #prepareAffixActions() {
    const itemActionIds = new Set(this.actions.map(a => a.id));
    for ( const affix of Object.values(this.affixes) ) {
      if ( !affix.system.actions?.length ) continue;
      for ( const action of affix.system.actions ) {
        if ( itemActionIds.has(action.id) ) {
          console.warn(`${this.parent.name}: Affix "${affix.name}" action "${action.id}" `
            + `ignored because it overlaps with an item-level action.`);
          continue;
        }
        itemActionIds.add(action.id);
        this.actions.push(action);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Compute the price that would be charged for the item based on its base price and rarity.
   * @returns {number}
   * @protected
   */
  _preparePrice() {
    return CruciblePhysicalItem.computePrice(this.price, this.rarity);
  }

  /* -------------------------------------------- */
  /*  Actor Hooks                                 */
  /* -------------------------------------------- */

  /**
   * Provide all actor hooks contributed by this item, both from the base item and from each of its affixes.
   * @returns {Array<{hook: string, fn: Function|string}>}
   */
  getActorHooks() {
    const affixes = this.constructor.AFFIXABLE ? Object.values(this.affixes) : [];
    if ( !affixes.length ) return this.actorHooks;
    const hooks = [...this.actorHooks];
    for ( const affix of affixes ) {
      const moduleHooks = crucible.api.hooks.affix?.[affix.system.identifier];
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
   * Compose a deterministic name for an item based on a base item name and its applied affixes.
   * TODO use localization format or Intl.ListFormatter somehow
   * @param {string} baseName
   * @param {CrucibleAffixEffectData[]} affixes
   * @returns {string|null}
   */
  /**
   * Derive an enchantment tier from a total affix tier value.
   * @param {number} affixTiers     The sum of all affix tier values on the item
   * @returns {ItemEnchantmentTier}
   */
  static #deriveEnchantmentTier(affixTiers) {
    const ET = SYSTEM.ITEM.ENCHANTMENT_TIERS;
    if ( affixTiers >= 5 ) return ET.legendary;
    if ( affixTiers >= 3 ) return ET.major;
    if ( affixTiers >= 1 ) return ET.minor;
    return ET.mundane;
  }

  /* -------------------------------------------- */

  /**
   * Compute the rarity score for an item given its quality, cumulative affix tier, and broken state.
   * @param {string} quality          The quality tier id (e.g., "fine", "masterwork")
   * @param {number} affixTiers       The sum of all affix tier values
   * @param {object} [options]
   * @param {boolean} [options.broken]  Whether the item is broken
   * @returns {number}
   */
  static computeRarity(quality, affixTiers, {broken=false}={}) {
    const qr = SYSTEM.ITEM.QUALITY_TIERS[quality]?.rarity ?? 0;
    return qr + affixTiers + (broken ? -2 : 0);
  }

  /* -------------------------------------------- */

  /**
   * Compute the scaled price for an item given its base price and rarity score.
   * @param {number} basePrice        The base price of the item at standard quality
   * @param {number} rarity           The computed rarity score
   * @returns {number}
   */
  static computePrice(basePrice, rarity) {
    if ( rarity < 0 ) return Math.floor(basePrice / Math.abs(rarity - 1));
    return basePrice * Math.pow(rarity + 1, 3);
  }

  /* -------------------------------------------- */

  static composeItemName(baseName, affixes) {
    const prefixes = [];
    const suffixes = [];
    for ( const affix of foundry.utils.iterateValues(affixes) ) {
      const adj = affix.system.adjective || affix.name;
      if ( affix.system.affixType === "prefix" ) prefixes.push(adj);
      else suffixes.push(adj);
    }
    if ( !prefixes.length && !suffixes.length ) return null;
    let name = prefixes.length ? prefixes.join(" ") + " " + baseName : baseName;
    if ( suffixes.length ) name += " of " + suffixes.join(" ");
    return name;
  }

  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @param {string} [scope="full"]       The scope of tags being retrieved, "full" or "short"
   * @returns {Record<string, string>}    The tags which describe this item
   */
  getTags(scope="full") {
    const {QUALITY_TIERS: QT} = SYSTEM.ITEM;
    const tags = {};
    tags.category = this.config.category.label;
    if ( this.quality && (this.quality !== "standard") ) tags.quality = QT[this.quality].label;
    if ( this.config.enchantment.id !== "mundane" ) tags.quality = this.config.enchantment.label;
    if ( this.constructor.AFFIXABLE && this.properties.has("unique") ) tags.unique = _loc("ITEM.PROPERTIES.Unique");
    if ( this.broken ) tags.broken = this.schema.fields.broken.label;
    if ( this.equipped ) tags.equipped = this.schema.fields.equipped.label;
    else if ( this.parent.parent && !this.dropped ) tags.equipped = _loc("ITEM.PROPERTIES.Unequipped");
    if ( this.dropped ) tags.dropped = this.schema.fields.dropped.label;
    if ( this.requiresInvestment ) tags.invested = this.invested ? this.schema.fields.invested.label
      : _loc("ITEM.PROPERTIES.NotInvested");
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
    const item = this.parent;
    return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_TEMPLATE, {
      item,
      tags: preparedTags,
      actions: await item.prepareActionsContext()
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async toEmbed(config, _options) {
    const container = document.createElement("section");

    // Description only
    if ( config.values.includes("description") ) {
      container.innerHTML = await CONFIG.ux.TextEditor.enrichHTML(this.description.public);
      return container;
    }

    // Embedded Item card
    container.classList = "crucible item-embed";
    container.innerHTML = await this.renderCard();
    if ( config.values.includes("centered") ) container.firstElementChild.classList.add("centered");
    return container;
  }
}
