const HOOKS = {};

/* -------------------------------------------- */

HOOKS.alchemistsFire = {
  preActivate() {
    const tiers = {
      shoddy: {turns: 2, amount: 2},
      standard: {turns: 3, amount: 3},
      fine: {turns: 4, amount: 4},
      superior: {turns: 5, amount: 6},
      masterwork: {turns: 6, amount: 8}
    };
    const burning = SYSTEM.EFFECTS.burning(this.actor, tiers[this.item.system.quality]);
    foundry.utils.mergeObject(this.effects[0], burning);
  }
};

/* -------------------------------------------- */

HOOKS.antitoxin = {
  async confirm(reverse) {
    if ( reverse ) return; // Eventually would be nice to store the removed toxin effects so this can be reversible
    const tiers = {shoddy: 3, standard: 5, fine: 7, superior: 9, masterwork: 11};
    const neutralizeAmount = tiers[this.item.system.quality];
    const targetSelf = this.outcomes.size === 1;
    for ( const outcome of this.outcomes.values() ) {
      if ( outcome.self && !targetSelf ) continue;
      const effectsToDelete = [];
      for ( const effect of outcome.target.effects ) {
        if ( !effect.statuses.has("poisoned") || !effect.system.dot?.length ) continue;
        const dot = effect.system.dot;
        const poisonAmount = dot.reduce((acc, {amount, damageType}) => acc + ((damageType === "poison") ? amount : 0), 0);
        if ( poisonAmount <= neutralizeAmount ) effectsToDelete.push(effect.id);
      }
      if ( effectsToDelete.length ) await outcome.target.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
    }
  }
};

/* -------------------------------------------- */

HOOKS.assessStrength = {
  configure(targets) {
    const target = targets[0]?.actor;
    if ( !target ) return;
    const targetCategory = SYSTEM.ACTOR.CREATURE_CATEGORIES[target.system.details.taxonomy?.category];
    if ( !targetCategory ) return;
    const {skill, knowledge} = targetCategory;
    SYSTEM.ACTION.TAGS[skill]?.initialize.call(this);
    this.usage.dc = SYSTEM.PASSIVE_BASE + target.level;
    if ( this.actor.hasKnowledge(knowledge) ) {
      const knowledgeLabel = crucible.CONFIG.knowledge[knowledge].label;
      this.usage.boons.assessStrength = {label: game.i18n.format("ACTOR.KnowledgeSpecific", {knowledge: knowledgeLabel}), number: 2};
    }
  },
  async roll(outcome) {
    const skill = this.usage.skillId;
    if ( !skill ) return;
    await SYSTEM.ACTION.TAGS[skill]?.roll.call(this, outcome);
  }
};

/* -------------------------------------------- */

// TODO: Consider refactoring this talent to instead be a maintained action
HOOKS.beastShapeRevert = {
  async confirm(reverse) {
    const effect = this.actor.effects.get(SYSTEM.EFFECTS.getEffectId("beastShape"));
    await effect.delete();
  }
};

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
};

/* -------------------------------------------- */

HOOKS.bindArmament = {
  canUse() {
    const boundArmamentId = this.actor.getFlag("crucible", this.id);
    const mainhandId = this.actor.equipment.weapons.mainhand.id;
    if ( !mainhandId ) throw new Error("no mainhand weapon");
    else if ( mainhandId === boundArmamentId ) throw new Error("weapon is already bound");
  },
  preActivate() {
    const mainhandId = this.actor.equipment.weapons.mainhand.id;
    if ( !mainhandId ) return;
    foundry.utils.mergeObject(this.usage.actorUpdates, {
      [`flags.crucible.${this.id}`]: mainhandId
    });
  }
};

/* -------------------------------------------- */

HOOKS.blastFlask = {
  prepare() {
    this.target.size = {shoddy: 3, standard: 4, fine: 6, superior: 8, masterwork: 10}[this.item.system.quality];
  }
};

/* -------------------------------------------- */

