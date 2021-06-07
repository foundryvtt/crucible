

export const ACTION_TARGET_TYPES = {
  "self": {
    label: "Self"
  },
  "single": {
    label: "Single"
  },
  "cone": {
    label: "Cone"
  },
  "fan": {
    label: "Fan"
  },
  "pulse": {
    label: "Pulse"
  },
  "blast": {
    label: "Blast"
  },
  "ray": {
    label: "Ray"
  },
  "wall": {
    label: "Wall"
  }
}

/* -------------------------------------------- */


/**
 * Define special logic for action tag types
 * @type {object}
 */
export const ACTION_TAGS = {
  "melee": {
    label: "Melee",
    canActivate: function(actor, action) {
      return actor.equipment.weapons.melee;
    }
  },
  "mainhand": {
    label: "Main-Hand"
  },
  "movement": {
    label: "Movement"
  },
  "ranged": {
    label: "Ranged",
    canActivate: function(actor, action) {
      return actor.equipment.weapons.ranged;
    }
  },
  "attackChain": {
    label: "Attack Chain",
    postActivate: async function(actor, action, rolls) {
      if ( rolls.every(r => r.isSuccess) ) {
        rolls.push(await actor.equipment.weapons.mainhand.roll(rolls[0].data));
      }
    }
  },
  "offhand": {
    label: "Off-Hand",
    canActivate: function(actor, action) {
      return actor.equipment.weapons.dualWield;
    }
  },
  "twoHanded": {
    label: "Two-Handed",
    canActivate: function(actor, action) {
      return actor.equipment.weapons.twoHanded;
    }
  },
  "weapon": {
    canActivate: function(actor, action) {
      return !actor.equipment.weapons.unarmed;
    }
  }
}

/* -------------------------------------------- */


export const DEFAULT_ACTIONS = [
  {
    id: "move",
    name: "Move",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    description: "You move at normal speed up to 10 feet in any direction.",
    targetType: "self",
    targetNumber: 1,
    targetDistance: 2,
    actionCost: 1,
    focusCost: 0,
    affectAllies: false,
    affectEnemies: false,
    tags: ["movement"]
  },
  {
    id: "strike",
    name: "Strike",
    img: "icons/skills/melee/blade-tip-orange.webp",
    description: "You attack a single target with your main-hand weapon.",
    targetType: "single",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 1,
    focusCost: 0,
    affectAllies: false,
    affectEnemies: true,
    tags: ["mainhand"]
  },
  {
    id: "cleave",
    name: "Cleave",
    img: "icons/skills/melee/strike-sword-slashing-red.webp",
    description: "You swing your two-handed weapon in a wide arc, hitting all enemies in front of you.",
    targetType: "cone",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 2,
    focusCost: 0,
    affectAllies: false,
    affectEnemies: true,
    tags: ["twoHanded", "melee"]
  },
  {
    id: "flurry",
    name: "Flurry",
    img: "icons/skills/melee/blade-tips-triple steel.webp",
    description: "You unleash a rapid set of strikes using both weapons against a single target.",
    targetType: "single",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 2,
    focusCost: 0,
    affectAllies: false,
    affectEnemies: true,
    tags: ["mainhand", "offhand", "attackChain"]
  },
  {
    id: "dirty-tricks",
    name: "Dirty Tricks",
    img: "icons/magic/earth/projectile-boulder-dust.webp",
    description: "You hurl dirt and dust in the air in a circle around you, momentarily blinding nearby creatures.",
    targetType: "pulse",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 1,
    focusCost: 1,
    affectAllies: true,
    affectEnemies: true,
    tags: ["mainhand"]
  },
];
