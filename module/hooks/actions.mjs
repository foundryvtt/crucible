const ACTION_HOOKS = {};

/* -------------------------------------------- */

ACTION_HOOKS.berserkStrike = {
  preActivate(_targets) {
    const health = this.actor.resources.health;
    const pct = health.value / health.max;
    let damageBonus = 0;
    if ( pct < 0.25 ) damageBonus = 3;
    else if ( pct < 0.5 ) damageBonus = 2;
    else if ( pct < 0.75 ) damageBonus = 1;
    if ( this.actor.equipment.weapons.twoHanded ) damageBonus *= 2;
    if ( damageBonus ) {
      this.usage.bonuses.damageBonus ||= 0;
      this.usage.bonuses.damageBonus += damageBonus;
    }
  }
}

/* -------------------------------------------- */

ACTION_HOOKS.delay = {
  canUse(_targets) {
    if ( game.combat?.combatant?.actor !== this.actor ) {
      throw new Error("You may only use the Delay action on your own turn in combat.");
    }
    if ( this.actor.flags.crucible?.delay ) {
      throw new Error("You may not delay your turn again this combat round.");
    }
  },
  displayOnSheet(combatant) {
    if ( !combatant || this.actor.flags.crucible?.delay || (game.combat.combatant !== combatant) ) return false;
    return game.combat.turn < (game.combat.turns.length - 1); // Not already last
  },
  async preActivate(targets) {
    const combatant = game.combat.getCombatantByActor(this.actor);
    const maximum = combatant.getDelayMaximum();
    const response = await Dialog.prompt({
      title: "Delay Turn",
      content: `<form class="delay-turn" autocomplete="off">
            <div class="form-group">
                <label>Delayed Initiative</label>
                <input name="initiative" type="number" min="1" max="${maximum}" step="1">
                <p class="hint">Choose an initiative value between 1 and ${maximum} when you wish to act.</p>
            </div>
        </form>`,
      label: "Delay",
      callback: dialog => dialog.find(`input[name="initiative"]`)[0].valueAsNumber,
      rejectClose: false
    });
    if ( response ) this.usage.initiativeDelay = response;
  },
  async confirm() {
    return this.actor.delay(this.usage.initiativeDelay);
  }
}

/* -------------------------------------------- */

ACTION_HOOKS.reactiveStrike = {
  canUse(_targets) {
    for ( const s of ["unaware", "flanked"] ) {
      if ( this.actor.statuses.has(s) ) throw new Error(`You may not perform a Reactive Strike while ${s}.`);
    }
  }
}

/* -------------------------------------------- */

ACTION_HOOKS.recover = {
  canUse(_targets) {
    if ( this.actor.inCombat ) throw new Error("You may not Recover during Combat.");
  },
  displayOnSheet(combatant) {
    return !combatant;
  },
  async confirm() {
    await this.actor.rest();
  }
}

/* -------------------------------------------- */

ACTION_HOOKS.refocus = {
  async confirm() {
    const self = this.outcomes.get(this.actor);
    const {mainhand: mh, offhand: oh} = this.actor.equipment.weapons
    const talisman = ["talisman1", "talisman2"].includes(mh.system.category) ? mh : oh;
    self.resources.focus = (self.resources.focus || 0) + talisman.system.config.category.hands;
  }
}

/* -------------------------------------------- */

ACTION_HOOKS.reload = {
  prepare() {
    const a = this.actor;
    const {reloaded} = a.system.status;
    if ( a.talentIds.has("pistoleer0000000") && !reloaded ) this.cost.action = 0; // TODO generalize
  },
  async postActivate() {
    this.usage.actorStatus.reloaded = true;
  }
}

/* -------------------------------------------- */

ACTION_HOOKS.ruthlessMomentum = {
  prepare() {
    if ( this.actor ) this.range.maximum = this.actor.system.movement.stride;
  }
}

/* -------------------------------------------- */

ACTION_HOOKS.strike = {
  async postActivate(outcome) {
    if ( outcome.rolls.some(r => !r.isCriticalFailure) ) {
      this.usage.actorStatus.basicStrike = true;
    }
  }
}

/* -------------------------------------------- */

export default ACTION_HOOKS;