HOOKS.bodyBlock = {
  canUse() {
    const targetAction = ChatMessage.implementation.getLastAction();
    for ( const outcome of targetAction.outcomes.values() ) {
      if ( outcome.target.uuid !== this.actor.uuid ) continue;
      if ( !targetAction.tags.has("melee") ) {
        throw new Error("You may only use Body Block against an incoming melee attack.");
      }
      if ( targetAction.message.flags.crucible.confirmed ) {
        throw new Error("The attack against you has already been confirmed and can no longer be blocked.");
      }
      const results = game.system.api.dice.AttackRoll.RESULT_TYPES;
      for ( const r of outcome.rolls ) {
        if ( [results.ARMOR, results.GLANCE].includes(r.data.result) ) {
          // TODO: Amend (or remove) as necessary
          this.usage.targetAction = targetAction.message.id;
          return true;
        }
      }
    }
    throw new Error("You may only use Body Block after an attack against you is defended by Armor or Glance.");
  }
};

/* -------------------------------------------- */

HOOKS.causticPhial = {
  prepare() {
    const tiers = {
      shoddy: {turns: 2, amount: 2},
      standard: {turns: 3, amount: 3},
      fine: {turns: 4, amount: 4},
      superior: {turns: 5, amount: 6},
      masterwork: {turns: 6, amount: 8}
    };
    const corroding = SYSTEM.EFFECTS.corroding(this.actor, tiers[this.item.system.quality]);
    foundry.utils.mergeObject(this.effects[0], corroding);
  }
};

/* -------------------------------------------- */

HOOKS.chokingAmpoule = {
  preActivate(_targets) {
    const damage = {shoddy: 2, standard: 6, fine: 12, superior: 20, masterwork: 30};
    const poisoned = SYSTEM.EFFECTS.poisoned(this.actor, {turns: 3, amount: damage[this.item.system.quality]});
    poisoned.system.dot[0].resource = "morale";
    foundry.utils.mergeObject(this.effects[0], poisoned);
  },
  postActivate(outcome) {
    if ( outcome.self ) return;
    if ( outcome.rolls[0].isCriticalSuccess ) outcome.effects[0].statuses.push("silenced");
  }
};

/* -------------------------------------------- */

HOOKS.clarifyIntent = {
  async postActivate(outcome) {
    const roll = outcome.rolls[0];
    if ( roll?.isSuccess ) {
      roll.data.damage.multiplier = 0;
      roll.data.damage.base = roll.data.damage.total = 1;
      roll.data.damage.resource = "focus";
    }
    const effect = outcome.effects[0];
    if ( !effect ) return;
    effect.system.changes ||= [];
    effect.system.changes.push(
      {key: "system.rollBonuses.boons.clarifyIntent.number", type: "override", value: 1},
      {key: "system.rollBonuses.boons.clarifyIntent.label", type: "override", value: this.name}
    );
  }
};

/* -------------------------------------------- */

HOOKS.conjureArmament = {
  canUse() {
    const boundArmamentId = this.actor.getFlag("crucible", this.id);
    const weapon = this.items.get(boundArmamentId);
    if ( !weapon || weapon.equipped ) return false;
    this.canEquipWeapon(weapon);
  }
};

/* -------------------------------------------- */

