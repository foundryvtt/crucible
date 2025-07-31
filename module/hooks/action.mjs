const HOOKS = {};

/* -------------------------------------------- */

HOOKS.acidSpit = {
  postActivate(outcome) {
    if ( outcome.rolls.some(r => r.isCriticalSuccess) ) {
      const amount = this.actor.abilities.toughness.value;
      outcome.effects.push(SYSTEM.EFFECTS.corroding(this.actor, {amount}));
    }
  }
}

/* -------------------------------------------- */

HOOKS.acidSpray = {
  postActivate(outcome) {
    if ( outcome.rolls.some(r => r.isCriticalSuccess) ) {
      const amount = this.actor.abilities.toughness.value;
      outcome.effects.push(SYSTEM.EFFECTS.corroding(this.actor, {amount}));
    }
  }
}

/* -------------------------------------------- */

HOOKS.alchemistsFire = {
  prepare() {
    const tiers = {
      shoddy: {duration: 2, amount: 2},
      standard: {duration: 3, amount: 3},
      fine: {duration: 4, amount: 4},
      superior: {duration: 5, amount: 6},
      masterwork: {duration: 6, amount: 8},
    };
    const burning = SYSTEM.EFFECTS.burning(this.actor, tiers[this.item.system.quality]);
    foundry.utils.mergeObject(this.effects[0], burning);
  }
}

/* -------------------------------------------- */

HOOKS.assessStrength = {
  configure() {
    const targetCategory = this.acquireTargets({strict: false})[0]?.actor.system.details.taxonomy?.category;
    const skill = SYSTEM.ACTOR.CREATURE_CATEGORIES[targetCategory]?.knowledgeSkill;
    if (!skill) return;
    SYSTEM.ACTION.TAGS[skill]?.initialize.call(this);
  },
  async roll(outcome) {
    const skill = this.usage.skillId;
    if (!skill) return;
    await SYSTEM.ACTION.TAGS[skill]?.roll.call(this, outcome);
  }
}

/* -------------------------------------------- */

HOOKS.berserkStrike = {
  prepare() {
    const health = this.actor.resources.health;
    const pct = health.value / health.max;
    let damageBonus = 0;
    if ( pct < 0.25 ) damageBonus = 3;
    else if ( pct < 0.5 ) damageBonus = 2;
    else if ( pct < 0.75 ) damageBonus = 1;
    const weapon = this.usage.strikes[0];
    if ( weapon.config.category.hands === 2 ) damageBonus *= 2;
    if ( damageBonus ) {
      this.usage.bonuses.damageBonus ||= 0;
      this.usage.bonuses.damageBonus += damageBonus;
    }
  }
}

/* -------------------------------------------- */

HOOKS.blastFlask = {
  prepare() {
    this.target.size = {shoddy: 3, standard: 4, fine: 6, superior: 8, masterwork: 10}[this.item.system.quality];
  }
}

/* -------------------------------------------- */

