import {planPushMovement} from "../canvas/movement.mjs";

const HOOKS = {};

/* -------------------------------------------- */

HOOKS.aspect = {
  prepare() {

    // Curse: Touch attack requiring dice roll
    if ( this.inflection?.id === "negate" ) {
      this.target = {type: "single", scope: SYSTEM.ACTION.TARGET_SCOPES.ENEMIES};
      this.tags.add("harmless");
      this.range = {maximum: 1}; // Touch
      this.usage.hasDice = true;
      return;
    }
    else this.usage.hasDice = false;

    // TODO enable aspect healing
    if ( this.damage.healing ) console.warn("Gesture: Aspect is not configured for healing Runes yet");
  },
  postActivate() {

    // Curse: Apply vulnerability to targets
    if ( this.inflection?.id === "negate" ) {
      for ( const [target, events] of this.eventsByTarget ) {
        const rollEvent = events.roll.find(e => e.roll.isSuccess);
        if ( !rollEvent ) continue;
        rollEvent.effects.push({
          _id: SYSTEM.EFFECTS.getEffectId(`curse${this.damage.type}`),
          name: this.name,
          img: this.rune.img,
          duration: {value: 6, units: "rounds", expiry: "turnEnd"},
          origin: this.actor.uuid,
          system: {
            changes: [{key: `system.resistances.${this.damage.type}.bonus`, value: -2, type: "add"}]
          }
        });
      }
      return;
    }

    // Standard Aspect: buff the caster
    this.recordEvent({type: "effect", effects: [{
      _id: SYSTEM.EFFECTS.getEffectId(`aspect${this.damage.type}`),
      name: this.name,
      img: this.gesture.img,
      duration: {value: 6, units: "rounds", expiry: "turnEnd"},
      origin: this.actor.uuid,
      system: {
        changes: [
          {key: `system.resistances.${this.damage.type}.bonus`, value: 2, type: "add"},
          {key: `system.rollBonuses.damage.${this.damage.type}`, value: 2, type: "add"}
        ]
      }
    }]});
  }
};

/* -------------------------------------------- */

HOOKS.aura = {
  initialize() {
    this.tags.add("maintained");
  }
};

/* -------------------------------------------- */

HOOKS.conjure = {
  prepare() {
    _prepareSummon.call(this, this.actor.system.advancement.threatLevel);
  },
  postActivate() {
    const summonEvent = this.events.find(e => e.type === "summon");
    if ( summonEvent ) summonEvent.effects.push({
      _id: summonEvent.summon.effectId,
      img: this.img,
      name: this.name,
      duration: {rounds: 12},
      system: {}
    });
  }
};

/* -------------------------------------------- */

HOOKS.create = {
  prepare() {
    _prepareSummon.call(this, Math.ceil(this.actor.system.advancement.threatLevel / 2));
  },
  postActivate() {
    const summonEvent = this.events.find(e => e.type === "summon");
    if ( summonEvent ) summonEvent.effects.push({
      _id: summonEvent.summon.effectId,
      img: this.img,
      name: this.name,
      duration: {rounds: 6},
      system: {}
    });
  }
};

/* -------------------------------------------- */

HOOKS.react = {
  initialize() {
    this.tags.add("reaction");
  }
};

/* -------------------------------------------- */

HOOKS.reshape = {
  prepare() {
    if ( this.damage.restoration ) this.target.scope = SYSTEM.ACTION.TARGET_SCOPES.ALLIES;
    else this.target.scope = SYSTEM.ACTION.TARGET_SCOPES.ENEMIES;
  }
};

/* -------------------------------------------- */

HOOKS.pull = {
  async postActivate() {
    await _inflectMovement.call(this, -1);
  }
};

/* -------------------------------------------- */

HOOKS.push = {
  async postActivate() {
    await _inflectMovement.call(this, 1);
  }
};

/* -------------------------------------------- */

