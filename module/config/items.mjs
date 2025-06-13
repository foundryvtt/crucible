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

export const PROPERTIES = Object.freeze({
  investment: {
    id: "investment",
    label: "ITEM.PROPERTIES.INVESTMENT"
  }
});
