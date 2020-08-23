

/**
 * Named armor categories which are allowed by the system
 * @type {{string, string}}
 */
export const ARMOR_CATEGORIES = {
  "unarmored": {
    label: "ARMOR.Unarmored",
    maxDodge: null
  },
  "light": {
    label: "ARMOR.Light",
    maxArmor: 8,
    maxDodge: 24,
    neutral: 18
  },
  "medium": {
    label: "ARMOR.Medium",
    maxArmor: 18,
    maxDodge: 12,
    neutral: 20
  },
  "heavy": {
    label: "ARMOR.Heavy",
    maxArmor: 24,
    maxDodge: 6,
    neutral: 22
  }
};

/**
 * The boolean properties which a piece of Armor can have.
 * @type {{string, string}}
 */
export const ARMOR_PROPERTIES = {
  "bulky": "ARMOR.Bulky",
  "impenetrable": "ARMOR.Impenetrable",
  "flexible": "ARMOR.Flexible",
  "magical": "ARMOR.Magical",
  "organic": "ARMOR.Organic"
};
