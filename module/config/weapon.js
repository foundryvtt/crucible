/**
 * Enumerate the weapon categories which are allowed by the system.
 * Record certain mechanical metadata which applies to weapons in each category.
 * @type {{string, object}}
 */
export const CATEGORIES = {
  light1: {
    label: "WEAPON.Light1",
    hands: 1,
    main: true,
    off: true,
    scaling: "dex",
    dice: 0,
    denomination: 0,
    ap: 0
  },
  simple1: {
    label: "WEAPON.Simple1",
    hands: 1,
    main: true,
    off: true,
    scaling: "str",
    dice: 0,
    denomination: 2,
    ap: 0
  },
  balanced1: {
    label: "WEAPON.Balanced1",
    hands: 1,
    main: true,
    off: true,
    scaling: "strdex",
    dice: 0,
    denomination: 2,
    ap: 0
  },
  heavy1: {
    label: "WEAPON.Heavy1",
    hands: 1,
    main: true,
    off: false,
    scaling: "str",
    dice: 0,
    denomination: 4,
    ap: 1
  },
  massive1: {
    label: "WEAPON.Massive1",
    hands: 1,
    main: true,
    off: false,
    scaling: "str",
    dice: 0,
    denomination: 6,
    ap: 2
  },
  simple2: {
    label: "WEAPON.Simple2",
    hands: 2,
    main: true,
    off: false,
    scaling: "str",
    dice: 1,
    denomination: 2,
    ap: 1
  },
  balanced2: {
    label: "WEAPON.Balanced2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strdex",
    dice: 1,
    denomination: 2,
    ap: 1
  },
  heavy2: {
    label: "WEAPON.Heavy2",
    hands: 2,
    main: true,
    off: false,
    scaling: "str",
    dice: 1,
    denomination: 4,
    ap: 2
  },
  massive2: {
    label: "WEAPON.Massive2",
    hands: 2,
    main: true,
    off: false,
    scaling: "str",
    dice: 0,
    denomination: 6,
    ap: 3
  },
  projectile2: {
    label: "WEAPON.Projectile2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strdex",
    dice: 1,
    denomination: 2,
    ap: 1
  },
  mechanical1: {
    label: "WEAPON.Mechanical1",
    hands: 1,
    main: true,
    off: true,
    scaling: "dex",
    dice: 0,
    denomination: 4,
    ap: 2
  },
  mechanical2: {
    label: "WEAPON.Mechanical2",
    hands: 2,
    main: true,
    off: false,
    scaling: "dex",
    dice: 1,
    denomination: 4,
    ap: 2
  }
}