HOOKS.sense = {
  initialize() {
    this.tags.add("maintained");
  },
  prepare() {
    this.usage.hasDice = false;
    this.usage.region.wallRestriction = false;
  },
  postActivate() {
    this.recordEvent({type: "effect", effects: [{
      _id: SYSTEM.EFFECTS.getEffectId(this.gesture.id),
      img: this.img,
      name: this.name,
      // TODO: Move this logic into token data prep
      system: {
        changes: [{
          key: "token.detectionModes.senseCreature",
          type: "override",
          value: {
            enabled: true,
            range: this.target.size
          }
        }]
      },
      flags: {
        crucible: {
          runes: [this.rune.id]
        }
      }
    }]});
  }
};

/* -------------------------------------------- */

HOOKS.step = {
  initialize() {
    this.tags.add("movement");
    this.tags.add("blink");
  }
};

/* -------------------------------------------- */

HOOKS.strike = {
  prepare() {
    const mh = this.actor.equipment.weapons.mainhand;
    this.scaling = mh.config.category.scaling.split(".");
    this.damage.base = mh.system.damage.base;
    this.usage.strikes = [mh];
  }
};

/* -------------------------------------------- */

HOOKS.ward = {
  prepare() {
    this.usage.hasDice = false;
    // TODO: Enable healing wards
    if ( this.damage.healing ) console.warn("Gesture: Ward is not configured for healing Runes yet");
  },
  postActivate() {

    // Configure Ward resistance amount
    // TODO: Move into its own talent hook
    let resistance = this.gesture.damage.base;
    if ( this.actor.talentIds.has("runewarden000000") ) {
      resistance += Math.ceil(this.actor.abilities.wisdom.value / 2);
    }

    // Configure active effect
    this.recordEvent({type: "effect", effects: [{
      _id: SYSTEM.EFFECTS.getEffectId("ward"),
      name: this.name,
      img: this.gesture.img,
      duration: {rounds: 1},
      origin: this.actor.uuid,
      system: {
        changes: [{key: `system.resistances.${this.damage.type}.bonus`, value: resistance, type: "add"}]
      }
    }]});
  }
};

/* -------------------------------------------- */
/*  Helper Functions                            */
/* -------------------------------------------- */

/**
 * Prepare a summon spell action by configuring token data and tagging the action for summoning.
 * @param {number} level
 */
function _prepareSummon(level) {
  this.tags.add("summon");
  this.usage.hasDice = false;

  // Configure summon data
  const summonUUIDs = SYSTEM.SPELL.GESTURE_SUMMONS[this.gesture.id];
  const actorUuid = summonUUIDs[this.rune.id] || summonUUIDs.fallback;
  const tokenData = {
    delta: {
      system: {
        details: {
          level,
          rank: "minion"
        }
      }
    }
  };
  const effectId = SYSTEM.EFFECTS.getEffectId(this.gesture.id);
  this.usage.summons = [{actorUuid, tokenData, effectId}];
}

/* -------------------------------------------- */

/**
 * Move spell-affected targets toward (pull) or away from (push) the caster as a free, forced movement.
 * Distance equals the spell's ability bonus in feet, doubled against a critically-hit target.
 * @param {-1|1} direction    1 to push affected targets away from the caster, -1 to pull them toward it
 */
async function _inflectMovement(direction) {
  const casterToken = this.token?.object;
  const baseFeet = this.usage.bonuses.ability;
  if ( !casterToken || (baseFeet <= 0) ) return;
  for ( const [target, events] of this.eventsByTarget ) {
    if ( target === this.actor ) continue;
    if ( this.usage.hasDice && !events.isSuccess ) continue; // Only creatures the spell affected
    const targetToken = this.targets.get(target)?.token?.object;
    if ( !targetToken ) continue;
    const distanceFeet = direction * baseFeet * (events.isCriticalSuccess ? 2 : 1);
    const minGap = (casterToken.w + targetToken.w) / 2; // Base-to-base contact, clamps a pull short of the caster
    const plan = await planPushMovement(casterToken.center, targetToken, distanceFeet, {minGap});
    if ( !plan ) continue;
    const origin = {x: plan.origin.x, y: plan.origin.y, elevation: plan.origin.elevation};
    this.recordEvent({type: "movement", target, movement: {id: plan.id, origin}});
  }
}

/* -------------------------------------------- */

export default HOOKS;
