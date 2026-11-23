import {recordPushMovement} from "./helpers.mjs";

const HOOKS = {};

/* -------------------------------------------- */

HOOKS.aspect = {
  prepare() {

    // Curse: Touch attack requiring dice roll
    if ( this.inflection?.id === "negate" ) {
      this.target = {type: "single", scope: SYSTEM.ACTION.TARGET_SCOPES.ALL};
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
      for ( const [_target, events] of this.eventsByTarget ) {
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
      _id: SYSTEM.EFFECTS.getEffectId("aspect"),
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
    this.regionBehavior = {}; // Being truthy means this will be prepared with appropriate default values
  },
  prepare() {
    // The initial cast is self-target no roll or damage
    this.usage.hasDice = false;
    this.damage.base = 0;
    this.target.scope = SYSTEM.ACTION.TARGET_SCOPES.SELF;

    // The region action resolves as a spell attack with scaling and damage based on its components
    const regionTags = ["spell"];
    if ( this.usage.restoration ) regionTags.push((this.rune.resource === "health") ? "healing" : "rallying");
    Object.assign(this.regionBehavior.system.action, {
      id: "spellAuraRegion",
      target: {scope: SYSTEM.ACTION.TARGET_SCOPES[this.usage.restoration ? "ALLIES" : "ENEMIES"]},
      spellcraft: {rune: this.rune.id, gesture: this.gesture.id, inflection: this.inflection?.id ?? "",
        damageType: this.damageType},
      tags: regionTags
    });
  },
  canUse() {
    if ( !this.actor.inCombat ) throw new Error(_loc("SPELL.WARNINGS.AuraRequiresCombat"));
  },
  postActivate() {
    const {effect} = this.selfEvents?.getPrimaryEffect() ?? {};
    if ( !effect ) return;
    effect.duration = {expiry: "combatEnd"};
  }
};

/* -------------------------------------------- */

HOOKS.conjure = {
  initialize() {
    this.tags.add("maintained");
  },
  prepare() {
    _prepareSummon.call(this, this.actor.system.advancement.level);
  },
  preActivate() {
    _recordSummonEffect.call(this, 12);
  }
};

/* -------------------------------------------- */

HOOKS.create = {
  prepare() {
    const {level} = this.actor.system.advancement;
    _prepareSummon.call(this, Math.min(level, Math.ceil(level / 2)));
  },
  preActivate() {
    _recordSummonEffect.call(this, 6);
  }
};

/* -------------------------------------------- */

HOOKS.life = {
  initialize() {
    if ( this.inflection?.id === "negate" ) this.usage.restoration = false;
    if ( (this.damageType === "poison") && this.composition ) {
      const {id, rune, gesture, inflection, nameFormat} = this;
      this.name = crucible.api.models.CrucibleSpellAction.getComposedName({id, rune, gesture, inflection, nameFormat,
        runeName: _loc("SPELL.RUNES.Blight"), runeAdjective: _loc("SPELL.RUNES.BlightAdj")});
    }
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
    this.target.scope = SYSTEM.ACTION.TARGET_SCOPES[this.usage.restoration ? "ALLIES" : "ENEMIES"];
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
    const {effect: trackingEffect} = this.selfEvents?.getPrimaryEffect() ?? {};
    if ( !trackingEffect ) return;
    trackingEffect.system.changes = [{
      key: "token.detectionModes.senseCreature",
      type: "override",
      value: {
        enabled: true,
        range: this.target.size
      }
    }];
    foundry.utils.setProperty(trackingEffect, "flags.crucible.runes", [this.rune.id]);
  }
};

/* -------------------------------------------- */

HOOKS.soul = {
  initialize() {
    if ( this.inflection?.id === "negate" ) this.usage.restoration = false;
    if ( (this.damageType === "void") && this.composition ) {
      const {id, rune, gesture, inflection, nameFormat} = this;
      this.name = crucible.api.models.CrucibleSpellAction.getComposedName({id, rune, gesture, inflection, nameFormat,
        runeName: _loc("SPELL.RUNES.Torment"), runeAdjective: _loc("SPELL.RUNES.TormentAdj")});
    }
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
    this.scaling = mh.system.scaling.split(".");
    this.damage.base = mh.system.damage.base;
    this.usage.strikes = [mh];
    this.usage.weaponRange = mh.system.range;
    this.range.maximum = (this.gesture.range.maximum ?? 0) + mh.system.range;
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
  const propertyPath = (this.rune.id === "kinesis") ? `kinesis.${this.damageType}` : this.rune.id;
  const actorUuid = foundry.utils.getProperty(summonUUIDs, propertyPath) || summonUUIDs.fallback;
  const family = this.rune.training;
  const tokenData = {
    delta: {
      system: {
        advancement: {
          level,
          rank: "minion"
        }
      },
      flags: {
        crucible: {
          summoner: {
            actor: this.actor.uuid,
            training: {[family]: this.actor.system.training[family].points}
          }
        }
      }
    }
  };
  const effectId = SYSTEM.EFFECTS.getEffectId(this.gesture.id);
  this.usage.summons = [{actorUuid, tokenData, effectId}];
}

/* -------------------------------------------- */

/**
 * Record the self effect which owns a summon spell's summoned creature for a duration in rounds.
 * Recorded before postActivate so that tags such as maintained can configure it as the primary effect.
 * @param {number} rounds
 */
function _recordSummonEffect(rounds) {
  const [{effectId}] = this.usage.summons;
  this.recordEvent({type: "effect", target: this.actor, effects: [{
    _id: effectId,
    img: this.img,
    name: this.name,
    duration: {rounds},
    system: {}
  }]});
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
    const distanceFeet = direction * baseFeet * (events.isCriticalSuccess ? 2 : 1);
    await recordPushMovement(this, target, casterToken.center, distanceFeet);
  }
}

/* -------------------------------------------- */

export default HOOKS;
