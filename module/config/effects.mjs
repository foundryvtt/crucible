/**
 * Get a standardized 16 character ID that can be used for the ActiveEffect.
 * @param {string} label    The active effect label
 * @returns {string}        The standardized ID
 */
export function getEffectId(label) {
  return label.slugify({replacement: "", strict: true}).slice(0, 16).padEnd(16, "0");
}

export function bleeding(actor, target, {damageType="piercing"}={}) {
  return {
    _id: getEffectId("Bleeding"),
    label: "Bleeding",
    icon: "icons/skills/wounds/blood-spurt-spray-red.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.dexterity.value,
          damageType
        }
      }
    }
  }
}

export function burning(actor, target) {
  return {
    _id: getEffectId("Burning"),
    label: "Burning",
    icon: "icons/magic/fire/projectile-smoke-swirl-red.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.intellect.value,
          morale: actor.system.abilities.intellect.value,
          damageType: "fire"
        }
      }
    }
  }
}

export function chilled(actor, target) {
  return {
    _id: getEffectId("Chilled"),
    label: "Chilled",
    icon: "icons/magic/water/orb-ice-web.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    statuses: ["slowed"],
    flags: {
      crucible: {
        dot: {
          health: Math.floor(actor.system.abilities.intellect.value / 2),
          damageType: "frost"
        }
      }
    }
  }
}

export function corroding(actor, target) {
  return {
    _id: getEffectId("Corroding"),
    label: "Corroding",
    icon: "icons/magic/earth/orb-stone-smoke-teal.webp",
    duration: {rounds: 3},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.intellect.value,
          damageType: "acid"
        }
      }
    }
  }
}

export function poisoned(actor, target) {
  return {
    _id: getEffectId("Poisoned"),
    label: "Poisoned",
    icon: "icons/magic/unholy/orb-smoking-green.webp",
    duration: {rounds: 6},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.intellect.value,
          damageType: "poison"
        }
      }
    }
  }
}

export function shocked(actor, target) {
  return {
    _id: getEffectId("Shocked"),
    label: "Shocked",
    icon: "icons/magic/lightning/bolt-strike-forked-blue.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    statuses: ["staggered"],
    flags: {
      crucible: {
        dot: {
          morale: Math.floor(actor.system.abilities.intellect.value / 2),
          damageType: "lightning"
        }
      }
    }
  }
}

export function staggered(actor, target) {
  return {
    _id: getEffectId("Staggered"),
    label: "Staggered",
    icon: "icons/skills/melee/strike-hammer-destructive-orange.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    statuses: ["staggered"]
  }
}
