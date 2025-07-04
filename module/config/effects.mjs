/**
 * @typedef CrucibleDoTConfig
 * @property {number} [ability]
 * @property {number} [amount]
 * @property {string} [damageType]
 * @property {number} [turns=1]
 * @property {CrucibleActor} [target]
 */

/**
 * Get a standardized 16 character ID that can be used for the ActiveEffect.
 * @param {string} label    The active effect label
 * @returns {string}        The standardized ID
 */
export function getEffectId(label) {
  return label.slugify({replacement: "", lowercase: false, strict: true}).slice(0, 16).padEnd(16, "0");
}

/**
 * Generate a standardized bleeding effect.
 * Bleeding deals dexterity in damage to Health.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function bleeding(actor, {ability="dexterity", amount, turns=1, damageType="piercing"}={}) {
  amount ??= actor.system.abilities[ability].value;
  return {
    _id: getEffectId("Bleeding"),
    name: "Bleeding",
    icon: "icons/skills/wounds/blood-spurt-spray-red.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["bleeding"],
    flags: {
      crucible: {
        dot: {
          health: amount,
          damageType
        }
      }
    }
  }
}

/**
 * Generate a standardized burning effect.
 * Burning deals half intellect in damage to both Health and Morale.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function burning(actor, {ability="intellect", amount, turns=1}={}) {
  amount ??= Math.ceil(actor.system.abilities[ability].value / 2);
  return {
    _id: getEffectId("Burning"),
    name: "Burning",
    icon: "icons/magic/fire/projectile-smoke-swirl-red.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["burning"],
    flags: {
      crucible: {
        dot: {
          health: amount,
          morale: amount,
          damageType: "fire"
        }
      }
    }
  }
}

/**
 * Generate a standardized freezing effect.
 * Freezing deals half wisdom in damage to Health and also causes slowed.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function freezing(actor, {ability="wisdom", amount, turns=1}={}) {
  amount ??= Math.ceil(actor.system.abilities[ability].value / 2);
  return {
    _id: getEffectId("Freezing"),
    name: "Freezing",
    icon: "icons/magic/water/orb-ice-web.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    statuses: ["freezing", "slowed"],
    flags: {
      crucible: {
        dot: {
          health: amount,
          damageType: "cold"
        }
      }
    }
  }
}

/** @deprecated since 0.7.4 */
export function chilled(actor, options) {
  return freezing(actor, options);
}


// TODO should be confused()
export function confusion(actor, target) {
  return {
    _id: getEffectId("Confused"),
    name: "Confused",
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

export function corroding(actor, {target, amount, turns=3}={}) {
  amount ??= actor.abilities.wisdom.value;
  return {
    _id: getEffectId("Corroding"),
    name: "Corroding",
    icon: "icons/magic/earth/orb-stone-smoke-teal.webp",
    duration: {turns},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {health, damageType: "acid"}
      }
    }
  }
}

export function decay(actor, target) {
  return {
    _id: getEffectId("Decaying"),
    name: "Decaying",
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

export function shocked(actor, {target, amount, turns=2}={}) {
  amount ??= actor.abilities.intellect.value;
  return {
    _id: getEffectId("Shocked"),
    name: "Shocked",
    icon: "icons/magic/lightning/bolt-strike-forked-blue.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["shocked"],
    flags: {
      crucible: {
        dot: {
          morale: amount,
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
