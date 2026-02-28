const HOOKS = {};

/* -------------------------------------------- */

/**
 * Prepare a summon spell action by configuring token data and tagging the action for summoning.
 * @param {number} level
 */
function prepareSummon(level) {
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

HOOKS.aspect = {
  prepare() {

    // Curse: Touch attack requiring dice roll
    if ( this.inflection?.id === "negate" ) {
      this.target = {type: "single", scope: SYSTEM.ACTION.TARGET_SCOPES.ENEMIES};
      this.tags.add("harmless");
      this.range = {maximum: 1}; // Touch
      this.usage.hasDice = true;
      return;
    } else this.usage.hasDice = false;

    // TODO enable aspect healing
    if ( this.damage.healing ) console.warn("Gesture: Aspect is not configured for healing Runes yet");
  },
  postActivate(outcome) {

    // Curse: Apply vulnerability
    if ( this.inflection?.id === "negate" ) {
      if ( outcome.self || !outcome.rolls.some(r => r.isSuccess) ) return;
      outcome.effects.push({
        _id: SYSTEM.EFFECTS.getEffectId(`curse${this.damage.type}`),
        name: this.name,
        img: this.rune.img,
        duration: {rounds: 6},
        origin: this.actor.uuid,
        system: {
          changes: [{
            key: `system.resistances.${this.damage.type}.bonus`,
            value: -2,
            type: "add"
          }]
        }
      });
      return;
    }

    // Standard Aspect: buff the caster
    if ( !outcome.self ) return;
    outcome.effects.push({
      _id: SYSTEM.EFFECTS.getEffectId(`aspect${this.damage.type}`),
      name: this.name,
      img: this.gesture.img,
      duration: {rounds: 6},
      origin: this.actor.uuid,
      system: {
        changes: [
          {
            key: `system.resistances.${this.damage.type}.bonus`,
            value: 2,
            type: "add"
          },
          {
            key: `system.rollBonuses.damage.${this.damage.type}`,
            value: 2,
            type: "add"
          }
        ]
      }
    });
  }
};

/* -------------------------------------------- */

HOOKS.aura = {
  prepare() {
    this.tags.add("maintained");
  },
  postActivate(outcome) {
    if ( !outcome.self ) return;
    outcome.effects.push({
      _id: SYSTEM.EFFECTS.getEffectId(this.gesture.id),
      img: this.img,
      name: this.name,
      system: {}
    });
  }
};

/* -------------------------------------------- */

HOOKS.conjure = {
  prepare() {
    prepareSummon.call(this, this.actor.system.advancement.threatLevel);
  },
  postActivate(outcome) {
    if ( !outcome.self ) return;
    outcome.effects.push({
      _id: outcome.summons[0].effectId,
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
    prepareSummon.call(this, Math.ceil(this.actor.system.advancement.threatLevel / 2));
  },
  postActivate(outcome) {
    if ( !outcome.self ) return;
    outcome.effects.push({
      _id: outcome.summons[0].effectId,
      img: this.img,
      name: this.name,
      duration: {rounds: 6},
      system: {}
    });
  }
};

/* -------------------------------------------- */

HOOKS.react = {
  prepare() {
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

HOOKS.sense = {
  prepare() {
    this.tags.add("maintained");
  },
  postActivate(outcome) {
    if ( !outcome.self ) return;
    outcome.effects.push({
      _id: SYSTEM.EFFECTS.getEffectId(this.gesture.id),
      img: this.img,
      name: this.name,
      system: {}
    });
  }
};

/* -------------------------------------------- */

HOOKS.step = {
  prepare() {
    this.target.size = this.actor.size;
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
  postActivate(outcome) {

    // Configure Ward resistance amount
    // TODO: Move into its own talent hook
    let resistance = this.gesture.damage.base;
    if ( this.actor.talentIds.has("runewarden000000") ) {
      resistance += Math.ceil(this.actor.abilities.wisdom.value / 2);
    }

    // Configure active effect
    outcome.effects.push({
      _id: SYSTEM.EFFECTS.getEffectId("ward"),
      name: this.name,
      img: this.gesture.img,
      duration: {rounds: 1},
      origin: this.actor.uuid,
      system: {
        changes: [
          {
            key: `system.resistances.${this.damage.type}.bonus`,
            value: resistance,
            type: "add"
          }
        ]
      }
    });
  }
};

/* -------------------------------------------- */

export default HOOKS;