HOOKS.counterspell = {
  initialize() {
    Object.assign(this.usage.context, {
      label: game.i18n.localize("SPELL.COUNTERSPELL.Tags"),
      icon: "fa-solid fa-sparkles",
      tags: {}
    });
    if ( this.composition === 0 ) return;
    const none = game.i18n.localize("None");
    this.usage.context.tags.rune = game.i18n.format("SPELL.COMPONENTS.RuneSpecific", {rune: this.rune?.name ?? none});
    this.usage.context.tags.gesture = game.i18n.format("SPELL.COMPONENTS.GestureSpecific", {gesture: this.gesture?.name ?? none});
  },
  async roll(outcome) {
    // TODO: Only use this.usage.targetAction
    const targetAction = this.usage.targetAction ?? ChatMessage.implementation.getLastAction();
    const {gesture: usedGesture, rune: usedRune} = targetAction;
    if ( this.rune.id === usedRune?.opposed ) {
      this.usage.boons.counterspellRune = {label: game.i18n.localize("SPELL.COUNTERSPELL.OpposingRune"), number: 2};
    }
    if ( this.gesture.id === usedGesture?.id ) {
      this.usage.boons.counterspellGesture = {label: game.i18n.localize("SPELL.COUNTERSPELL.SameGesture"), number: 2};
    }
    if ( !targetAction.message ) {
      const dc = this.usage.dc;
      const rollData = {
        actorId: this.actor.id,
        banes: {...this.actor.system.rollBonuses.banes, ...this.usage.banes},
        boons: {...this.actor.system.rollBonuses.boons, ...this.usage.boons},
        dc,
        ability: this.usage.bonuses.ability,
        skill: this.usage.bonuses.skill,
        enchantment: this.usage.bonuses.enchantment
      };
      this.actor.callActorHooks("prepareStandardCheck", rollData);
      const roll = await new crucible.api.dice.StandardCheck(rollData).evaluate();
      if ( roll ) outcome.rolls.push(roll);
    } else {
      outcome.usage.defenseType = "willpower"; // Maybe changed later
      const roll = await this.actor.spellAttack(this, outcome);
      if ( roll ) outcome.rolls.push(roll);
    }
  },
  async confirm(reverse) {
    if ( this.outcomes.size === 1 ) return;
    const targetActor = this.outcomes.keys().find(a => a !== this.actor);
    const isSuccess = this.outcomes.get(targetActor)?.rolls[0]?.isSuccess;
    if ( !isSuccess ) return;
    // TODO: Fetch this ID from action instead of message flag
    const targetMessage = game.messages.get(this.message?.getFlag("crucible", "targetMessageId"));
    if ( !targetMessage ) return;
    if ( targetMessage.getFlag("crucible", "confirmed") !== reverse ) {
      const desiredChange = game.i18n.localize(`DICE.${reverse ? "Reverse" : "Confirm"}`);
      const problemState = game.i18n.localize(`ACTION.${reverse ? "Unconfirmed" : "Confirmed"}`);
      const errorText = `Cannot ${desiredChange} a counterspell if the targeted spell is already ${problemState}!`;
      ui.notifications.warn(errorText);
      throw new Error(errorText);
    }
    const setNegated = () => targetMessage.setFlag("crucible", "isNegated", !reverse);
    if ( !reverse ) await setNegated();
    await crucible.api.models.CrucibleAction.confirmMessage(targetMessage, {reverse});
    if ( reverse ) await setNegated();
  }
};

/* -------------------------------------------- */

HOOKS.decisiveAction = {
  postActivate(outcome) {
    const amount = Math.ceil(this.actor.abilities.intellect.value / 2);
    outcome.resources.action = (outcome.resources.action || 0) + amount;
  }
};

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
    const response = await foundry.applications.api.DialogV2.prompt({
      window: { title: "ACTION.DelayTitle" },
      content: `<form class="delay-turn" autocomplete="off">
            <div class="form-group">
                <label>${game.i18n.localize("ACTION.DelayLabel")}</label>
                <input name="initiative" type="number" min="1" value="${maximum - 1}" max="${maximum}" step="1">
                <p class="hint">${game.i18n.format("ACTION.DelayHint", {maximum})}</p>
            </div>
        </form>`,
      ok: {
        label: this.name,
        callback: (event, button, dialog) => button.form.elements.initiative.valueAsNumber
      },
      rejectClose: false
    });
    if ( response ) this.outcomes.get(this.actor).metadata.initiativeDelay = response;
  },
  async confirm() {
    return this.actor.delay(this.outcomes.get(this.actor).metadata.initiativeDelay);
  }
};

/* -------------------------------------------- */

