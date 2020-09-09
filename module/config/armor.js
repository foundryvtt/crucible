

/**
 * Named armor categories which are allowed by the system
 * @type {{string, string}}
 */
export const CATEGORIES = {
  "unarmored": {
    label: "ARMOR.Unarmored",
    minArmor: 0,
    maxArmor: 0
  },
  "light": {
    label: "ARMOR.Light",
    minArmor: 1,
    maxArmor: 6
  },
  "medium": {
    label: "ARMOR.Medium",
    minArmor: 7,
    maxArmor: 12
  },
  "heavy": {
    label: "ARMOR.Heavy",
    minArmor: 13,
    maxArmor: 18
  }
};

/**
 * The boolean properties which a piece of Armor can have.
 * @type {{string, string}}
 */
export const PROPERTIES = {
  "bulky": "ARMOR.Bulky",
  "impenetrable": "ARMOR.Impenetrable",
  "flexible": "ARMOR.Flexible",
  "magical": "ARMOR.Magical",
  "organic": "ARMOR.Organic"
};


export const UNARMORED_DATA = {
  name: "Unarmored",
  data: {
    category: "unarmored",
    armor: {base: 0, bonus: 0},
    dodge: {base: 8, bonus: 0, start: 0}
  }
};