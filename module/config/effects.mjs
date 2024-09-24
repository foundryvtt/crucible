/**
 * Get a standardized 16 character ID that can be used for the ActiveEffect.
 * @param {string} label    The active effect label
 * @returns {string}        The standardized ID
 */
export function getEffectId(label) {
  return label.slugify({replacement: "", lowercase: false, strict: true}).slice(0, 16).padEnd(16, "0");
}

export function bleeding(actor, target, {ability="dexterity", damageType="piercing"}={}) {
  return {
    _id: getEffectId("Bleeding"),
    name: "Bleeding",
    icon: "icons/skills/wounds/blood-spurt-spray-red.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities[ability].value,
          damageType
        }
      }
    }
  }
}

export function burning(actor, target) {
  return {
    _id: getEffectId("Burning"),
    name: "Burning",
    icon: "icons/magic/fire/projectile-smoke-swirl-red.webp",
    duration: {turns: 1},
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
    name: "Chilled",
    icon: "icons/magic/water/orb-ice-web.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    statuses: ["slowed"],
    flags: {
      crucible: {
        dot: {
          health: Math.floor(actor.system.abilities.wisdom.value / 2),
          damageType: "cold"
        }
      }
    }
  }
}

export function confusion(actor, target) {
  return {
    _id: getEffectId("Confusion"),
    name: "Confusion",
    icon: "icons/magic/air/air-burst-spiral-pink.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    statuses: ["disoriented"],
    flags: {
      crucible: {
        dot: {
          morale: Math.floor(actor.system.abilities.intellect.value / 2),
          damageType: "psychic"
        }
      }
    }
  }
}

export function corroding(actor, target) {
  return {
    _id: getEffectId("Corroding"),
    name: "Corroding",
    icon: "icons/magic/earth/orb-stone-smoke-teal.webp",
    duration: {turns: 3},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.wisdom.value,
          damageType: "acid"
        }
      }
    }
  }
}

export function decay(actor, target) {
  return {
    _id: getEffectId("Decay"),
    name: "Decay",
    icon: "icons/magic/unholy/strike-beam-blood-red-purple.webp",
    duration: {turns: 3},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.intellect.value,
          damageType: "corruption"
        }
      }
    }
  }
}

export function entropy(actor, target) {
  return {
    _id: getEffectId("Entropy"),
    name: "Entropy",
    icon: "icons/magic/unholy/orb-swirling-teal.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    statuses: ["frightened"],
    flags: {
      crucible: {
        dot: {
          health: Math.floor(actor.system.abilities.presence.value / 2),
          damageType: "void"
        }
      }
    }
  }
}

export function irradiated(actor, target) {
  return {
    _id: getEffectId("Irradiated"),
    name: "Irradiated",
    icon: "icons/magic/light/beams-rays-orange-purple-large.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: actor.system.abilities.presence.value,
          morale: actor.system.abilities.presence.value,
          damageType: "radiant"
        }
      }
    }
  }
}

export function mending(actor, target) {
  return {
    _id: getEffectId("Mending"),
    name: "Mending",
    icon: "icons/magic/life/cross-beam-green.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          health: -actor.system.abilities.wisdom.value
        }
      }
    }
  }
}

export function inspired(actor, target) {
  return {
    _id: getEffectId("Inspired"),
    name: "Inspired",
    icon: "icons/magic/light/explosion-star-glow-silhouette.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          morale: -actor.system.abilities.presence.value
        }
      }
    }
  }
}


export function poisoned(actor, target) {
  return {
    _id: getEffectId("Poisoned"),
    name: "Poisoned",
    icon: "icons/magic/unholy/orb-smoking-green.webp",
    duration: {turns: 6},
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
    name: "Shocked",
    icon: "icons/magic/lightning/bolt-strike-forked-blue.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    statuses: ["staggered"],
    flags: {
      crucible: {
        dot: {
          morale: Math.floor(actor.system.abilities.intellect.value / 2),
          damageType: "electricity"
        }
      }
    }
  }
}

export function staggered(actor, target) {
  return {
    _id: getEffectId("Staggered"),
    name: "Staggered",
    icon: "icons/skills/melee/strike-hammer-destructive-orange.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    statuses: ["staggered"]
  }
}