HOOKS.distract = {
  postActivate(outcome) {
    for ( const r of outcome.rolls ) {
      if ( r.isSuccess ) {
        r.data.damage.multiplier = 0;
        r.data.damage.base = r.data.damage.total = 1;
        r.data.damage.resource = "focus";
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.feintingStrike = {
  async roll(outcome) {
    outcome.rolls.shift();
    const deception = outcome.rolls[0];
    if ( deception.data.damage ) deception.data.damage.total = 0;
    if ( deception.isSuccess ) {
      outcome.usage.boons.feintingStrike = {label: this.name, number: 2};
      this.usage.bonuses.damageBonus += 6;
    }
    const offhand = this.actor.equipment.weapons.offhand;
    outcome.usage.defenseType = "physical";
    const attack = await this.actor.weaponAttack(this, offhand, outcome);
    outcome.rolls.push(attack);
  }
};

/* -------------------------------------------- */

HOOKS.fontOfLife = {
  postActivate(outcome) {
    if ( outcome.self ) return;
    const amount = this.actor.abilities.wisdom.value;
    const effect = outcome.effects[0];
    effect.system.dot = [{
      amount,
      resource: "health",
      restoration: true
    }];
    outcome.resources.health = (outcome.resources.health || 0) + amount;
  }
};

/* -------------------------------------------- */

HOOKS.healingElixir = {
  postActivate(outcome) {
    if ( !outcome.isTarget ) return;
    const quality = this.usage.consumable.config.quality;
    let amount = 6;
    for ( let i=1; i<=(quality.bonus+1); i++ ) amount *= 2;
    outcome.resources.health = (outcome.resources.health || 0) + amount;
  }
};

/* -------------------------------------------- */

HOOKS.healingTonic = {
  postActivate(outcome) {
    if ( !outcome.isTarget ) return;
    const quality = this.usage.consumable.config.quality;
    let amount = 2;
    for ( let i=1; i<=(quality.bonus+1); i++ ) amount *= 2;
    const effect = outcome.effects[0];
    effect._id = SYSTEM.EFFECTS.getEffectId(this.id);
    effect.system.dot = [{
      amount,
      resource: "health",
      restoration: true
    }];
    outcome.resources.health = (outcome.resources.health || 0) + amount;
  }
};

/* -------------------------------------------- */

HOOKS.inspireHeroism = {
  preActivate() {
    const effect = this.effects[0];
    effect.system.changes ||= [];
    effect.system.changes.push(
      {key: "system.rollBonuses.boons.inspireHeroism.number", type: "override", value: 1},
      {key: "system.rollBonuses.boons.inspireHeroism.label", type: "override", value: this.name}
    );
  }
};

/* -------------------------------------------- */

HOOKS.intuitWeakness = {
  configure(targets) {
    const target = targets[0]?.actor;
    if ( !target ) return;
    const targetCategory = SYSTEM.ACTOR.CREATURE_CATEGORIES[target.system.details.taxonomy?.category];
    if ( !targetCategory ) return;
    const {skill, knowledge} = targetCategory;
    SYSTEM.ACTION.TAGS[skill]?.initialize.call(this);
    this.usage.dc = SYSTEM.PASSIVE_BASE + target.level;
    if ( this.actor.hasKnowledge(knowledge) ) {
      const knowledgeLabel = crucible.CONFIG.knowledge[knowledge].label;
      this.usage.boons.intuitWeakness = {label: game.i18n.format("ACTOR.KnowledgeSpecific", {knowledge: knowledgeLabel}), number: 2};
    }
  },
  async roll(outcome) {
    const skill = this.usage.skillId;
    if ( !skill ) return;
    await SYSTEM.ACTION.TAGS[skill]?.roll.call(this, outcome);
  }
};

/* -------------------------------------------- */

HOOKS.laughingMatter = {
  postActivate(outcome) {
    if ( outcome.target === this.actor ) return;
    const effect = outcome.effects[0];
    effect.system.changes ||= [];
    effect.system.changes.push(
      {key: "system.rollBonuses.banes.laughingMatter.number", type: "override", value: 1},
      {key: "system.rollBonuses.banes.laughingMatter.label", type: "override", value: this.name}
    );
  }
};

/* -------------------------------------------- */

HOOKS.lastStand = {
  postActivate(outcome) {
    outcome.resources.health ||= 0;
    outcome.resources.health += (this.actor.abilities.toughness.value * 2);
    const effect = outcome.effects[0];
    if ( !effect ) return;
    effect.system.changes ||= [];
    effect.system.changes.push(
      {key: "system.defenses.wounds.bonus", type: "add", value: 2}
    );
  }
};

/* -------------------------------------------- */

HOOKS.lifebloom = {
  confirm(reverse) {
    const wisdom = this.actor.system.abilities.wisdom.value;
    const lifebloomEffect = {
      _id: "lifebloom0000000",
      name: this.name,
      img: this.img,
      origin: this.actor.uuid,
      duration: {turns: 6},
      system: {
        dot: [{
          amount: wisdom,
          resource: "health",
          restoration: true
        }, {
          amount: wisdom,
          resource: "morale",
          restoration: true
        }]
      }
    };
    for ( const outcome of this.outcomes.values() ) {
      outcome.effects.push(lifebloomEffect);
    }
  }
};

/* -------------------------------------------- */

HOOKS.executionersStrike = {
  prepare() {
    const weapon = this.actor.equipment.weapons.mainhand;
    const bleeding = SYSTEM.EFFECTS.bleeding(this.actor, {
      ability: "strength",
      damageType: weapon.system.damageType
    });
    this.effects[0] = foundry.utils.mergeObject(bleeding, this.effects[0]);
  }
};

/* -------------------------------------------- */

HOOKS.extollDeeds = {
  confirm(reverse) {
    for ( const outcome of this.outcomes.values() ) {
      if ( outcome.self ) continue;
      outcome.resources.morale = Math.ceil(this.actor.system.abilities.presence.value / 2);
    }
  }
};

/* -------------------------------------------- */

HOOKS.hamstring = {
  canUse() {
    const mh = this.actor.equipment.weapons.mainhand;
    const oh = this.actor.equipment.weapons.offhand;
    if ( ![mh.system.damageType, oh.system.damageType].includes("slashing") ) {
      throw new Error(`${this.name} requires a melee weapon which deals slashing damage.`);
    }
  },
  preActivate(targets) {
    if ( this.usage.weapon.system.damageType !== "slashing" ) {
      throw new Error(`${this.name} requires a melee weapon which deals slashing damage.`);
    }
  }
};

/* -------------------------------------------- */

HOOKS.intercept = {
  prepare() {
    if ( this.actor ) {
      this.range.maximum = this.actor.system.movement.stride;
    }
  }
};

/* -------------------------------------------- */

HOOKS.medicinalCompound = {
  preActivate(targets) {
    const defenses = targets[0].actor.system.defenses;
    this.usage.defenseType = defenses.wounds.total >= defenses.madness.total ? "wounds" : "madness";
  },
  postActivate(outcome) {
    if ( outcome.self || outcome.rolls[0].isFailure ) return;
    const dmg = outcome.rolls[0].data.damage.total;
    outcome.resources.health = dmg;
    const amount = Math.ceil(dmg / 2);
    outcome.effects[0].system.dot.push(
      {amount, resource: "health", restoration: true},
      {amount, resource: "morale", restoration: true}
    );
  }
};

/* -------------------------------------------- */

HOOKS.oozeMultiply = {
  postActivate(outcome) {
    outcome.actorUpdates ||= {};
    const newSizeBonus = this.actor.system.movement.sizeBonus + 1;
    const healthAmount = this.actor.abilities.toughness.value;
    foundry.utils.setProperty(outcome.actorUpdates, "system.movement.sizeBonus", newSizeBonus);
    outcome.resources.health = (outcome.resources.health || 0) + healthAmount;
  }
};

/* -------------------------------------------- */

HOOKS.oozeSubdivide = {
  prepare() {
    const newHealth = Math.ceil(this.actor.system.resources.health.value / 2);
    const newSize = this.actor.system.movement.sizeBonus - 1;
    const systemData = {
      advancement: {
        rank: this.actor.system.advancement.rank === "minion" ? "minion" : "normal"
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
};

/* -------------------------------------------- */

HOOKS.paralyticIngest = {
  preActivate() {
    const poison = this.effects[0];
    const turns = {shoddy: 1, standard: 2, fine: 4, superior: 8, masterwork: null};
    poison.duration.turns = turns[this.item.system.quality];
    poison.system.dot.length = 0;
  }
};

/* -------------------------------------------- */

HOOKS.poisonIngest = {
  preActivate(_targets) {
    const tiers = {
      shoddy: {amount: 2, turns: 4},
      standard: {amount: 4, turns: 6},
      fine: {amount: 6, turns: 8},
      superior: {amount: 8, turns: 10},
      masterwork: {amount: 10, turns: 12}
    };
    const poisoned = SYSTEM.EFFECTS.poisoned(this.actor, tiers[this.item.system.quality]);
    foundry.utils.mergeObject(this.effects[0], poisoned);
  }
};

/* -------------------------------------------- */

HOOKS.rallyingCry = {
  postActivate(outcome) {
    const amount = this.actor.abilities.presence.value;
    outcome.resources.morale = (outcome.resources.morale || 0) + amount;
  }
};

/* -------------------------------------------- */

HOOKS.rallyingElixir = {
  postActivate(outcome) {
    if ( !outcome.isTarget ) return;
    const quality = this.usage.consumable.config.quality;
    let amount = 6;
    for ( let i=1; i<=(quality.bonus+1); i++ ) amount *= 2;
    outcome.resources.morale = (outcome.resources.morale || 0) + amount;
  }
};

/* -------------------------------------------- */

HOOKS.rallyingTonic = {
  postActivate(outcome) {
    if ( !outcome.isTarget ) return;
    const quality = this.usage.consumable.config.quality;
    let amount = 2;
    for ( let i=1; i<=(quality.bonus+1); i++ ) amount *= 2;
    const effect = outcome.effects[0];
    effect._id = SYSTEM.EFFECTS.getEffectId(this.id);
    effect.system.dot = [{
      amount,
      resource: "morale",
      restoration: true
    }];
    outcome.resources.morale = (outcome.resources.morale || 0) + amount;
  }
};

/* -------------------------------------------- */

HOOKS.reactiveStrike = {
  canUse() {
    for ( const s of ["unaware", "flanked"] ) {
      if ( this.actor.statuses.has(s) ) throw new Error(`You may not perform a Reactive Strike while ${s}.`);
    }
  }
};

/* -------------------------------------------- */

HOOKS.readScroll = {
  prepare() {
    this.name = `Read ${this.item.name}`;
  },
  canUse() {
    const {runes, gestures, inflections} = this.item.system.scroll;
    if ( !runes.size && !gestures.size && !inflections.size ) {
      throw new Error(game.i18n.localize("CONSUMABLE.SCROLL.NoComponents"));
    }
  },
  async postActivate(outcome) {
    if ( !outcome.self ) return;
    const {runes, gestures, inflections} = this.item.system.scroll;
    const changes = [];
    for ( const rune of runes ) {
      changes.push({key: "system.grimoire.runeIds", type: "add", value: rune});
      changes.push({key: `system.training.${rune}`, type: "upgrade", value: 1});
    }
    for ( const gesture of gestures ) {
      changes.push({key: "system.grimoire.gestureIds", type: "add", value: gesture});
    }
    for ( const inflection of inflections ) {
      changes.push({key: "system.grimoire.inflectionIds", type: "add", value: inflection});
    }
    Object.assign(outcome.effects[0], {
      origin: this.item.uuid,
      duration: {seconds: 600},
      system: {changes}
    });
  }
};

/* -------------------------------------------- */

HOOKS.recover = {
  async confirm() {
    await this.actor.recover();
  }
};

/* -------------------------------------------- */

HOOKS.refocus = {
  canUse() {
    const {mainhand: mh, offhand: oh} = this.actor.equipment.weapons;
    const categories = ["talisman1", "talisman2"];
    return categories.includes(mh.category) || (oh && categories.includes(oh.category));
  },
  preActivate(_targets) {
    if ( !["talisman1", "talisman2"].includes(this.usage.weapon?.category) ) {
      throw new Error(`${this.name} requires use of a Talisman weapon.`);
    }
  },
  async confirm() {
    const self = this.outcomes.get(this.actor);
    const talisman = this.usage.weapon;
    const r = self.rolls[0];
    let focus = 0;
    if ( r.isSuccess ) focus += talisman.config.category.hands;
    if ( r.isCriticalSuccess ) focus += 1;
    self.resources.focus = focus;
  }
};

/* -------------------------------------------- */

HOOKS.reload = {
  prepare() {
    const a = this.actor;
    const {reloaded} = a.system.status;
    if ( a.talentIds.has("pistoleer0000000") && !reloaded ) this.cost.action = 0; // TODO generalize
    this.usage.actorStatus.reloaded = true;
  }
};

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
};

/* -------------------------------------------- */

HOOKS.rest = {
  async confirm() {
    await this.actor.rest();
  }
};

/* -------------------------------------------- */

HOOKS.restrainingChomp = {
  postActivate(outcome) {
    if ( outcome.target.size > this.actor.size ) outcome.effects.length = 0;
  }
};

/* -------------------------------------------- */

// TODO: consider moving scaling & bonuses logic into iconicSpell tag hook
HOOKS.revive = {
  prepare() {
    this.usage.hasDice = true;
    const runeScaling = this.parent.runes.map(r => SYSTEM.SPELL.RUNES[r].scaling);
    const gestureScaling = this.parent.gestures.map(g => SYSTEM.SPELL.GESTURES[g].scaling);
    this.scaling = Array.from(runeScaling.union(gestureScaling));
    this.usage.bonuses.ability = this.actor.getAbilityBonus(this.scaling);
  },
  acquireTargets(targets) {
    for ( const target of targets ) {
      if ( !target.actor.system.isDead ) target.error ??= `${this.name} requires a Dead target.`;
    }
  },
  async roll(outcome) {
    const roll = await this.actor.skillAttack(this, outcome);
    if ( roll ) outcome.rolls.push(roll);
  },
  postActivate(outcome) {
    if ( !outcome.self && outcome.rolls[0].isSuccess ) {
      SYSTEM.ACTION.TAGS.harmless.postActivate(outcome);
      outcome.resources = {
        wounds: -this.actor.system.abilities.wisdom.value
      };
    }
  }
};

/* -------------------------------------------- */

HOOKS.ruthlessMomentum = {
  prepare() {
    if ( this.actor ) this.range.maximum = this.actor.system.movement.stride;
  }
};

/* -------------------------------------------- */

HOOKS.secondWind = {
  confirm(reverse) {
    const self = this.outcomes.get(this.actor);
    self.resources.health = (self.resources.health || 0) + this.actor.system.abilities.toughness.value;
  }
};

/* -------------------------------------------- */

HOOKS.selfRepair = {
  postActivate(outcome) {
    outcome.resources.health = this.actor.abilities.toughness.value;
  }
};

/* -------------------------------------------- */

HOOKS.spellband = {
  postActivate(outcome) {
    const enchantment = this.item.config.enchantment;
    const amount = 2 + (2 * enchantment.bonus);
    outcome.resources.focus = (outcome.resources.focus || 0) + amount;
  }
};

/* -------------------------------------------- */

HOOKS.tailSweep = {
  canUse() {
    return this.usage.weapon.system.identifier === "tail";
  },
  initialize() {
    this.usage.weapon = this.actor.equipment.weapons.natural.find(w => w.system.identifier === "tail");
  }
};

/* -------------------------------------------- */

HOOKS.telecognition = {
  prepare() {
    this.usage.hasDice = true;
  },
  async roll(outcome) {
    const roll = await this.actor.skillAttack(this, outcome);
    if ( roll ) outcome.rolls.push(roll);
  }
};

/* -------------------------------------------- */

HOOKS.thrash = {
  acquireTargets(targets) {
    for ( const target of targets ) {
      if ( !target.actor.statuses.has("restrained") ) target.error ??= `You can only perform ${this.name} against a target that you have Restrained.`;
    }
  }
};

/* -------------------------------------------- */

HOOKS.threadTheNeedle = {
  configure(targets) {
    for ( const {actor: target} of targets ) {
      const outcome = this.outcomes.get(target);
      outcome.usage.boons ||= {};
      if ( target.statuses.has("flanked") ) {
        const ae = target.effects.get(SYSTEM.EFFECTS.getEffectId("flanked"));
        outcome.usage.boons.flanked = {label: game.i18n.localize("ACTIVE_EFFECT.STATUSES.Flanked"), number: ae?.system.flanked ?? 1};
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.steelJawTrigger = {
  prepare() {
    const tiers = {shoddy: 1, standard: 2, fine: 4, superior: 8, masterwork: 16};
    this.usage.bonuses.damageBonus = tiers[this.item.system.quality];
  }
};

/* -------------------------------------------- */

HOOKS.tramplingCharge = {
  prepare() {
    this.target.size = this.actor.size;
    this.range.maximum = this.actor.system.movement.stride * 2;
  },
  postActivate(outcome) {
    if ( outcome.self ) return;
    const halfSize = Math.ceil(this.actor.size / 2);
    const targetSize = outcome.target.size;
    if ( targetSize > halfSize ) outcome.effects.length = 0;
  }
};

/* -------------------------------------------- */

HOOKS.tuskCharge = {
  prepare() {
    this.range.maximum = this.actor.system.movement.stride;
  }
};

/* -------------------------------------------- */

HOOKS.unshakeablePoise = {
  postActivate(outcome) {
    outcome.resources.focus = (outcome.resources.focus || 0) + this.actor.abilities.wisdom.value;
  }
};

/* -------------------------------------------- */

HOOKS.uppercut = {
  acquireTargets(targets) {
    const lastAction = this.actor.lastConfirmedAction;
    for ( const target of targets ) {
      if ( !lastAction?.outcomes.has(target.actor) ) target.error ??= `${this.name} must attack the same target as the Strike which it follows.`;
    }
  }
};

/* -------------------------------------------- */

HOOKS.vampiricBite = {
  prepare() {
    const cls = getDocumentClass("Item");
    const biteData = foundry.utils.deepClone(SYSTEM.WEAPON.VAMPIRE_BITE);
    biteData.name = game.i18n.localize(biteData.name);
    const bite = new cls(biteData, {parent: this.actor});
    this.usage.weapon = bite;
    this.usage.context.tags.vampiricBite = this.name;
    foundry.utils.mergeObject(this.usage.bonuses, bite.system.actionBonuses);
    foundry.utils.mergeObject(this.usage.context, {
      type: "weapons",
      label: "Weapon Tags",
      icon: "fa-solid fa-swords",
      hasDice: true
    });
  },
  confirm(reverse) {
    const self = this.outcomes.get(this.actor);
    for ( const outcome of this.outcomes.values() ) {
      if ( outcome === self ) continue;
      if ( outcome.rolls.some(r => r.isSuccess) ) {
        self.resources.health = (self.resources.health || 0) + this.actor.system.abilities.toughness.value;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.wildStrike = {
  acquireTargets(targets) {
    const lastAction = this.actor.lastConfirmedAction;
    for ( const target of targets ) {
      if ( !lastAction?.outcomes.has(target.actor) ) target.error ??= `${this.name} must attack the same target as the Strike which it follows.`;
    }
    // TODO somehow require this to use a different weapon than the prior confirmed strike
  }
};

/* -------------------------------------------- */

export default HOOKS;
