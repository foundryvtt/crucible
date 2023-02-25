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

export function confusion(actor, target) {
  return {
    _id: getEffectId("Confusion"),
    label: "Confusion",
    icon: "icons/magic/air/air-burst-spiral-pink.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    statuses: ["disoriented"],
    flags: {
      crucible: {
        dot: {
          morale: Math.floor(actor.system.abilities.wisdom.value / 2),
          damageType: "psychic"
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

export function corrupted(actor, target) {
  return {
    _id: getEffectId("Corrupted"),
    label: "Corrupted",
    icon: "icons/magic/unholy/strike-beam-blood-red-purple.webp",
    duration: {rounds: 3},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.wisdom.value,
          damageType: "unholy"
        }
      }
    }
  }
}

export function entropy(actor, target) {
  return {
    _id: getEffectId("Entropy"),
    label: "Entropy",
    icon: "icons/magic/unholy/orb-swirling-teal.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    statuses: ["frightened"],
    flags: {
      crucible: {
        dot: {
          health: Math.floor(actor.system.abilities.wisdom.value / 2),
          damageType: "void"
        }
      }
    }
  }
}

export function irradiated(actor, target) {
  return {
    _id: getEffectId("Irradiated"),
    label: "Irradiated",
    icon: "icons/magic/light/beams-rays-orange-purple-large.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.wisdom.value,
          morale: actor.system.abilities.wisdom.value,
          damageType: "radiant"
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
