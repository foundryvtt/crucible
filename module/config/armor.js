

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
    maxArmor: 8
  },
  "medium": {
    label: "ARMOR.Medium",
    minArmor: 9,
    maxArmor: 16
  },
  "heavy": {
    label: "ARMOR.Heavy",
    minArmor: 17,
    maxArmor: 24
  }
};

/**
 * The boolean properties which a piece of Armor can have.
 * @type {{string, string}}
 */
export const PROPERTIES = {
  bulky: {
    label: "ARMOR.Bulky"
  },
  impenetrable: {
    label: "ARMOR.Impenetrable"
  },
  flexible: {
    label: "ARMOR.Flexible"
  },
  magical: {
    label: "ARMOR.Magical"
  },
  organic: {
    label: "ARMOR.Organic"
  }
};


export const UNARMORED_DATA = {
  name: "Unarmored",
  img: "icons/equipment/chest/shirt-simple-white.webp",
  type: "armor",
  data: {
    category: "unarmored",
    armor: {base: 0, bonus: 0},
    dodge: {base: 8, bonus: 0, start: 0}
  }
};