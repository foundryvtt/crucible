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
 * @param {string} label            The active effect label
 * @param {object} [options]        Additional options
 * @param {string} [options.suffix] A suffix with which to end the returned ID
 * @returns {string}                The standardized ID
 */
export function getEffectId(label, {suffix=""}={}) {
  return `${crucible.api.methods.generateId(label, 16 - suffix.length)}${suffix}`;
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
    name: _loc(CONFIG.statusEffects.bleeding.name),
    img: "icons/skills/wounds/blood-spurt-spray-red.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    statuses: ["bleeding"],
    system: {
      dot: [{
        amount,
        damageType,
        resource: "health"
      }]
    }
  };
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
    name: _loc(CONFIG.statusEffects.burning.name),
    img: "icons/magic/fire/projectile-smoke-swirl-red.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
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
  };
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
    name: _loc(CONFIG.statusEffects.freezing.name),
    img: "icons/magic/water/orb-ice-web.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    statuses: ["freezing", "slowed"],
    system: {
      dot: [{
        amount,
        damageType: "cold",
        resource: "health"
      }]
    }
  };
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
    name: _loc(CONFIG.statusEffects.confused.name),
    img: "icons/magic/air/air-burst-spiral-pink.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    statuses: ["confused", "disoriented"],
    system: {
      dot: [{
        amount,
        damageType: "psychic",
        resource: "morale"
      }]
    }
  };
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
    name: _loc(CONFIG.statusEffects.corroding.name),
    img: "icons/magic/earth/orb-stone-smoke-teal.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    system: {
      dot: [{
        amount,
        damageType: "acid",
        resource: "health"
      }]
    }
  };
}

