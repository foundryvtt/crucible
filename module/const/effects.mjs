/**
 * @typedef CrucibleDoTConfig
 * @property {string} [ability]
 * @property {number} [amount]
 * @property {string} [damageType]
 * @property {number} [turns=3]
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
export function bleeding(actor, {ability="dexterity", amount, turns=3, damageType="piercing"}={}) {
  amount ??= actor.getAbilityBonus(ability, 1);
  return {
    _id: getEffectId("Bleeding"),
    name: "Bleeding",
    icon: "icons/skills/wounds/blood-spurt-spray-red.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["bleeding"],
    system: {
      dot: [{
        amount,
        damageType,
        resource: "health"
      }]
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
export function burning(actor, {ability="intellect", amount, turns=3}={}) {
  amount ??= actor.getAbilityBonus(ability, 2);
  return {
    _id: getEffectId("Burning"),
    name: "Burning",
    icon: "icons/magic/fire/projectile-smoke-swirl-red.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["burning"],
    system: {
      dot: [{
        amount,
        damageType: "fire",
        resource: "health"
      }, {
        amount,
        damageType: "fire",
        resource: "morale"
      }]
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
  amount ??= actor.getAbilityBonus(ability, 2);
  return {
    _id: getEffectId("Freezing"),
    name: "Freezing",
    icon: "icons/magic/water/orb-ice-web.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["freezing", "slowed"],
    system: {
      dot: [{
        amount,
        damageType: "cold",
        resource: "health",
      }]
    }
  }
}

/**
 * Generate a standardized confused effect.
 * Confused deals half intellect in damage to Morale and inflicts the Disoriented condition.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function confused(actor, {ability="intellect", amount, turns=2}={}) {
  amount ??= actor.getAbilityBonus(ability, 2);
  return {
    _id: getEffectId("Confused"),
    name: "Confused",
    icon: "icons/magic/air/air-burst-spiral-pink.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["confused", "disoriented"],
    system: {
      dot: [{
        amount,
        damageType: "psychic",
        resource: "morale"
      }]
    }
  }
}

/**
 * Generate a standardized corroding effect.
 * Corroding deals half wisdom in damage to Health.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function corroding(actor, {ability="wisdom", amount, turns=3}={}) {
  amount ??= actor.getAbilityBonus(ability, 2);
  return {
    _id: getEffectId("Corroding"),
    name: "Corroding",
    icon: "icons/magic/earth/orb-stone-smoke-teal.webp",
    duration: {turns},
    origin: actor.uuid,
    system: {
      dot: [{
        amount,
        damageType: "acid",
        resource: "health"
      }]
    }
  }
}

// TODO document
export function decay(actor, {ability="wisdom", amount, turns=3}={}) {
  amount ??= actor.getAbilityBonus(ability, 2);
  return {
    _id: getEffectId("Decaying"),
    name: "Decaying",
    icon: "icons/magic/unholy/strike-beam-blood-red-purple.webp",
    duration: {turns},
    origin: actor.uuid,
    system: {
      dot: [{
        amount,
        damageType: "corruption",
        resource: "health"
      }]
    }
  }
}

// TODO as above
export function entropy(actor) {
  return {
    _id: getEffectId("Entropy"),
    name: "Entropy",
    icon: "icons/magic/unholy/orb-swirling-teal.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    statuses: ["frightened"],
    system: {
      dot: [{
        amount: Math.floor(actor.system.abilities.presence.value / 2),
        damageType: "void",
        resource: "health"
      }]
    }
  }
}

// TODO as above
export function irradiated(actor) {
  return {
    _id: getEffectId("Irradiated"),
    name: "Irradiated",
    icon: "icons/magic/light/beams-rays-orange-purple-large.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    system: {
      dot: [{
        amount: actor.system.abilities.presence.value,
        damageType: "radiant",
        resource: "health"
      }, {
        amount: actor.system.abilities.presence.value,
        damageType: "radiant",
        resource: "morale"
      }]
    }
  }
}

/**
 * Generate a standardized mending effect.
 * Mending deals wisdom in restoration to Health.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function mending(actor, {ability="wisdom", amount, turns=1}={}) {
  amount ??= actor.getAbilityBonus(ability, 1);
  return {
    _id: getEffectId("Mending"),
    name: "Mending",
    icon: "icons/magic/life/cross-beam-green.webp",
    duration: {turns},
    origin: actor.uuid,
    system: {
      dot: [{
        amount,
        resource: "health",
        restoration: true
      }]
    }
  }
}

// TODO as above
export function inspired(actor, target) {
  return {
    _id: getEffectId("Inspired"),
    name: "Inspired",
    icon: "icons/magic/light/explosion-star-glow-silhouette.webp",
    duration: {turns: 1},
    origin: actor.uuid,
    system: {
      dot: [{
        amount: actor.system.abilities.presence.value,
        resource: "morale",
        restoration: true
      }]
    }
  }
}

/**
 * Generate a standardized dominated effect.
 * Dominated deals wisdom in psychic damage to Morale.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function dominated(actor, {ability="wisdom", amount, turns=3, damageType="psychic"}={}) {
  amount ??= actor.getAbilityBonus(ability, 1);
  return {
    _id: getEffectId("Dominated"),
    name: "Dominated",
    icon: "icons/magic/control/hypnosis-mesmerism-watch.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["dominated"],
    system: {
      dot: [{
        amount,
        damageType,
        resource: "morale"
      }]
    }
  }
}

/**
 * Generate a standardized poisoned effect.
 * Poisoned deals the creatures toughness value in damage to Health.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function poisoned(actor, {ability="toughness", amount, turns=6}={}) {
  amount ??= actor.getAbilityBonus(ability, 1);
  return {
    _id: getEffectId("Poisoned"),
    name: "Poisoned",
    icon: "icons/magic/unholy/orb-smoking-green.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["poisoned"],
    system: {
      dot: [{
        amount,
        damageType: "poison",
        resource: "health"
      }]
    }
  }
}

/**
 * Generate a standardized shocked effect.
 * Shocked deals half intellect in damage to Morale.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function shocked(actor, {ability="intellect", amount, turns=3}={}) {
  amount ??= actor.getAbilityBonus(ability, 2);
  return {
    _id: getEffectId("Shocked"),
    name: "Shocked",
    icon: "icons/magic/lightning/bolt-strike-forked-blue.webp",
    duration: {turns},
    origin: actor.uuid,
    statuses: ["shocked"],
    system: {
      dot: [{
        amount,
        damageType: "electricity",
        resource: "morale"
      }]
    }
  }
}

// TODO as above
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
