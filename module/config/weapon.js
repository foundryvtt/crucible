/**
 * Enumerate the weapon categories which are allowed by the system.
 * Record certain mechanical metadata which applies to weapons in each category.
 * @type {{string, object}}
 */
export const CATEGORIES = {
  "light": {
    label: "WEAPON.Light",
    hands: 1,
    main: true,
    off: true,
    thrown: true
  },
  "martial": {
    label: "WEAPON.Martial",
    main: true,
    off: true,
    thrown: false
  },
  "heavy": {
    label: "WEAPON.Heavy",
    hands: 2,
    main: true,
    off: false,
    thrown: false
  },
  "shield": {
    label: "WEAPON.Shield",
    hands: 1,
    main: false,
    off: true,
    thrown: false
  },
  "focus": {
    label: "WEAPON.Focus",
    hands: 1,
    main: false,
    off: true,
    thrown: true
  }
};