/**
 * Generate a standardized decay effect, dealing half-Presence in corruption damage to Health.
 * @param {Actor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function decay(actor, {ability="presence", amount, turns=3}={}) {
  amount ??= actor.getAbilityBonus(ability, 2);
  return {
    _id: getEffectId("Decaying"),
    name: _loc(CONFIG.statusEffects.decaying.name),
    img: "icons/magic/unholy/strike-beam-blood-red-purple.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    system: {
      dot: [{
        amount,
        damageType: "corruption",
        resource: "health"
      }]
    }
  };
}

/**
 * Generate a standardized entropy effect, applying the frightened status and dealing presence in void damage to Health.
 * @param {Actor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function entropy(actor, {ability="presence", amount, turns=1}={}) {
  amount ??= actor.getAbilityBonus(ability, 2);
  return {
    _id: getEffectId("Entropy"),
    name: _loc(CONFIG.statusEffects.entropy.name),
    img: "icons/magic/unholy/orb-swirling-teal.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    statuses: ["frightened"],
    system: {
      dot: [{
        amount,
        damageType: "void",
        resource: "health"
      }]
    }
  };
}

/**
 * Generate a standardized irradiated effect, dealing presence in radiant damage to both Health and Morale.
 * @param {Actor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function irradiated(actor, {ability="presence", amount, turns=1}={}) {
  amount ??= actor.getAbilityBonus(ability, 1);
  return {
    _id: getEffectId("Irradiated"),
    name: _loc(CONFIG.statusEffects.irradiated.name),
    img: "icons/magic/light/beams-rays-orange-purple-large.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    system: {
      dot: [{
        amount,
        damageType: "radiant",
        resource: "health"
      }, {
        amount,
        damageType: "radiant",
        resource: "morale"
      }]
    }
  };
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
    name: _loc(CONFIG.statusEffects.mending.name),
    img: "icons/magic/life/cross-beam-green.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    system: {
      dot: [{
        amount,
        resource: "health",
        restoration: true
      }]
    }
  };
}

/**
 * Generate a standardized inspired effect, restoring presence in morale to the target.
 * @param {Actor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function inspired(actor, {ability="presence", amount, turns=1}={}) {
  amount ??= actor.getAbilityBonus(ability, 1);
  return {
    _id: getEffectId("Inspired"),
    name: _loc(CONFIG.statusEffects.inspired.name),
    img: "icons/magic/light/explosion-star-glow-silhouette.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    system: {
      dot: [{
        amount,
        resource: "morale",
        restoration: true
      }]
    }
  };
}

/**
 * Generate a standardized dominated effect.
 * Dominated deals wisdom in psychic damage to Morale.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function dominated(actor, {ability="wisdom", amount, turns=3}={}) {
  amount ??= actor.getAbilityBonus(ability, 1);
  return {
    _id: getEffectId("Dominated"),
    name: _loc(CONFIG.statusEffects.dominated.name),
    img: "icons/magic/control/hypnosis-mesmerism-watch.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    statuses: ["dominated"],
    system: {
      dot: [{
        amount,
        damageType: "psychic",
        resource: "morale"
      }]
    }
  };
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
    name: _loc(CONFIG.statusEffects.poisoned.name),
    img: "icons/magic/unholy/orb-smoking-green.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    statuses: ["poisoned"],
    system: {
      dot: [{
        amount,
        damageType: "poison",
        resource: "health"
      }]
    }
  };
}

/**
 * Generate a standardized suffocating effect.
 * Suffocating deals void damage to both Wounds and Madness each round, representing physical lung trauma and panic
 * from being deprived of breathable air, and also silences the affected creature.
 * @param {CrucibleActor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function suffocating(actor, {amount=6, turns}={}) {
  return {
    _id: getEffectId("Suffocating"),
    name: _loc(CONFIG.statusEffects.suffocating.name),
    img: "icons/magic/water/vortex-water-whirlpool.webp",
    duration: turns ? {value: turns, units: "rounds", expiry: "turnStart"} : {},
    origin: actor?.uuid,
    statuses: ["suffocating", "silenced"],
    system: {
      dot: [{
        amount,
        damageType: "void",
        resource: "wounds"
      }, {
        amount,
        damageType: "void",
        resource: "madness"
      }]
    }
  };
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
    name: _loc(CONFIG.statusEffects.shocked.name),
    img: "icons/magic/lightning/bolt-strike-forked-blue.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    statuses: ["shocked"],
    system: {
      dot: [{
        amount,
        damageType: "electricity",
        resource: "morale"
      }]
    }
  };
}

/**
 * Generate a standardized staggered effect, applying the staggered status condition to the target.
 * @param {Actor} actor
 * @param {CrucibleDoTConfig} options
 * @returns {Partial<ActiveEffectData>}
 */
export function staggered(actor, {turns=1}={}) {
  return {
    _id: getEffectId("Staggered"),
    name: _loc(CONFIG.statusEffects.staggered.name),
    img: "icons/skills/melee/strike-hammer-destructive-orange.webp",
    duration: {value: turns, units: "rounds", expiry: "turnStart"},
    origin: actor?.uuid,
    statuses: ["staggered"]
  };
}

/**
 * Generate a standardized stunned effect, applying the stunned status condition to the target.
 * @param {Actor} actor
 * @param {{turns?: number}} [options]
 * @returns {Partial<ActiveEffectData>}
 */
export function stunned(actor, {turns=1}={}) {
  return {
    _id: getEffectId("Stunned"),
    name: _loc(CONFIG.statusEffects.stunned.name),
    img: "icons/svg/daze.svg",
    duration: {value: turns, units: "rounds", expiry: "turnEnd"},
    origin: actor?.uuid,
    statuses: ["stunned"]
  };
}

/**
 * Generate a standardized slowed effect, applying the slowed status condition to the target.
 * @param {Actor} actor
 * @param {{turns?: number}} [options]
 * @returns {Partial<ActiveEffectData>}
 */
export function slowed(actor, {turns=1}={}) {
  return {
    _id: getEffectId("Slowed"),
    name: _loc(CONFIG.statusEffects.slowed.name),
    img: "systems/crucible/icons/statuses/slowed.svg",
    duration: {value: turns, units: "rounds", expiry: "turnEnd"},
    origin: actor?.uuid,
    statuses: ["slowed"]
  };
}
