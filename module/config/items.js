/**
 * The possible quality tiers that a physical item can possess.
 * @type {Object<{label: string, bonus: number, rarity: number}>}
 */
export const QUALITY_TIERS = {
  broken: {
    label: "ITEM.QualityBroken",
    bonus: -2,
    rarity: 0
  },
  shoddy: {
    label: "ITEM.QualityShoddy",
    bonus: -1,
    rarity: 0
  },
  standard: {
    label: "ITEM.QualityStandard",
    bonus: 0,
    rarity: 0
  },
  fine: {
    label: "ITEM.QualityFine",
    bonus: 1,
    rarity: 1
  },
  superior: {
    label: "ITEM.QualitySuperior",
    bonus: 2,
    rarity: 2
  },
  masterwork: {
    label: "ITEM.QualityMasterwork",
    bonus: 3,
    rarity: 4
  }
}

/**
 * The possible enchantment tiers that a physical item can possess.
 * @type {Object<{label: string, bonus: number, rarity: number}>}
 */
export const ENCHANTMENT_TIERS = {
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
}