

/**
 * Named armor categories which are allowed by the system
 * @enum {{
 *  id: string,
 *  label: string,
 *  armor: {min: number, max: number},
 *  dodge: {min: number, max: number, start: number}
 * }}
 */
export const CATEGORIES = {
  unarmored: {
    id: "unarmored",
    label: "ARMOR.Unarmored",
    armor: {min: 0, max: 0},
    dodge: {min: 10, max: 10, start: 0}
  },
  light: {
    id: "light",
    label: "ARMOR.Light",
    armor: {min: 2, max: 7},
    dodge: {min: 7, max: 9, start: 2}
  },
  medium: {
    id: "medium",
    label: "ARMOR.Medium",
    armor: {min: 8, max: 13},
    dodge: {min: 4, max: 6, start: 4}
  },
  heavy: {
    id: "heavy",
    label: "ARMOR.Heavy",
    armor: {min: 14, max: 20},
    dodge: {min: 0, max: 3, start: 8}
  },
  natural: {
    id: "natural",
    label: "ARMOR.Natural",
    armor: {min: 0, max: 20},
    dodge: {min: 10, max: 10, start: 0}
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
    dodge: {base: 10, bonus: 0, start: 0}
  }
};
