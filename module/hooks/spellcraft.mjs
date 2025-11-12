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

    // Configure active effect
    this.effects.push({
      _id: SYSTEM.EFFECTS.getEffectId("aspect"),
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

HOOKS.conjure = {
  prepare() {
    this.tags.add("summon");
    this.usage.hasDice = false;

    // Configure summon active effect
    let effectId = SYSTEM.EFFECTS.getEffectId(this.gesture.id);
    this.effects.push({_id: effectId, icon: this.img, duration: {rounds: 12}});

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
    this.usage.summons = [{actorUuid, tokenData, effectId}];
  }
}

/* -------------------------------------------- */

HOOKS.create = {
  prepare() {
    this.tags.add("summon");
    this.usage.hasDice = false;

    // Configure summon active effect
    let effectId = SYSTEM.EFFECTS.getEffectId(this.gesture.id);
    // TODO move to talent hook somehow
    if ( this.actor.talentIds.has("conjurer00000000") ) {
      const effectIds = Array.fromRange(1, 3).map(i => SYSTEM.EFFECTS.getEffectId(`conjurercreate${i}`));
      effectId = effectIds.find(id => !this.actor.effects.has(id)) || effectIds[0];
    }
    this.effects.push({_id: effectId, icon: this.img, duration: {rounds: 12}});

    // Configure summon data
    const summonUUIDs = SYSTEM.SPELL.GESTURE_SUMMONS[this.gesture.id];
    const actorUuid = summonUUIDs[this.rune.id] || summonUUIDs.fallback;
    const tokenData = {
      delta: {
        system: {
          details: {
            level: Math.ceil(this.actor.system.advancement.threatLevel / 2),
            rank: "minion"
          }
        }
      }
    };
    this.usage.summons = [{actorUuid, tokenData, effectId}];
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

    // Shield Ward
    // TODO move to talent hook somehow
    if ( this.actor.talentIds.has("shieldward000000") && this.actor.equipment.weapons.shield ) this.cost.hands = 0;

    // Configure Ward effect
    let resistance = this.gesture.damage.base;
    if ( this.actor.talentIds.has("runewarden000000") ) {
      resistance += Math.ceil(this.actor.abilities.wisdom.value / 2);
    }

    // Configure active effect
    this.effects.push({
      _id: SYSTEM.EFFECTS.getEffectId("ward"),
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
