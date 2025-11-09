const HOOKS = {};

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

export default HOOKS;
