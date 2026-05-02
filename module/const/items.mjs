import {defineEnum} from "./enum.mjs";

/**
 * @typedef CrucibleItemCategory            A category of weapon which can exist in the system
 * @property {string} id            The category id
 * @property {string} label         The localized label for the category
 */

/**
 * @typedef ItemQualityTier
 * @property {string} id            The quality tier id
 * @property {string} label         A localized label for the quality tier
 * @property {number} bonus         The numeric bonus for this quality tier
 * @property {number} rarity        The rarity modifier for this quality tier
 * @property {number} capacity      The total affix capacity available at this quality tier
 */

/**
 * @typedef ItemEnchantmentTier
 * @property {string} id            The enchantment tier id
 * @property {string} label         A localized label for the enchantment tier
 * @property {number} bonus         The numeric bonus for this enchantment tier
 * @property {number} rarity        The rarity modifier for this enchantment tier
 */

/**
 * @typedef ItemProperty
 * @property {string} id            The category id
 * @property {string} label         The localized label for the category
 * @property {number} [rarity]      A rarity modifier that this property adds
 * @property {string} [deprecated]  The system version in which this property was replaced by an affix. Once the
 *                                  world migration version reaches this value, the property is removed from choices.
 */

/**
 * The possible quality tiers that a physical item can possess.
 * @type {Readonly<Record<string, ItemQualityTier>>}
 */
export const QUALITY_TIERS = defineEnum({
  shoddy: {
    label: "ITEM.QualityShoddy",
    bonus: -2,
    rarity: -1,
    capacity: 0
  },
  standard: {
    label: "ITEM.QualityStandard",
    bonus: 0,
    rarity: 0,
    capacity: 0
  },
  fine: {
    label: "ITEM.QualityFine",
    bonus: 1,
    rarity: 1,
    capacity: 2
  },
  superior: {
    label: "ITEM.QualitySuperior",
    bonus: 2,
    rarity: 2,
    capacity: 4
  },
  masterwork: {
    label: "ITEM.QualityMasterwork",
    bonus: 3,
    rarity: 4,
    capacity: 6
  }
});

/**
 * The possible enchantment tiers that a physical item can possess.
 * @type {Readonly<Record<string, ItemEnchantmentTier>>}
 */
export const ENCHANTMENT_TIERS = defineEnum({
  mundane: {
    label: "ITEM.EnchantmentMundane",
    bonus: 0,
    rarity: 0
  },
  minor: {
    label: "ITEM.EnchantmentMinor",
    bonus: 1,
    rarity: 2
  },
  major: {
    label: "ITEM.EnchantmentMajor",
    bonus: 2,
    rarity: 4
  },
  legendary: {
    label: "ITEM.EnchantmentLegendary",
    bonus: 3,
    rarity: 6
  }
});

/**
 * Standard physical item properties
 * @type {Readonly<Record<string, ItemProperty>>}
 */
export const PROPERTIES = defineEnum({
  investment: {
    label: "ITEM.PROPERTIES.Investment"
  },
  stackable: {
    label: "ITEM.PROPERTIES.Stackable"
  },
  unique: {
    label: "ITEM.PROPERTIES.Unique"
  }
});

/**
 * The categories of "loot" items which are allowed.
 * @type {Readonly<Record<string, CrucibleItemCategory>>}
 */
export const LOOT_CATEGORIES = defineEnum({
  treasure: {
    label: "LOOT.CATEGORIES.Treasure"
  },
  ingredient: {
    label: "LOOT.CATEGORIES.Ingredient"
  },
  other: {
    label: "LOOT.CATEGORIES.Other"
  }
});

/**
 * The item types which are physical items.
 * Dynamically populated during system initialization.
 * @type {Set<string>}
 */
export const PHYSICAL_ITEM_TYPES = new Set();

/**
 * The categories of "tool" items which are allowed.
 * @type {Readonly<Record<string, CrucibleItemCategory>>}
 */
export const TOOL_CATEGORIES = defineEnum({
  crafting: {
    label: "TOOL.CATEGORIES.Crafting"
  },
  implement: {
    label: "TOOL.CATEGORIES.Implement"
  }
});

/**
 * The item types which can be equipped.
 * Dynamically populated during system initialization.
 * @type {Set<string>}
 */
export const EQUIPABLE_ITEM_TYPES = new Set();

/**
 * The item types which support embedded affixes.
 * Dynamically populated during system initialization.
 * @type {Set<string>}
 */
export const AFFIXABLE_ITEM_TYPES = new Set();

/**
 * The allowed affix type categories.
 * Prefix affixes contribute their name before the item category label.
 * Suffix affixes contribute their name after "of" in the composed item name.
 * @enum {string}
 */
export const AFFIX_TYPES = Object.freeze({
  prefix: "AFFIX.TypePrefix",
  suffix: "AFFIX.TypeSuffix"
});

/**
 * The categories of "schematic" items which are allowed.
 * These categories map 1:1 to the tradecraft skills which are available in the system.
 * @type {Readonly<Record<string, CrucibleItemCategory>>}
 */
export const SCHEMATIC_CATEGORIES = defineEnum({
  alchemy: {label: "SCHEMATIC.CATEGORIES.Alchemy"},
  cooking: {label: "SCHEMATIC.CATEGORIES.Cooking"},
  enchanting: {label: "SCHEMATIC.CATEGORIES.Enchanting"},
  fletching: {label: "SCHEMATIC.CATEGORIES.Fletching"},
  jewelcraft: {label: "SCHEMATIC.CATEGORIES.Jewelcraft"},
  glyphweaving: {label: "SCHEMATIC.CATEGORIES.Glyphweaving"},
  smithing: {label: "SCHEMATIC.CATEGORIES.Smithing"},
  tailoring: {label: "SCHEMATIC.CATEGORIES.Tailoring"}
});

/**
 * The boolean properties that a "schematic" is able to have.
 * @type {Readonly<Record<string, ItemProperty>>}
 */
export const SCHEMATIC_PROPERTIES = defineEnum({
  common: {label: "SCHEMATIC.PROPERTIES.Common"}
});
