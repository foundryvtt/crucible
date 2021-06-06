

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

export const ACTION_TAGS = [
  "area",
  "melee"
]


export const DEFAULT_ACTIONS = [
  {
    id: "move",
    name: "Move",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
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
    targetType: "single",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 1,
    focusCost: 0,
    affectAllies: false,
    affectEnemies: true,
    tags: ["melee"]
  },
  {
    id: "cleave",
    name: "Cleave",
    img: "icons/skills/melee/strike-sword-slashing-red.webp",
    targetType: "cone",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 2,
    focusCost: 0,
    affectAllies: false,
    affectEnemies: true,
    tags: ["melee", "area"]
  },
  {
    id: "flurry",
    name: "Flurry",
    img: "icons/skills/melee/blade-tips-triple steel.webp",
    targetType: "single",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 2,
    focusCost: 0,
    affectAllies: false,
    affectEnemies: true,
    tags: ["melee", "multiple"]
  },
  {
    id: "dirty-tricks",
    name: "Dirty Tricks",
    img: "icons/magic/earth/projectile-boulder-dust.webp",
    targetType: "pulse",
    targetNumber: 1,
    targetDistance: 1,
    actionCost: 1,
    focusCost: 1,
    affectAllies: true,
    affectEnemies: true,
    tags: ["defense", "area"]
  },
];
