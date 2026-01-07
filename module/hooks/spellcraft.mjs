const HOOKS = {};

/* -------------------------------------------- */

HOOKS.aspect = {
  prepare() {
    this.usage.hasDice = false;

    // TODO enable aspect healing
    if ( this.damage.healing ) {
      console.warn("Gesture: Aspect is not configured for healing Runes yet");
      return
    }
  },
  postActivate(outcome) {

    // Configure active effect
    outcome.effects.push({
      _id: SYSTEM.EFFECTS.getEffectId("aspect"),
      name: this.name,
      icon: this.gesture.img,
      duration: {rounds: 6},
      origin: this.actor.uuid,
      changes: [
        {
          key: `system.resistances.${this.damage.type}.bonus`,
          value: 2,
          mode: CONST.ACTIVE_EFFECT_MODES.ADD
        },
        {
          key: `system.rollBonuses.damage.${this.damage.type}`,
          value: 2,
          mode: CONST.ACTIVE_EFFECT_MODES.ADD
        }
      ]
    });
  }
}

/* -------------------------------------------- */

HOOKS.aura = {
  prepare() {
    this.tags.add("maintained");
  },
  postActivate(outcome) {
    if ( !outcome.self ) return;
    const effectId = SYSTEM.EFFECTS.getEffectId(this.gesture.id);
    outcome.effects.push({
      _id: effectId,
      icon: this.img,
      name: this.name,
      system: {}
    });
  }
}

/* -------------------------------------------- */

HOOKS.conjure = {
  prepare() {
    this.tags.add("summon");
    this.usage.hasDice = false;
    
    // Configure summon data
    const summonUUIDs = SYSTEM.SPELL.GESTURE_SUMMONS[this.gesture.id];
    const actorUuid = summonUUIDs[this.rune.id] || summonUUIDs.fallback;
    const tokenData = {
      delta: {
        system: {
          details: {
            level: this.actor.system.advancement.threatLevel,
            rank: "minion"
          }
        }
      }
    };
    const effectId = SYSTEM.EFFECTS.getEffectId(this.gesture.id);
    this.usage.summons = [{actorUuid, tokenData, effectId}];
  },
  postActivate(outcome) {
    if ( !outcome.self ) return;
    const effectId = outcome.summons[0].effectId;
    outcome.effects.push({
      _id: effectId,
      icon: this.img,
      name: this.name,
      duration: {rounds: 12},
      system: {}
    });
  }
}

/* -------------------------------------------- */

HOOKS.create = {
  prepare() {
    HOOKS.conjure.prepare.call(this);
    const currDetails = this.usage.summons[0].tokenData.delta.system.details;
    currDetails.level = Math.ceil(currDetails.level / 2);
  },
  postActivate(outcome) {
    if ( !outcome.self ) return;
    HOOKS.conjure.postActivate.call(this, outcome);
    outcome.effects[0].duration.rounds = 6;
  }
}

/* -------------------------------------------- */

HOOKS.react = {
  prepare() {
    this.tags.add("reaction");
  }
}

/* -------------------------------------------- */

HOOKS.reshape = {
  prepare() {
    if ( this.damage.restoration ) this.target.scope = SYSTEM.ACTION.TARGET_SCOPES.ALLIES;
    else this.target.scope = SYSTEM.ACTION.TARGET_SCOPES.ENEMIES;
  }
}

/* -------------------------------------------- */

HOOKS.sense = {
  prepare() {
    HOOKS.aura.prepare.call(this);
  },
  postActivate(outcome) {
    HOOKS.aura.postActivate.call(this, outcome);
  }
}

/* -------------------------------------------- */

HOOKS.strike = {
  prepare() {
    const mh = this.actor.equipment.weapons.mainhand;
    this.scaling = mh.config.category.scaling.split(".");
    this.damage.base = mh.system.damage.base;
  }
}

/* -------------------------------------------- */

HOOKS.ward = {
  prepare() {
    this.usage.hasDice = false;

    // TODO: Enable healing wards
    if ( this.damage.healing ) {
      console.warn("Gesture: Ward is not configured for healing Runes yet");
      return
    }
  },
  postActivate(outcome) {
    
    // Configure Ward effect
    let resistance = this.gesture.damage.base;
    if ( this.actor.talentIds.has("runewarden000000") ) {
      resistance += Math.ceil(this.actor.abilities.wisdom.value / 2);
    }

    // Configure active effect
    outcome.effects.push({
      _id: SYSTEM.EFFECTS.getEffectId("ward"),
      name: this.name,
      icon: this.gesture.img,
      duration: {rounds: 1},
      origin: this.actor.uuid,
      changes: [
        {
          key: `system.resistances.${this.damage.type}.bonus`,
          value: resistance,
          mode: CONST.ACTIVE_EFFECT_MODES.ADD
        }
      ]
    });
  }
}

/* -------------------------------------------- */

export default HOOKS;