HOOKS.delay = {
  canUse() {
    if ( game.combat?.combatant?.actor !== this.actor ) {
      throw new Error("You may only use the Delay action on your own turn in combat.");
    }
    if ( this.actor.flags.crucible?.delay ) {
      throw new Error("You may not delay your turn again this combat round.");
    }
  },
  // TODO refactor to roll()?
  async preActivate(targets) {
    const combatant = game.combat.getCombatantByActor(this.actor);
    const maximum = combatant.getDelayMaximum();
    // TODO refactor DialogV2.input
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

HOOKS.feintingStrike = {
  async roll(outcome) {
    this.usage.defenseType = "reflex";
    const deception = await this.actor.skillAttack(this, outcome);
    if ( deception.data.damage ) deception.data.damage.total = 0;
    if ( deception.isSuccess ) {
      this.usage.boons.feintingStrike = {label: "Feinting Strike", number: 2};
      this.usage.bonuses.damageBonus += 6;
    }
    const offhand = this.actor.equipment.weapons.offhand;
    this.usage.defenseType = "physical";
    const attack = await this.actor.weaponAttack(this, offhand, outcome);
    outcome.rolls.push(deception, attack);
  }
}

/* -------------------------------------------- */

HOOKS.healingElixir = {
  postActivate(outcome) {
    const quality = this.usage.consumable.config.quality;
    let amount = 6;
    for ( let i=1; i<=(quality.bonus+1); i++ ) amount *= 2;
    outcome.resources.health = (outcome.resources.health || 0) + amount;
  }
}

/* -------------------------------------------- */

HOOKS.healingTonic = {
  postActivate(outcome) {
    const quality = this.usage.consumable.config.quality;
    let amount = 2;
    for ( let i=1; i<=(quality.bonus+1); i++ ) amount *= 2;
    const effect = outcome.effects[0];
    effect._id = SYSTEM.EFFECTS.getEffectId(this.id);
    foundry.utils.setProperty(effect, "flags.crucible.dot.health", -amount);
    outcome.resources.health = (outcome.resources.health || 0) + amount;
  }
}

/* -------------------------------------------- */

HOOKS.intuitWeakness = {
  configure() {
    const targetCategory = this.acquireTargets({strict: false})[0]?.actor.system.details.taxonomy?.category;
    const skill = SYSTEM.ACTOR.CREATURE_CATEGORIES[targetCategory]?.knowledgeSkill;
    if (!skill) return;
    SYSTEM.ACTION.TAGS[skill]?.initialize.call(this);
  },
  async roll(outcome) {
    const skill = this.usage.skillId;
    if (!skill) return;
    await SYSTEM.ACTION.TAGS[skill]?.roll.call(this, outcome);
  }
}

/* -------------------------------------------- */

HOOKS.laughingMatter = {
  postActivate(outcome) {
    if ( outcome.target === this.actor ) return;
    const effect = outcome.effects[0];
    effect.changes ||= [];
    effect.changes.push(
      {key: "system.rollBonuses.banes.laughingMatter.number", mode: 5, value: 1},
      {key: "system.rollBonuses.banes.laughingMatter.label", mode: 5, value: this.name},
    );
  }
}

/* -------------------------------------------- */

HOOKS.oozeMultiply = {
  postActivate(outcome) {
    outcome.actorUpdates ||= {};
    const newSizeBonus = this.actor.system.movement.sizeBonus + 1;
    const healthAmount = this.actor.abilities.toughness.value;
    foundry.utils.setProperty(outcome.actorUpdates, "system.movement.sizeBonus", newSizeBonus);
    outcome.resources.health = (outcome.resources.health || 0) + healthAmount;
  }
}

/* -------------------------------------------- */

HOOKS.oozeSubdivide = {
  prepare() {
    const newHealth = Math.ceil(this.actor.system.resources.health.value / 2);
    const newSize = this.actor.system.movement.sizeBonus - 1;
    const systemData = {
      advancement: {
        rank: this.actor.system.advancement.rank === "minion" ? "minion" : "normal",
      },
      movement: {
        sizeBonus: newSize
      },
      resources: {
        health: {
          value: newHealth
        }
      }
    };

    // Configure summon
    this.usage.summons = [{
      actorUuid: this.actor.uuid,
      tokenData: {
        width: this.actor.size - 1,
        height: this.actor.size - 1,
        delta: {
          system: systemData
        }
      },
      permanent: true
    }];

    // Actor change
    foundry.utils.mergeObject(this.usage.actorUpdates, {system: systemData});
  },
  canUse() {
    if ( this.actor.size < 3 ) throw new Error(`You must be at least size 3 to use ${this.name}`);
  }
}

/* -------------------------------------------- */

HOOKS.pouncingStrike = {
  postActivate(outcome) {
    if ( !outcome.rolls.every(r => r.isCriticalSuccess) ) outcome.effects.length = 0;
  }
}

/* -------------------------------------------- */

HOOKS.selfRepair = {
  postActivate(outcome) {
    outcome.resources.health = this.actor.abilities.toughness.value;
  }
}

/* -------------------------------------------- */

HOOKS.spellband = {
  postActivate(outcome) {
    const enchantment = this.item.config.enchantment;
    const amount = 2 + (2 * enchantment.bonus);
    outcome.resources.focus = (outcome.resources.focus || 0) + amount;
  }
}

/* -------------------------------------------- */

HOOKS.swoopingStrike = {
  postActivate(outcome) {
    if ( !outcome.rolls.every(r => r.isCriticalSuccess) ) outcome.effects.length = 0;
  }
}

/* -------------------------------------------- */

HOOKS.rakingTalons = {
  initialize() {
    this.usage.weapon = this.actor.equipment.weapons.natural.find(w => w.system.identifier === "talons");
  },
  canUse() {
    if ( this.usage.weapon?.system.identifier !== "talons" ) {
      throw new Error("Must have a natural weapon identified as \"talons\" to use this action.");
    }
  },
}

/* -------------------------------------------- */

HOOKS.rallyingElixir = {
  postActivate(outcome) {
    const quality = this.usage.consumable.config.quality;
    let amount = 6;
    for ( let i=1; i<=(quality.bonus+1); i++ ) amount *= 2;
    outcome.resources.morale = (outcome.resources.morale || 0) + amount;
  }
}

/* -------------------------------------------- */

HOOKS.rallyingTonic = {
  postActivate(outcome) {
    const quality = this.usage.consumable.config.quality;
    let amount = 2;
    for ( let i=1; i<=(quality.bonus+1); i++ ) amount *= 2;
    const effect = outcome.effects[0];
    effect._id = SYSTEM.EFFECTS.getEffectId(this.id);
    foundry.utils.setProperty(effect, "flags.crucible.dot.morale", -amount);
    outcome.resources.morale = (outcome.resources.morale || 0) + amount;
  }
}

/* -------------------------------------------- */

HOOKS.reactiveStrike = {
  canUse() {
    for ( const s of ["unaware", "flanked"] ) {
      if ( this.actor.statuses.has(s) ) throw new Error(`You may not perform a Reactive Strike while ${s}.`);
    }
  }
}

/* -------------------------------------------- */

HOOKS.recover = {
  canUse() {
    if ( this.actor.inCombat ) throw new Error("You may not Recover during Combat.");
  },
  async confirm() {
    await this.actor.rest();
  }
}

/* -------------------------------------------- */

HOOKS.refocus = {
  async confirm() {
    const self = this.outcomes.get(this.actor);
    const {mainhand: mh, offhand: oh} = this.actor.equipment.weapons
    const talisman = ["talisman1", "talisman2"].includes(mh.system.category) ? mh : oh;
    self.resources.focus = (self.resources.focus || 0) + talisman.system.config.category.hands;
  }
}

/* -------------------------------------------- */

HOOKS.reload = {
  prepare() {
    const a = this.actor;
    const {reloaded} = a.system.status;
    if ( a.talentIds.has("pistoleer0000000") && !reloaded ) this.cost.action = 0; // TODO generalize
    this.usage.actorStatus.reloaded = true;
  }
}

/* -------------------------------------------- */

HOOKS.repercussiveBlock = {
  postActivate(outcome) {
    if ( outcome.target === this.actor ) return;
    if ( outcome.rolls.every(r => r.isSuccess) ) {
      const {mainhand} = outcome.target.equipment.weapons; // TODO - react to the prior action?
      if ( !mainhand?.id || mainhand.properties.has("natural") ) return;
      outcome.actorUpdates.items ||= [];
      outcome.actorUpdates.items.push({_id: mainhand.id, system: {dropped: true, equipped: false}});
      outcome.statusText.push({text: "Disarmed!", fontSize: 64});
    }
  }
}

/* -------------------------------------------- */

HOOKS.restrainingChomp = {
  postActivate(outcome) {
    if ( outcome.target.size > this.actor.size ) outcome.effects.length = 0;
  }
}

/* -------------------------------------------- */

HOOKS.ruthlessMomentum = {
  prepare() {
    if ( this.actor ) this.range.maximum = this.actor.system.movement.stride;
  }
}

/* -------------------------------------------- */

HOOKS.thrash = {
  preActivate(targets) {
    if ( targets.some(target => !target.actor?.statuses.has("restrained")) ) {
      throw new Error("You can only perform Thrash against a target that you have Restrained.");
    }
  }
}

/* -------------------------------------------- */

HOOKS.threadTheNeedle = {
  configure(targets) {
    for ( const {actor: target} of targets ) {
      const outcome = this.outcomes.get(target);
      outcome.usage.boons ||= {};
      if ( target.statuses.has("flanked") ) {
        const ae = target.effects.get(SYSTEM.EFFECTS.getEffectId("flanked"));
        outcome.usage.boons.flanked = {label: "Flanked", number: ae?.getFlag("crucible", "flanked") ?? 1};
      }
    }
  }
}

/* -------------------------------------------- */

HOOKS.uppercut = {
  preActivate(targets) {
    const lastAction = this.actor.lastConfirmedAction;
    if ( !lastAction.outcomes.has(targets[0].actor) ) {
      throw new Error(`${this.name} must attack the same target as the Strike which it follows.`);
    }
  }
}

/* -------------------------------------------- */

HOOKS.venomousBite = {
  postActivate(outcome) {
    if ( outcome.target === this.actor ) return;
    foundry.utils.mergeObject(outcome.effects[0], SYSTEM.EFFECTS.poisoned(this.actor));
  }
}

/* -------------------------------------------- */

export default HOOKS;
