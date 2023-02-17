
export function burning(actor, target) {
  return {
    label: "Burning",
    icon: "icons/magic/fire/projectile-smoke-swirl-red.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          id: "burning",
          health: actor.attributes.intellect.value,
          morale: actor.attributes.intellect.value,
          damageType: "fire"
        }
      }
    }
  }
}

export function chilled(actor, target) {
  return {
    label: "Chilled",
    icon: "icons/magic/water/orb-ice-web.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    statuses: ["slowed"],
    flags: {
      crucible: {
        dot: {
          id: "chilled",
          health: Math.floor(actor.attributes.intellect.value / 2),
          damageType: "frost"
        }
      }
    }
  }
}

export function corroding(actor, target) {
  return {
    label: "Corroding",
    icon: "icons/magic/earth/orb-stone-smoke-teal.webp",
    duration: {rounds: 3},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          id: "corroding",
          health: actor.attributes.intellect.value,
          damageType: "acid"
        }
      }
    }
  }
}

export function poisoned(actor, target) {
  return {
    label: "Poisoned",
    icon: "icons/magic/unholy/orb-smoking-green.webp",
    duration: {rounds: 6},
    origin: actor.uuid,
    flags: {
      crucible: {
        dot: {
          id: "poisoned",
          health: actor.attributes.intellect.value,
          damageType: "poison"
        }
      }
    }
  }
}

export function shocked(actor, target) {
  return {
    label: "Shocked",
    icon: "icons/magic/lightning/bolt-strike-forked-blue.webp",
    duration: {rounds: 1},
    origin: actor.uuid,
    statuses: ["staggered"],
    flags: {
      crucible: {
        dot: {
          id: "shocked",
          morale: Math.floor(actor.attributes.intellect.value / 2),
          damageType: "lightning"
        }
      }
    }
  }
}
