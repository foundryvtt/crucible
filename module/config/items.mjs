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
 */

/**
 * The possible quality tiers that a physical item can possess.
 * @enum {ItemQualityTier}
 */
export const QUALITY_TIERS = {
  shoddy: {
    id: "shoddy",
    label: "ITEM.QualityShoddy",
    bonus: -2,
    rarity: -1
  },
  standard: {
    id: "standard",
    label: "ITEM.QualityStandard",
    bonus: 0,
    rarity: 0
  },
  fine: {
    id: "fine",
    label: "ITEM.QualityFine",
    bonus: 1,
    rarity: 1
  },
  superior: {
    id: "superior",
    label: "ITEM.QualitySuperior",
    bonus: 2,
    rarity: 2
  },
  masterwork: {
    id: "masterwork",
    label: "ITEM.QualityMasterwork",
    bonus: 3,
    rarity: 4
  }
}

/**
 * The possible enchantment tiers that a physical item can possess.
 * @enum {ItemEnchantmentTier}
 */
export const ENCHANTMENT_TIERS = {
  mundane: {
    id: "mundane",
    label: "ITEM.EnchantmentMundane",
    bonus: 0,
    rarity: 0
  },
  minor: {
    id: "minor",
    label: "ITEM.EnchantmentMinor",
    bonus: 1,
    rarity: 2
  },
  major: {
    id: "major",
    label: "ITEM.EnchantmentMajor",
    bonus: 2,
    rarity: 4
  },
  legendary: {
    id: "legendary",
    label: "ITEM.EnchantmentLegendary",
    bonus: 3,
    rarity: 6
  }
}

/**
 * Standard physical item properties
 * @type {Record<string, ItemProperty>}
 */
export const PROPERTIES = Object.freeze({
  investment: {
    id: "investment",
    label: "ITEM.PROPERTIES.INVESTMENT"
  },
  stackable: {
    id: "stackable",
    label: "ITEM.PROPERTIES.STACKABLE"
  }
});

/**
 * The categories of "loot" items which are allowed.
 * @enum {CrucibleItemCategory}
 */
export const LOOT_CATEGORIES = {
  treasure: {
    id: "treasure",
    label: "LOOT.CATEGORIES.TREASURE"
  },
  ingredient: {
    id: "ingredient",
    label: "LOOT.CATEGORIES.INGREDIENT"
  },
  other: {
    id: "other",
    label: "LOOT.CATEGORIES.OTHER"
  }
};

/**
 * The item types which are physical items.
 * @type {Set<string>}
 */
export const PHYSICAL_ITEM_TYPES = new Set(["accessory", "armor", "consumable", "loot", "schematic", "weapon"]);

/**
 * The item types which can be equipped.
 * @type {Set<string>}
 */
export const EQUIPABLE_ITEM_TYPES = new Set(["accessory", "armor", "consumable", "weapon"]);

/**
 * The categories of "schematic" items which are allowed.
 * These categories map 1:1 to the tradecraft skills which are available in the system.
 * @enum {CrucibleItemCategory}
 */
export const SCHEMATIC_CATEGORIES = {
  alchemy: {id: "alchemy", label: "SCHEMATIC.CATEGORIES.ALCHEMY"},
  cooking: {id: "cooking", label: "SCHEMATIC.CATEGORIES.COOKING"},
  enchanting: {id: "enchanting", label: "SCHEMATIC.CATEGORIES.ENCHANTING"},
  fletching: {id: "fletching", label: "SCHEMATIC.CATEGORIES.FLETCHING"},
  jewelcraft: {id: "jewelcraft", label: "SCHEMATIC.CATEGORIES.JEWELCRAFT"},
  runeweaving: {id: "runeweaving", label: "SCHEMATIC.CATEGORIES.RUNEWEAVING"},
  smithing: {id: "smithing", label: "SCHEMATIC.CATEGORIES.SMITHING"},
  tailoring: {id: "tailoring", label: "SCHEMATIC.CATEGORIES.TAILORING"}
}

/**
 * The boolean properties that a "schematic" is able to have.
 * @type {Record<string, ItemProperty>}
 */
export const SCHEMATIC_PROPERTIES = {
  common: {id: "common", label: "SCHEMATIC.PROPERTIES.COMMON"}
}
