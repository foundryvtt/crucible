const HOOKS = {};

/* -------------------------------------------- */

/**
 * Apply a critical-hit rider effect scaled on a Rune's current scaling ability.
 * @param {CrucibleActor} actor                          The acting Actor.
 * @param {CrucibleAction} action                        The resolved Action.
 * @param {string} runeId                                The Rune whose use triggers the rider.
 * @param {(ability: string) => object} effectFactory    Builds the effect data for the resolved scaling ability.
 * @param {object} [options]
 * @param {(event: object) => boolean} [options.condition]  Predicate selecting the triggering event per target.
 */
function applyRuneCritEffect(actor, action, runeId, effectFactory, {condition}={}) {
  if ( !action.usesRune(runeId) ) return;
  const ability = actor.grimoire.runes.get(runeId)?.scaling ?? SYSTEM.SPELL.RUNES[runeId].scaling;
  condition ??= event => event.isCriticalSuccess && event.isDamage;
  for ( const [, events] of action.eventsByTarget ) {
    for ( const event of events.roll ) {
      if ( condition(event) ) {
        event.effects.push(effectFactory(ability));
        break;
      }
    }
  }
}

/* -------------------------------------------- */

HOOKS.acrobat000000000 = {
  defendAttack(item, action, _attacker, rollData) {
    if ( this.equipment.weapons.mainhand?.config?.category?.id !== "balanced2" ) return;
    if ( action.tags.has("ranged") ) rollData.banes.acrobat = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.adrenalineSurge0 = {
  useAction(item, action) {
    if ( !this.effects.has(item.id) || !action.scaling?.includes("strength") ) return;
    action.usage.boons[item.id] = {label: item.name, number: 2};
  },
  preActivateAction(item, action) {
    if ( !action.scaling?.includes("strength") ) delete action.usage.boons[item.id]; // Double-check
  }
};

/* -------------------------------------------- */

HOOKS.adrenaline000000 = {
  confirmAction(item, action, {reverse}) {
    if ( reverse || this.status.adrenaline ) return;
    const myEvents = action.eventsByActor.get(this);
    if ( !myEvents ) return;
    for ( const event of myEvents.roll ) {
      const dmg = event.roll?.data?.damage;
      if ( (dmg?.resource !== "health") || (dmg.total <= 0) || dmg.restoration ) continue;
      action.recordEvent({
        target: this,
        resources: [{resource: "focus", delta: 1}],
        actorUpdates: {system: {status: {adrenaline: true}}}
      });
      return;
    }
  }
};

/* -------------------------------------------- */

HOOKS.amorphous0000000 = {
  prepareDefenses(item, defenses) {
    this.statuses.delete("restrained");
    defenses.dodge.bonus += this.getAbilityBonus("toughness");
  }
};

/* -------------------------------------------- */

HOOKS.arcanearcher0000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") ) return;
    const mh = this.equipment.weapons.mainhand;
    if ( !["projectile1", "projectile2"].includes(mh.category) ) return;

    // Ignore hands for Gesture: Arrow
    if ( action.gesture.id === "arrow" ) {
      action.cost.hands = 0;
      action.range.weapon = true;
      action.range.maximum = mh.system.range;
    }

    // Reduce cost of spell following strike
    const lastAction = this.lastConfirmedAction;
    if ( lastAction?.tags.has("strike") ) action.cost.action -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.armoredShell0000 = {
  prepareDefenses(item, defenses) {
    if ( !this.statuses.has("guarded") ) return;
    const offhand = this.equipment.weapons.offhand;
    if ( offhand?.category !== "shieldHeavy" ) return;
    const halfArmor = Math.ceil(defenses.armor.base / 2);
    defenses.armor.base -= halfArmor;
    defenses.block.bonus += halfArmor;
  }
};

/* -------------------------------------------- */

HOOKS.armoredInstinct0 = {
  receiveAttack(_item, _action, roll) {
    if ( roll.data.result !== roll.constructor.RESULT_TYPES.GLANCE ) return;
    const dmg = roll.data.damage;
    dmg.resistance += 1;
    dmg.total = crucible.api.models.CrucibleAction.computeDamage(dmg);
  }
};

/* -------------------------------------------- */

HOOKS.artificer0000000 = {
  prepareWeapons(item) {
    // Raise the Amplify-marked affix one tier on its equipped bearer; prepareWeapons is just a per-prep anchor
    const marker = this.effects.get(SYSTEM.EFFECTS.getEffectId("Amplify Affix"));
    const target = marker?.getFlag("crucible", "amplify");
    if ( !target ) return;
    const bearer = this.items.get(target.itemId);
    const affix = bearer?.system.affixes?.[target.affixId];
    if ( !affix || !bearer.system.equipped ) return;
    const tier = affix.system.tier;
    tier.value = Math.min(tier.value + 1, tier.max, 3);
  }
};

/* -------------------------------------------- */

HOOKS.assassin00000000 = {
  prepareAttack(item, action, target, rollData) {
    if ( !["strike", "spell"].some(t => action.tags.has(t)) ) return;
    if ( !target.statuses.has("unaware") ) return;

    // Don't want to double-deadly
    if ( action.tags.has("deadly") ) return;
    action.tags.add("deadly");
    rollData.multiplier += 1;
  }
}

/* -------------------------------------------- */

HOOKS.bard000000000000 = {
  prepareAttack(item, action, _target, rollData) {
    if ( !action.tags.has("spell") ) return;
    if ( action.rune.id === "soul" ) rollData.boons.bard = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.bastion000000000 = {
  prepareMovement(_item, movement) {
    if ( !this.statuses.has("guarded") ) return;
    movement.engagementBonus += 1;
    movement.blockerStrength = SYSTEM.ACTOR.MOVEMENT_STRENGTHS.UNSTOPPABLE;
  },
  prepareDefenses(_item, defenses) {
    if ( !this.statuses.has("guarded") ) return;
    const reflex = defenses.reflex.base + defenses.reflex.bonus;
    const armorBlock = defenses.armor.base + defenses.armor.bonus + defenses.block.base + defenses.block.bonus;
    if ( armorBlock > reflex ) defenses.reflex.bonus += armorBlock - reflex;
  },
  receiveAttack(_item, _action, roll) {
    if ( !this.statuses.has("guarded") ) return;
    const T = roll.constructor.RESULT_TYPES;
    if ( (roll.data.defenseType === "reflex") && (roll.data.result === T.RESIST) ) roll.data.result = T.BLOCK;
  }
};

/* -------------------------------------------- */

HOOKS.battleWorn000000 = {
  finalizeAction(_item, action) {
    if ( action.id !== "rest" ) return;
    const bonus = Math.floor(this.system.abilities.toughness.value / 2);
    if ( bonus <= 0 ) return;
    const wounds = this.system.resources.wounds;
    if ( !wounds ) return;
    const activation = action.selfEvents.activation;
    const existing = activation.resources.find(r => r.resource === "wounds");
    const alreadyHealed = existing ? -existing.delta : 0;
    const remaining = wounds.value - alreadyHealed;
    const delta = -Math.min(bonus, remaining);
    if ( delta < 0 ) activation.resources.push({resource: "wounds", delta});
  }
};

/* -------------------------------------------- */

HOOKS.battlefocus00000 = {
  applyCriticalEffects(_item, action) {
    if ( this.status.battleFocus ) return;
    for ( const event of action.events ) {
      if ( (event.target === this) || !event.isCriticalSuccess || !event.isDamage ) continue;
      const idx = action.events.indexOf(event) + 1;
      action.recordEvent({
        resources: [{resource: "focus", delta: 1}],
        actorUpdates: {system: {status: {battleFocus: true}}}
      }, {index: idx});
      return;
    }
  }
};

/* -------------------------------------------- */

HOOKS.berserker0000000 = {
  prepareAttack(_item, action, _target, rollData) {
    if ( !this.effects.has(SYSTEM.EFFECTS.getEffectId("berserkerRage")) ) return;
    if ( !action.tags.has("melee") ) return;
    rollData.damageBonus += 4;
  }
}

/* -------------------------------------------- */

HOOKS.bestialSenses000 = {
  prepareAttack(item, action, _target, rollData) {
    if ( !(action.tags.has("skill") && (action.usage.skillId === "awareness")) ) return;
    rollData.boons.bestialSenses = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.bloodfrenzy00000 = {
  applyCriticalEffects(item, action) {
    if ( this.status.bloodFrenzy ) return;
    for ( const event of action.events ) {
      if ( (event.target === this) || !event.isCriticalSuccess || !event.damagesHealth ) continue;
      const idx = action.events.indexOf(event) + 1;
      action.recordEvent({
        resources: [{resource: "action", delta: 1}],
        actorUpdates: {system: {status: {bloodFrenzy: true}}},
        statusText: [{text: item.name, fillColor: SYSTEM.RESOURCES.action.color.css}]
      }, {index: idx});
      return;
    }
  }
};

/* -------------------------------------------- */

HOOKS.bloodletter00000 = {
  applyCriticalEffects(_item, action) {
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.damagesHealth ) continue;
        const dt = event.weaponItem?.system.damageType;
        if ( ["piercing", "slashing"].includes(dt) ) {
          event.effects.push(SYSTEM.EFFECTS.bleeding(this, {damageType: dt}));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.bloodmagic000000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("spell") ) return;
    action.cost.health = action.cost.focus * 10;
    action.cost.focus = 0;
    action.constrainResources({health: SYSTEM.RESOURCE_CONSTRAINTS.NO_INCREASE});
  }
};

/* -------------------------------------------- */

HOOKS.bloodSense000000 = {
  prepareAttack(_item, action, target, rollData) {
    if ( !["strike", "skill"].some(t => action.tags.has(t)) ) return;
    if ( target.resources.health.value < target.resources.health.max ) delete rollData.banes.blind;
  }
};

/* -------------------------------------------- */

HOOKS.bulwark000000000 = {
  prepareActions(item, actions) {
    const defend = actions.defend;
    if ( !defend || !this.equipment.weapons.shield || this.system.status.bulwark ) return;
    defend.cost.action -= 1;
    defend.usage.actorUpdates["system.status.bulwark"] = true;
  }
};

/* -------------------------------------------- */

const absorptionTalents = {
  acidAbsorption00: "acid",
  coldAbsorption00: "cold",
  corruptionAbsorp: "corruption",
  electricityAbsor: "electricity",
  fireAbsorption00: "fire",
  psychicAbsorptio: "psychic",
  radiantAbsorptio: "radiant",
  voidAbsorption00: "void"
};

for ( const [talentId, damageType] of Object.entries(absorptionTalents) ) {
  HOOKS[talentId] = {
    prepareResistances(_item, resistances) {
      resistances[damageType].base *= 2;
    },
    receiveAttack(_item, _action, roll) {
      if ( !roll.hasDamage ) return;
      const dmg = roll.data.damage;
      if ( (dmg.type !== damageType) || dmg.restoration || (dmg.total > 0) ) return;
      const unmitigatedTotal = crucible.api.models.CrucibleAction.computeDamage({...dmg, resistance: 0});
      dmg.restoration = true;
      dmg.total = dmg.resistance - unmitigatedTotal;
    }
  };
}

/* -------------------------------------------- */

HOOKS.cadence000000000 = {
  prepareAttack(item, action, _target, rollData) {
    if ( !action.tags.has("strike") ) return;
    if ( action.usage.weapon.config.category.hands !== 1 ) return;
    const {cadence} = this.status;
    const {actorStatus} = action.usage;
    actorStatus.cadence = (cadence ?? 0) + 1;
    if ( cadence ) rollData.boons.cadence = {label: item.name, number: cadence};
  }
};

/* -------------------------------------------- */

HOOKS.carefree00000000 = {
  prepareDefenses(_item, defenses) {
    defenses.madness.bonus -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.champion00000000 = {
  _DOMINANCE_ID: "championDominanc",
  _getRival(actor) {
    const origin = actor.effects.get(HOOKS.champion00000000._DOMINANCE_ID)?.origin;
    return origin ? fromUuidSync(origin) : null;
  },
  prepareAttack(item, action, target, rollData) {
    if ( !action.tags.has("melee") ) return;
    const dominance = this.effects.get(HOOKS.champion00000000._DOMINANCE_ID);
    if ( dominance?.origin !== target.uuid ) return;
    const stage = dominance.getFlag("crucible", "dominance")?.stage || 0;
    if ( stage > 0 ) rollData.damageBonus += stage;
  },
  finalizeAction(item, action) {
    if ( !action.tags.has("strike") ) return;
    const dominance = this.effects.get(HOOKS.champion00000000._DOMINANCE_ID);
    if ( !(dominance?.getFlag("crucible", "dominance")?.stage) ) return;
    const struckOther = Array.from(action.targets.keys()).some(t => t.uuid !== dominance.origin);
    if ( struckOther ) action.recordEvent({type: "effect", target: this, effects: [{
      _id: HOOKS.champion00000000._DOMINANCE_ID, _action: "update",
      name: _loc("ACTIONS.Challenge.Dominance"),
      flags: {crucible: {dominance: {round: game.combat?.round ?? 0, stage: 0}}}
    }]});
  },
  endTurn(item, {effectChanges}, {round}) {
    const id = HOOKS.champion00000000._DOMINANCE_ID;
    const current = this.effects.get(id);
    if ( !current ) return;
    const dominance = current.getFlag("crucible", "dominance") || {round: 0, stage: 0};

    // The duel ends if your rival is gone or defeated
    const rival = HOOKS.champion00000000._getRival(this);
    if ( !rival || rival.isIncapacitated ) {
      effectChanges.toDelete.push(id);
      return;
    }

    // Dominance grows only if you end your turn alone with your rival
    const enemies = this.getActiveTokens()[0]?.engagement?.enemies;
    const rivalToken = rival.getActiveTokens()[0];
    const intact = !!(rivalToken && enemies && (enemies.size === 1) && enemies.has(rivalToken));

    // Duel broken: reset the stage but keep the rival designation
    if ( !intact ) {
      if ( dominance.stage > 0 ) effectChanges.toUpdate.push({
        _id: id, name: _loc("ACTIONS.Challenge.Dominance"),
        flags: {crucible: {dominance: {round: dominance.round, stage: 0}}}
      });
      return;
    }

    // Ramp at most once per round; the stored round dedupes a GM turn rewind and re-advance
    if ( round <= dominance.round ) return;
    const stage = Math.min(dominance.stage + 1, this.abilities.presence.value);
    if ( stage === dominance.stage ) return;
    effectChanges.toUpdate.push({
      _id: id, name: `${_loc("ACTIONS.Challenge.Dominance")} (+${stage})`,
      flags: {crucible: {dominance: {round, stage}}}
    });
  }
};

/* -------------------------------------------- */

HOOKS.chirurgeon000000 = {
  prepareAction(item, action) {
    if ( action.tags.has("medicine") && this.inCombat ) {
      action.usage.boons[item.id] = {label: item.name, number: 1};
    }
  },
  prepareSkillCheck(item, skill, rollData) {
    if ( (rollData.type === "medicine") && this.inCombat ) {
      rollData.boons[item.id] = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */

HOOKS.concussiveblows0 = {
  applyCriticalEffects(_item, action) {
    if ( !action.tags.has("melee") ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.damagesHealth ) continue;
        if ( event.weaponItem?.system.damageType === "bludgeoning" ) {
          event.effects.push(SYSTEM.EFFECTS.staggered(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.conjurer00000000 = {
  prepareAction(_item, action) {
    if ( action.gesture?.id !== "create" ) return;
    const effectIds = Array.fromRange(3, 1).map(i => SYSTEM.EFFECTS.getEffectId("conjurercreate", {suffix: String(i)}));
    const effectId = effectIds.find(id => !this.effects.has(id)) || effectIds[0];
    action.usage.summons[0].effectId = effectId;
  }
};

/* -------------------------------------------- */

HOOKS.conserveeffort00 = {
  endTurn(item, {resourceChanges, statusText}) {
    if ( this.resources.action.value ) {
      resourceChanges.focus.push({label: item.name, amount: 1});
      statusText.push({text: item.name, fillColor: SYSTEM.RESOURCES.focus.color.css});
    }
  }
};

/* -------------------------------------------- */

HOOKS.deftgrip00000000 = {
  prepareWeapons(_item, weapons) {
    if ( weapons.twoHanded && weapons.mainhand?.config.category.scaling.includes("dexterity") ) {
      weapons.spellHands = Math.max(weapons.spellHands, 2);
    }
  },
  prepareAction(_item, action) {
    if ( action.id !== "equipItem" ) return;
    const weapon = this.items.get(action.usage.actorUpdates.items?.[0]?._id);
    if ( (weapon?.type !== "weapon") || !weapon.config.category.scaling.includes("dexterity") ) return;
    if ( action.cost.action && this.system.hasFreeMove ) {
      action.cost.action = 0;
      action.usage.actorStatus.hasMoved = true;
    }
  },
  defendAttack(item, action, _origin, rollData) {
    const {twoHanded, mainhand} = this.equipment.weapons;
    if ( action.tags.has("disarm") && twoHanded && mainhand?.config.category.scaling.includes("dexterity") ) {
      rollData.banes.deftGrip = {label: item.name, number: 2};
    }
  }
};

/* -------------------------------------------- */

HOOKS.defiantWill00000 = {
  prepareDefenses(_item, defenses) {
    const health = this.system.resources.health;
    if ( health.max <= 0 ) return;
    const toughness = this.system.abilities.toughness.value;
    defenses.willpower.bonus += Math.floor(toughness * (1 - (health.value / health.max)));
  }
};

/* -------------------------------------------- */

HOOKS.demolitionist000 = {
  prepareAction(item, action) {
    if ( action.item?.config?.category.id === "bomb" ) {
      if ( action.target.scope === SYSTEM.ACTION.TARGET_SCOPES.ALL ) action.target.self = false;
      if ( !action.actor.system.status.demolitionist ) {
        action.cost.action = Math.max(action.cost.action - 1, 0);
        action.usage.actorStatus.demolitionist = true;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.distancerunner00 = {
  prepareMovement(_item, movement) {
    movement.strideBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.dustbinder000000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "earth", ability => SYSTEM.EFFECTS.corroding(this, {ability}));
  }
};

/* -------------------------------------------- */

HOOKS.echolocation0000 = {
  prepareToken(_item, token) {
    token.detectionModes.echolocation ??= {enabled: true, range: 60};
  }
};

/* -------------------------------------------- */

HOOKS.evasiveArmor0000 = {
  prepareDefenses(_item, defenses) {
    const defenseTotals = {};
    for ( const defense of ["reflex", "armor", "dodge", "block", "parry"] ) {
      defenseTotals[defense] = defenses[defense].base + defenses[defense].bonus;
    }
    if ( this.statuses.has("exposed") ) defenseTotals.armor -= Math.min(defenses.armor.base, 2);
    if ( this.statuses.has("enraged") ) defenseTotals.parry = defenseTotals.block = 0;
    if ( this.statuses.has("exhausted") ) {
      defenseTotals.dodge = Math.ceil(defenseTotals.dodge / 2);
      defenseTotals.reflex = Math.ceil(defenseTotals.reflex / 2);
    }
    if ( this.isIncapacitated ) defenseTotals.dodge = defenseTotals.parry = defenseTotals.block = 0;
    const physicalTotal = defenseTotals.armor + defenseTotals.dodge + defenseTotals.block + defenseTotals.parry;
    const excess = defenseTotals.reflex - physicalTotal;
    if ( excess > 0 ) defenses.armor.bonus += excess;
  }
};

/* -------------------------------------------- */

HOOKS.focusedanticipat = {
  startTurn(item, {resourceChanges, statusText}, {turn}) {
    if ( turn > 0 ) return;
    resourceChanges.focus.push({label: item.name, amount: 1});
    statusText.push({text: item.name, fillColor: SYSTEM.RESOURCES.focus.color.css});
  }
};

/* -------------------------------------------- */

HOOKS.gambit0000000000 = {
  _CHARGES_ID: "gambitCharges000",
  _ALLIN_ID: "gambitAllIn00000",
  _chargeCount(actor) {
    return actor.effects.get(HOOKS.gambit0000000000._CHARGES_ID)?.getFlag("crucible", "gambitCharges") || 0;
  },
  _chargesEffect(actor, count) {
    return {
      _id: HOOKS.gambit0000000000._CHARGES_ID,
      name: _loc("ACTIONS.Gambit.Charges", {count}),
      img: "icons/sundries/gaming/dice-pair-white-green.webp",
      description: `<p>${_loc("ACTIONS.Gambit.ChargeDescription")}</p>`,
      origin: actor.uuid,
      duration: {expiry: "combatEnd"},
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER,
      system: {dc: null},
      flags: {crucible: {gambitCharges: count}}
    };
  },
  _allInEffect(actor, action) {
    return {
      _id: HOOKS.gambit0000000000._ALLIN_ID,
      name: action.name,
      img: action.img,
      description: action.description,
      origin: actor.uuid,
      duration: {value: 1, units: "rounds", expiry: "turnEnd"}, // End of THIS turn
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
      system: {dc: null}
    };
  },
  prepareDefenses(_item, defenses) {
    const int = this.abilities.intellect.value;
    const dex = this.abilities.dexterity.value;
    if ( int <= dex ) return;
    const scaling = this.equipment.armor.system.dodge.scaling;
    defenses.dodge.bonus += Math.max(int - scaling, 0) - Math.max(dex - scaling, 0);
  },
  async rollAction(item, action, target) {
    const rolls = action.eventsByTarget.get(target)?.roll;
    if ( !rolls?.length ) return;
    const G = HOOKS.gambit0000000000;

    // All-In: the first roll of the primed action achieves its maximum result on every die, consuming the effect
    if ( this.effects.has(G._ALLIN_ID) && !action.usage.gambitAllIn ) {
      const event = rolls.find(e => e.roll?.dice?.length);
      if ( event ) {
        action.usage.gambitAllIn = true;
        G._maximizeRoll(event.roll);
        G._reresolve(event.roll, this, target);
        action.recordEvent({type: "effect", target: this, effects: [{_id: G._ALLIN_ID, _action: "delete"}],
          statusText: [{text: _loc("ACTIONS.AllIn.Marker"), fillColor: SYSTEM.RESOURCES.heroism.color.css}]});
        return;
      }
    }

    // Loaded Dice: reroll the round's first natural 1, gated once per round via the per-turn status sentinel
    if ( this.status?.loadedDice || action.usage.actorStatus.loadedDice ) return;
    for ( const event of rolls ) {
      const die = event.roll?.dice?.find(d => d.results.some(r => r.active && (r.result === 1)));
      if ( !die ) continue;
      await die.reroll("r1");
      G._reresolve(event.roll, this, target);
      action.usage.actorStatus.loadedDice = true;
      action.recordEvent({target: this, statusText: [{
        text: _loc("ACTIONS.Gambit.LoadedDice"), fillColor: SYSTEM.RESOURCES.heroism.color.css
      }]});
      return;
    }
  },
  finalizeAction(item, action) {
    if ( !action.tags.has("strike") ) return;
    const ante = action.usage.banes.special?.number || 0;
    if ( ante <= 0 ) return;
    if ( !action.events.some(e => (e.target !== this) && e.isDamage
      && (this.getDispositionTowards(e.target) === CONST.TOKEN_DISPOSITIONS.HOSTILE)) ) return;
    const G = HOOKS.gambit0000000000;
    const count = G._chargeCount(this) + ante;
    const effect = this.effects.has(G._CHARGES_ID)
      ? {_id: G._CHARGES_ID, _action: "update", name: _loc("ACTIONS.Gambit.Charges", {count}),
        flags: {crucible: {gambitCharges: count}}}
      : G._chargesEffect(this, count);
    action.recordEvent({type: "effect", target: this, effects: [effect], statusText: [{
      text: _loc("ACTIONS.Gambit.AnteWon", {count: ante}), fillColor: SYSTEM.RESOURCES.heroism.color.css
    }]});
  },
  _maximizeRoll(roll) {
    for ( const die of roll.dice ) {
      for ( const result of die.results ) {
        if ( result.active ) result.result = die.faces;
      }
    }
  },
  _reresolve(roll, actor, target) {
    if ( roll.resolveDamage ) roll.resolveDamage(actor, target);
    else roll._total = roll._evaluateTotal();
  }
};

/* -------------------------------------------- */

HOOKS.glider0000000000 = {
  prepareActions(_item, actions) {
    if ( !actions.fallGlide ) return;
    const canGlide = !this.system.isIncapacitated && !this.statuses.has("restrained");
    if ( canGlide ) actions.fall = actions.fallGlide;
    delete actions.fallGlide;
  },
  prepareMovement(_item, movement) {
    if ( !this.statuses.has("falling") ) return;
    movement.strideBonus += movement.baseStride;
    // A hack to guarantee that the glide is treated as a free move
    if ( this.system.status?.hasMoved ) this.system.status = {...this.system.status, hasMoved: false};
  }
};

/* -------------------------------------------- */

HOOKS.wrestler00000000 = {
  prepareMovement(_item, movement) {
    movement.grappleBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.healer0000000000 = {
  prepareAttack(item, action, _target, rollData) {
    if ( !action.tags.has("spell") ) return;
    if ( action.rune.id === "life" ) rollData.boons.healer = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.holdfast00000000 = {
  prepareMovement(item, movement) {
    if ( this.equipment.weapons.shield ) movement.engagementBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.hulkingphysique0 = {
  prepareMovement(_item, movement) {
    movement.sizeBonus += 1;
    movement.strideBonus -= 2;
  },
  prepareDefenses(_item, defenses) {
    defenses.dodge.bonus -= 2;
  }
};

/* -------------------------------------------- */

HOOKS.impetus000000000 = {
  startTurn(item, {effectChanges}, {turn}) {
    if ( turn > 0 ) return;
    const effectData = {
      _id: SYSTEM.EFFECTS.getEffectId("impetus"),
      name: item.name,
      img: item.img,
      statuses: ["hastened"],
      duration: {
        units: "rounds",
        expiry: "turnStart",
        value: 1
      }
    };
    const existingEffect = this.effects.get(effectData._id);
    if ( existingEffect ) {
      effectData.duration.value += existingEffect.duration.value;
      effectChanges.toUpdate.push(effectData);
    } else {
      effectChanges.toCreate.push(effectData);
    }
  }
};

/* -------------------------------------------- */

HOOKS.impenetrableGuar = {
  defendAttack(item, action, origin, rollData) {
    if ( !action.tags.has("strike") ) return;
    const lastAction = ChatMessage.implementation.getLastAction({confirmed: true, actor: origin});
    if ( !lastAction?.tags.has("strike") ) return;
    const myEvents = lastAction.eventsByActor.get(this);
    if ( !myEvents ) return;
    const results = game.system.api.dice.AttackRoll.RESULT_TYPES;
    for ( const event of myEvents.roll ) {
      if ( [results.BLOCK, results.GLANCE].includes(event.roll.data.result) ) {
        rollData.banes[item.id] = {label: item.name, number: 1};
        return;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.inquisitor000000 = {
  // The Inquisitor's Reactive Strike always trades an extra Action for 1 Focus
  prepareActions(_item, actions) {
    const rs = actions.reactiveStrike;
    if ( !rs ) return;
    rs.cost.action -= 1;
    rs.cost.focus = 1;
  },
  // Steal a Focus point from a caster struck in reaction to their spell, refunding this strike's own Focus
  finalizeAction(_item, action) {
    if ( action.id !== "reactiveStrike" ) return;
    const prior = ChatMessage.implementation.getLastAction();
    if ( !prior?.tags.has("spell") ) return;
    action.metadata.inquisitorTargetMessageId = prior.message.id;
    const {HIT} = game.system.api.dice.AttackRoll.RESULT_TYPES;
    for ( const [target, events] of action.eventsByTarget ) {
      if ( target === this ) continue;
      const success = events.roll?.some(e => e.roll?.data?.result >= HIT);
      if ( !success || (target.resources.focus.value < 1) ) continue;
      action.recordEvent({target, resources: [{resource: "focus", delta: -1}]});
      action.recordEvent({target: this, resources: [{resource: "focus", delta: 1}]});
    }
  },
  // On a Critical Hit against the caster, interrupt their spell - modeled on Counterspell
  async confirmAction(_item, action, {reverse}) {
    if ( (action.id !== "reactiveStrike") || !action.metadata.inquisitorTargetMessageId ) return;
    const {HIT} = game.system.api.dice.AttackRoll.RESULT_TYPES;
    const critHit = action.events.some(e =>
      (e.target !== this) && (e.roll?.data?.result >= HIT) && e.roll?.isCriticalSuccess);
    if ( !critHit ) return;
    const targetMessage = game.messages.get(action.metadata.inquisitorTargetMessageId);
    if ( !targetMessage || (targetMessage.getFlag("crucible", "confirmed") !== reverse) ) return;

    // Interrupt the caster's spell after its activation cost
    const CrucibleAction = action.constructor;
    if ( !reverse ) {
      const target = CrucibleAction.fromChatMessage(targetMessage);
      target.negate(target.selfEvents.activation);
      await target.updateMessage();
    }
    await CrucibleAction.confirmMessage(targetMessage, {reverse});
    if ( reverse ) {
      const target = CrucibleAction.fromChatMessage(targetMessage);
      target.clearNegation();
      await target.updateMessage();
    }
  }
};

/* -------------------------------------------- */

HOOKS.inspirator000000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "soul", ability => SYSTEM.EFFECTS.inspired(this, {ability}),
      {condition: event => event.isCriticalSuccess && event.healsMorale});
  }
};

/* -------------------------------------------- */

HOOKS.intellectualsupe = {
  prepareAttack(item, action, target, rollData) {
    if ( !["strike", "spell"].some(t => action.tags.has(t)) ) return;
    const ac = this.combatant;
    const tc = target.combatant;
    if ( ac?.initiative > tc?.initiative ) rollData.boons.intellectualSuperiority = {label: item.name, number: 1};
  }
};

/* -------------------------------------------- */

HOOKS.ironResolve00000 = {
  defendAttack(_item, action, _origin, rollData) {
    if ( action.tags.has("strike") ) {
      rollData.criticalSuccessThreshold += 1;
    }
  }
};

/* -------------------------------------------- */

HOOKS.irrepressiblespi = {
  startTurn(item, {resourceChanges, statusText}) {
    if ( this.system.isBroken ) return;
    resourceChanges.morale.push({label: item.name, amount: 1});
    statusText.push({text: item.name, fillColor: SYSTEM.RESOURCES.morale.color.heal.css});
  }
};

/* -------------------------------------------- */

HOOKS.juggernaut000000 = {
  prepareMovement(_item, movement) {
    movement.grappleBonus += 1;
  },
  prepareAction(_item, action) {
    if ( action.id !== "grapple" ) return;
    const selfEffect = action.effects.find(e => e.scope === SYSTEM.ACTION.TARGET_SCOPES.SELF);
    if ( selfEffect?.statuses ) selfEffect.statuses = selfEffect.statuses.filter(s => s !== "restrained");
  }
};

/* -------------------------------------------- */

HOOKS.justiciar0000000 = {
  applyCriticalEffects(item, action) {
    for ( const event of action.events ) {
      if ( (event.target === this || !event.isCriticalSuccess || !event.damagesHealth) ) continue;
      const idx = action.events.indexOf(event) + 1;
      const {overflow, resistance, multiplier} = event.roll.data.damage;
      const moraleDamage = crucible.api.models.CrucibleAction.computeDamage({overflow, resistance, multiplier});
      if ( moraleDamage ) {
        action.recordEvent({
          target: event.target,
          resources: [{resource: "morale", delta: -moraleDamage}],
          statusText: [{text: item.name, fillColor: SYSTEM.RESOURCES.morale.color.high.css}]
        }, {index: idx});
      }
    }
  }
}

/* -------------------------------------------- */

HOOKS.kineturge0000000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "kinesis", ability => {
      const bleeding = SYSTEM.EFFECTS.bleeding(this, {ability});
      bleeding.duration = {value: 1, units: "rounds", expiry: "turnStart"};
      return bleeding;
    });
  }
};

/* -------------------------------------------- */

HOOKS.lesserregenerati = {
  startTurn(item, {resourceChanges, statusText}) {
    if ( this.system.isWeakened ) return;
    resourceChanges.health.push({label: item.name, amount: 1});
    statusText.push({text: item.name, fillColor: SYSTEM.RESOURCES.health.color.heal.css});
  }
};

/* -------------------------------------------- */

HOOKS.lightbringer0000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "illumination", ability => SYSTEM.EFFECTS.irradiated(this, {ability}));
  }
};

/* -------------------------------------------- */

HOOKS.mender0000000000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "life", ability => SYSTEM.EFFECTS.mending(this, {ability}),
      {condition: event => event.isCriticalSuccess && event.healsHealth});
  }
};

/* -------------------------------------------- */

HOOKS.mentalfortress00 = {
  prepareResistances(item, resistances) {
    resistances.psychic.base += 5;
  },
  prepareDefenses(item, defenses) {
    defenses.willpower.bonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.mesmer0000000000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "illusion", ability => SYSTEM.EFFECTS.confused(this, {ability}));
  }
};

/* -------------------------------------------- */

HOOKS.neverYield000000 = {
  // Intentionally uses prepareDefenses because this must run after #prepareFinalResources applies the weakened penalty
  prepareDefenses(_item, _defenses) {
    if ( this.system.isWeakened ) this.resources.action.max += 1;
  }
};

/* -------------------------------------------- */

HOOKS.necromancer00000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "death", ability => SYSTEM.EFFECTS.decay(this, {ability}));
  }
};

/* -------------------------------------------- */

HOOKS.nosferatu0000000 = {
  prepareResistances(_item, resistances) {
    resistances.radiant.base -= 10;
  }
};

/* -------------------------------------------- */

HOOKS.operator00000000 = {
  prepareStandardCheck(item, rollData) {
    if ( !this.inCombat || !game.combat.started || this.isIncapacitated ) return;
    const health = this.system.resources.health;
    if ( health.value < Math.ceil(health.max * 0.25) ) {
      rollData.boons.operator = {label: item.name, number: 2};
    } else if ( health.value < Math.ceil(health.max * 0.5) ) {
      rollData.boons.operator = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */

HOOKS.packhunter000000 = {
  prepareAttack(item, action, target, rollData) {
    if ( !action.tags.has("strike") ) return;
    if ( target.statuses.has("flanked") ) {
      rollData.boons.packHunter = {
        label: item.name,
        number: rollData.boons.flanked.number
      };
    }
  }
};

/* -------------------------------------------- */

HOOKS.patientdeflectio = {
  prepareDefenses(_item, defenses) {
    const {mainhand, offhand} = this.equipment.weapons;
    const armed = (mainhand && (mainhand.config.category.id !== "unarmed"))
      || (offhand && (offhand.config.category.id !== "unarmed"));
    if ( armed ) return;
    const wisdom = this.system.abilities.wisdom.value;
    defenses.parry.bonus += Math.ceil(wisdom / 2);
  }
};

/* -------------------------------------------- */

HOOKS.peltast000000000 = {
  prepareAction(item, action) {
    // A weapon built for throwing reaches +10 ft in a Peltast's hands; improvised throws keep the base range
    if ( !action.tags.has("thrown") ) return;
    const weapon = action.usage.weapon ?? action.usage.strikes?.[0];
    if ( weapon?.system.properties.has("thrown") ) action.range.maximum = (action.range.maximum ?? 10) + 10;
  },
  preActivateAction(item, action) {
    if ( !action.tags.has("thrown") ) return;
    // Throw anything: arcane guidance steadies even weapons not built for throwing, removing the improvised penalty
    delete action.usage.banes[action.id];
    // Returning: the weapon is recalled rather than dropped, so it stays in the Peltast's grasp
    for ( const update of action.selfUpdateEvent.actorUpdates.items ?? [] ) {
      if ( update.system?.dropped ) Object.assign(update.system, {dropped: false, equipped: true});
    }
  }
};

/* -------------------------------------------- */

HOOKS.planneddefense00 = {
  defendAttack(item, action, origin, rollData) {
    if ( !["spell", "strike"].some(tag => action.tags.has(tag)) ) return;
    const ac = this.combatant;
    const oc = origin.combatant;
    if ( ac?.initiative > oc?.initiative ) rollData.banes.plannedDefense = {label: item.name, number: 1};
  }
};

/* -------------------------------------------- */

HOOKS.poisoner00000000 = {
  prepareAttack(item, action, target, rollData) {
    if ( rollData.damageType === "poison" ) {
      rollData.damageBonus += 2;
    }
  },
  applyCriticalEffects(_item, action) {
    if ( !this.effects.get(SYSTEM.EFFECTS.getEffectId("poisonBlades")) ) return;
    if ( !action.tags.has("melee") ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.damagesHealth ) continue;
        const dt = event.weaponItem?.system.damageType;
        if ( ["piercing", "slashing"].includes(dt) ) {
          event.effects.push(SYSTEM.EFFECTS.poisoned(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.polybrachial0000 = {
  prepareWeapons(item, weapons) {
    weapons.freeHands = Math.max(weapons.freeHands, 2);
    weapons.spellHands = Math.max(weapons.spellHands, 2);
  }
};

/* -------------------------------------------- */

HOOKS.powerfulphysique = {
  prepareInitiativeCheck(_item, rollData) {
    const {weapons, armor} = this.equipment;
    const slowBanes = rollData.banes.slow;
    if ( weapons.slow && slowBanes ) slowBanes.number -= weapons.slow;
    const bulkyBanes = rollData.banes.bulky;
    if ( armor.system.properties.has("bulky") && bulkyBanes ) bulkyBanes.number -= 2;
  }
};

/* -------------------------------------------- */

HOOKS.powerfulThrow000 = {
  prepareAction(item, action) {
    // Additive +10 (not x2) so thrown-range bonuses stack deterministically regardless of hook order
    if ( action.tags.has("thrown") || (action.item?.config?.category.id === "bomb") ) {
      action.range.maximum += 10;
    }
  }
};

/* -------------------------------------------- */

HOOKS.preparedness0000 = {
  prepareAction(item, action) {
    if ( action.id !== "equipItem" ) return;
    if ( action.cost.action && !this.system.status.hasMoved ) {
      action.cost.action = 0;
      action.usage.actorStatus.hasMoved = true;
    }
  }
};

/* -------------------------------------------- */

HOOKS.preternaturalins = {
  prepareInitiativeCheck(item, rollData) {
    rollData.boons.preternaturalInstinct = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.primalist0000000 = {
  _STANCES: {
    flame: "stanceFlame00000",
    frost: "stanceFrost00000",
    earth: "stanceEarth00000",
    storm: "stanceStorm00000"
  },
  _canUseStance(action, rune) {
    const actor = action.actor;
    if ( actor.effects.has(HOOKS.primalist0000000._STANCES[rune]) ) return false;
    if ( !actor.grimoire.runes.has(rune) ) throw new Error(_loc("ACTION.WARNINGS.RequiresRune"));
    if ( actor.inCombat && actor.system.status.primalStance ) {
      throw new Error(_loc("ACTION.WARNINGS.OncePerTurn", {action: action.name}));
    }
    return true;
  },
  _activateStance(action, rune) {
    const stances = HOOKS.primalist0000000._STANCES;
    const effectId = stances[rune];
    action.usage.actorStatus.primalStance = true;
    action.effects[0]._id = effectId;
    action.effects[0].showIcon = CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER;
    for ( const id of Object.values(stances) ) {
      if ( (id !== effectId) && action.actor.effects.has(id) ) {
        action.recordEvent({type: "effect", target: action.actor, effects: [{_id: id, _action: "delete"}]});
      }
    }
  },
  prepareMovement(_item, movement) {
    if ( this.effects.has(HOOKS.primalist0000000._STANCES.storm) ) movement.strideBonus += 2;
  },
  prepareDefenses(_item, defenses) {
    if ( !this.effects.has(HOOKS.primalist0000000._STANCES.frost) ) return;
    for ( const d of ["reflex", "fortitude", "willpower"] ) defenses[d].bonus += 1;
  },
  prepareResistances(_item, resistances) {
    if ( !this.effects.has(HOOKS.primalist0000000._STANCES.earth) ) return;
    for ( const dt of ["bludgeoning", "piercing", "slashing"] ) resistances[dt].base += 2;
  },
  prepareAttack(_item, action) {
    if ( !action.tags.has("strike") ) return;
    const stances = HOOKS.primalist0000000._STANCES;
    action.usage.rune = Object.keys(stances).find(rune => this.effects.has(stances[rune]));
  },
  finalizeAction(_item, action) {
    if ( !action.tags.has("strike") || !this.effects.has(HOOKS.primalist0000000._STANCES.flame) ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isDamage ) continue;
        const resource = event.roll?.data?.damage?.resource ?? "health";
        const fire = Math.clamp(2 - target.getResistance(resource, "fire"), 0, 4);
        if ( fire ) event.resources.push({resource, delta: -fire, damageType: "fire"});
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.pyromancer000000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "flame", ability => SYSTEM.EFFECTS.burning(this, {ability}));
  }
};

/* -------------------------------------------- */

HOOKS.resilient0000000 = {
  prepareDefenses(_item, defenses) {
    defenses.wounds.bonus -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.rimecaller000000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "frost", ability => SYSTEM.EFFECTS.freezing(this, {ability}));
  }
};

/* -------------------------------------------- */

HOOKS.runewarden000000 = {
  prepareResistances(_item, resistances) {
    for ( const rune of this.grimoire.runes.values() ) {
      const dt = rune.damageType;
      if ( (dt === "physical") || (SYSTEM.DAMAGE_TYPES[dt].type === "physical") ) continue;
      resistances[dt].base += Math.ceil(this.abilities.wisdom.value / 2);
    }
  }
};

/* -------------------------------------------- */

HOOKS.saboteur00000000 = {
  prepareAction(item, action) {
    if ( action.item?.config?.category.id === "bomb" ) {
      action.usage.bonuses.skill = Math.max(action.usage.bonuses.skill, SYSTEM.TALENT.TRAINING_RANKS.trained.bonus);
      action.usage.boons[item.id] = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */

HOOKS.sage000000000000 = {
  useAction(item, action) {
    // Resting refreshes the free out-of-combat Flash of Brilliance (per-Rest flag, see issue #1196)
    if ( action.id === "rest" ) action.usage.actorFlags.flashOfBrillianceRested = false;
  }
};

/* -------------------------------------------- */

HOOKS.sentinel00000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.id !== "reactiveStrike" ) return;
    for ( const events of action.eventsByTarget.values() ) {
      for ( const event of events.roll ) {
        if ( !event.isDamage ) continue;
        event.effects.push(SYSTEM.EFFECTS.slowed(this));
        break; // Slow each struck target at most once
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.skirmisher000000 = {
  defendAttack(item, action, origin, rollData) {
    if ( action.id === "reactiveStrike" ) rollData.banes[item.skirmisher] = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.inexorableFlame0 = {
  prepareSpells(_item, grimoire) {
    const flame = grimoire.runes.get("flame");
    if ( !flame ) return;
    grimoire.runes.set("flame", flame.clone({scaling: "wisdom"}, {once: true}));
  }
};

/* -------------------------------------------- */

HOOKS.gatheringStorm00 = {
  prepareSpells(_item, grimoire) {
    const storm = grimoire.runes.get("storm");
    if ( !storm ) return;
    grimoire.runes.set("storm", storm.clone({scaling: "wisdom"}, {once: true}));
  }
};

/* -------------------------------------------- */

HOOKS.flashFrost000000 = {
  prepareSpells(_item, grimoire) {
    const frost = grimoire.runes.get("frost");
    if ( !frost ) return;
    grimoire.runes.set("frost", frost.clone({scaling: "intellect"}, {once: true}));
  }
};

/* -------------------------------------------- */

HOOKS.acridEarth000000 = {
  prepareSpells(_item, grimoire) {
    const earth = grimoire.runes.get("earth");
    if ( !earth ) return;
    grimoire.runes.set("earth", earth.clone({scaling: "intellect"}, {once: true}));
  }
};

/* -------------------------------------------- */

HOOKS.livingBoulder000 = {
  prepareSpells(_item, grimoire) {
    const earth = grimoire.runes.get("earth");
    if ( !earth ) return;
    grimoire.runes.set("earth", earth.clone({scaling: "toughness"}, {once: true}));
  }
};

/* -------------------------------------------- */

HOOKS.bloodless0000000 = {
  defendAttack(_item, action, _origin, rollData) {
    if ( action.tags.has("strike") ) rollData.criticalSuccessThreshold += 2;
  },
  prepareDefenses() {
    this.statuses.delete("bleeding");
  }
};

/* -------------------------------------------- */

HOOKS.corrosiveStrikes = {
  applyCriticalEffects(_item, action) {
    if ( !action.tags.has("melee") ) return;
    for ( const [, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.damagesHealth ) continue;
        event.effects.push(SYSTEM.EFFECTS.corroding(this, {ability: "toughness"}));
        break;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.seasonedveteran0 = {
  prepareMovement(_item, movement) {
    movement.engagementBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.shieldward000000 = {
  prepareAction(_item, action) {
    if ( (action.gesture?.id === "ward") && this.equipment.weapons.shield ) action.cost.hands = 0;
  }
};

/* -------------------------------------------- */

HOOKS.snakeblood000000 = {
  prepareResistances(_item, resistances) {
    resistances.poison.base += 5;
  }
};

/* -------------------------------------------- */

HOOKS.sorcerer00000000 = {
  useAction(item, action) {
    if ( action.tags.has("iconicSpell") ) {
      throw new Error(_loc("SPELL.WARNINGS.SorcererNoIconic", {talent: item.name}));
    }
  },
  preActivateAction(item, action) {
    if ( action.tags.has("spell") ) {
      action.damage.bonus ??= 0;
      action.damage.bonus += this.grimoire.iconicSlots;
    }
  }
};

/* -------------------------------------------- */

HOOKS.spellblade000000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") ) return;
    const mh = this.equipment.weapons.mainhand;
    if ( mh.config.category.ranged ) return;

    // Add weapon damage bonus to Strike gesture
    if ( action.gesture.id === "strike" ) {
      action.damage.bonus = (action.damage.bonus ?? 0) + mh.system.damage.bonus;
    }

    // Reduce cost of spell following strike
    const lastAction = this.lastConfirmedAction;
    if ( lastAction?.tags.has("strike") ) action.cost.action -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.spellmute0000000 = {
  defendAttack(item, action, origin, rollData) {
    if ( action.tags.has("spell") ) rollData.banes.spellmute = {label: item.name, number: 2};
  },
  prepareActions(_item, actions) {
    for ( const [id, action] of Object.entries(actions) ) {
      if ( action.tags.has("spell") ) delete actions[id];
    }
    delete actions.cast;
  }
};

/* -------------------------------------------- */

HOOKS.spiritbreaker000 = {
  prepareAttack(_item, action, _target, rollData) {
    // Any action that attacks Morale finds the cracks in a foe's will, lowering its Critical Threshold
    if ( rollData.resource === "morale" ) {
      rollData.criticalSuccessThreshold = (rollData.criticalSuccessThreshold ?? 6) - 2;
    }
  },
  finalizeAction(_item, action) {
    // Stun a target this action renders Broken (Morale to 0); at finalize so it serializes and reverses cleanly
    for ( const [target, events] of action.eventsByTarget ) {
      if ( target === this ) continue;
      const morale = target.system?.resources?.morale;
      if ( !morale || (morale.value <= 0) ) continue; // No Morale pool, or already Broken
      let moraleDamage = 0;
      let breakEvent = null;
      for ( const event of events.roll ) {
        if ( !event.damagesMorale ) continue;
        moraleDamage += event.roll?.data?.damage?.total ?? 0;
        breakEvent ??= event;
      }
      if ( breakEvent && (moraleDamage >= morale.value) ) breakEvent.effects.push(SYSTEM.EFFECTS.stunned(this));
    }
  }
};

/* -------------------------------------------- */

HOOKS.stilllake0000000 = {
  defendAttack(item, action, _origin, rollData) {
    if ( !action.tags.has("skill") ) return;
    if ( SYSTEM.SKILLS[action.usage.skillId].category !== "soc" ) return;
    rollData.banes.stillLake = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.strikefirst00000 = {
  prepareAttack(item, action, target, rollData) {
    if ( !["strike", "spell"].some(t => action.tags.has(t)) ) return;
    const ac = this.combatant;
    const tc = target.combatant;
    if ( ac?.initiative > tc?.initiative ) rollData.boons.strikeFirst = {label: item.name, number: 1};
  }
};

/* -------------------------------------------- */

HOOKS.stronggrip000000 = {
  configureEquipment(_item, equipment) {
    equipment.weapons.heavyOffhand = true;
  },
  prepareWeapons(_item, weapons) {
    if ( weapons.twoHanded && weapons.mainhand?.config.category.scaling.includes("strength") ) {
      weapons.spellHands = Math.max(weapons.spellHands, 2);
    }
  },
  defendAttack(item, action, _origin, rollData) {
    const {twoHanded, mainhand} = this.equipment.weapons;
    if ( action.tags.has("disarm") && twoHanded && mainhand?.config.category.scaling.includes("strength") ) {
      rollData.banes.strongGrip = {label: item.name, number: 2};
    }
  }
};

/* -------------------------------------------- */

HOOKS.subtleextricatio = {
  defendAttack(item, action, _origin, rollData) {
    if ( action.id === "reactiveStrike" ) rollData.banes[item.id] = {label: item.name, number: 1};
  }
};

/* -------------------------------------------- */

HOOKS.surgeweaver00000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "storm", ability => SYSTEM.EFFECTS.shocked(this, {ability}));
  }
};

/* -------------------------------------------- */

HOOKS.swarm00000000000 = {
  prepareResources(_item, resources) {
    resources.health.bonus += resources.health.base;
  },
  prepareMovement(_item, movement) {
    const minSize = 2;
    const fullSize = movement.baseSize + movement.sizeBonus;
    if ( fullSize <= minSize ) return;
    const {value, max} = this.resources.health;
    if ( max <= 0 ) return;
    const ratio = Math.clamp(value / max, 0, 1);
    const newSize = Math.round(Math.mix(minSize, fullSize, ratio));
    movement.sizeBonus = newSize - movement.baseSize;
  },
  receiveAttack(_item, action, roll) {
    if ( action.target?.type !== "single" ) return;
    const dmg = roll.data.damage;
    if ( !roll.hasDamage || (dmg.total <= 0) ) return;
    dmg.resistance += this.abilities.toughness.value;
    dmg.total = crucible.api.models.CrucibleAction.computeDamage(dmg);
  }
};

/* -------------------------------------------- */

HOOKS.telekinetic00000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") || !["pull", "push"].includes(action.inflection?.id) ) return;
    if ( this.status.telekinetic ) return;
    action.cost.focus = Math.max(0, action.cost.focus - action.inflection.cost.focus);
    action.usage.actorStatus.telekinetic = true;
  }
};

/* -------------------------------------------- */

HOOKS.testudo000000000 = {
  defendAttack(item, action, _origin, rollData) {
    if ( action.tags.has("strike") && this.statuses.has("guarded") && this.equipment.weapons.shield ) {
      rollData.banes.testudo = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */

HOOKS.thermalVision000 = {
  prepareToken(_item, token) {
    token.detectionModes.thermalVision ??= {enabled: true, range: 60};
  }
};

/* -------------------------------------------- */

HOOKS.thickskin0000000 = {
  prepareResistances(_item, resistances) {
    resistances.bludgeoning.base += 2;
    resistances.slashing.base += 2;
    resistances.piercing.base += 2;
  }
};

/* -------------------------------------------- */

HOOKS.thoughtbinder000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "control", ability => SYSTEM.EFFECTS.dominated(this, {ability}));
  }
};

/* -------------------------------------------- */

HOOKS.truegrit00000000 = {
  prepareMovement(_item, movement) {
    movement.engagementBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.unarmedblocking0 = {
  prepareDefenses(_item, defenses) {
    const {mainhand, offhand} = this.equipment.weapons;
    const armed = (mainhand && (mainhand.config.category.id !== "unarmed"))
      || (offhand && (offhand.config.category.id !== "unarmed"));
    if ( armed ) return;
    const toughness = this.system.abilities.toughness.value;
    defenses.block.bonus += Math.ceil(toughness / 2);
  }
};

/* -------------------------------------------- */

HOOKS.voidcaller000000 = {
  applyCriticalEffects(_item, action) {
    applyRuneCritEffect(this, action, "oblivion", ability => SYSTEM.EFFECTS.entropy(this, {ability}));
  }
};

/* -------------------------------------------- */


HOOKS.weakpoints000000 = {
  prepareAttack(_item, action, target, rollData) {
    if ( !action.tags.has("strike") ) return;
    const weapon = action.usage.weapon;
    if ( !weapon?.system.config.category.scaling.includes("dexterity") ) return;
    if ( ["exposed", "flanked", "unaware"].some(s => target.statuses.has(s)) ) rollData.damageBonus += 2;
  }
};

/* -------------------------------------------- */

HOOKS.vowofanimus00000 = {
  // TODO would be better handled if hooks can exist on active effects as a defendAttack hook
  prepareAttack(item, action, target, rollData) {
    if ( !["strike", "skill"].some(t => action.tags.has(t)) ) return;
    if ( !target.effects.has(SYSTEM.EFFECTS.getEffectId(item.actions[0].id)) ) return;
    rollData.boons.vowOfAnimus = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.warmage000000000 = {
  prepareAction(item, action) {
    if ( action.id === "counterspell" ) action.usage.boons.warMage = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.wizard0000000000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("spell") ) return;
    if ( this.status.wizardMomentum ) return; // The discount may apply at most once per turn

    // Spellcasting momentum: a Spell cast immediately after another Spell this turn costs 1 less Focus
    if ( this.status.hasCast && this.lastConfirmedAction?.tags.has("spell") ) {
      action.cost.focus = Math.max(action.cost.focus - 1, 0);
      action.usage.actorStatus.wizardMomentum = true;
    }
  }
};

/* -------------------------------------------- */

HOOKS.disarmingriposte = {
  applyCriticalEffects(item, action) {
    if ( action.id !== "counterRiposte" ) return;
    for ( const event of action.events ) {
      if ( (event.target === this) || !event.isCriticalSuccess ) continue;
      const {mainhand} = event.target.equipment.weapons;
      if ( !mainhand?.id ) continue;
      action.recordEvent({
        type: "actorUpdate",
        target: event.target,
        actorUpdates: {items: [{_id: mainhand.id, system: {dropped: true, equipped: false}}]},
        itemSnapshots: [mainhand.snapshot()],
        statusText: [{text: _loc("ACTOR.DisarmedStatus"), fontSize: 64}]
      }, {index: action.events.indexOf(event) + 1});
      return;
    }
  }
};

/* -------------------------------------------- */

HOOKS.duelist000000000 = {
  _isDueling(actor) {
    const w = actor.equipment.weapons;
    const mh = w.mainhand;
    const cat = mh?.config?.category;
    return mh?.id && !w.twoHanded && !w.shield && !w.offhand?.id && (cat?.hands < 2) && !cat?.ranged
      && !actor.statuses.has("flanked");
  },
  prepareDefenses(_item, defenses) {
    if ( crucible.api.hooks.talent.duelist000000000._isDueling(this) ) defenses.parry.bonus += 2;
  },
  receiveAttack(_item, _action, roll) {
    const T = roll.constructor.RESULT_TYPES;
    if ( roll.data.result !== T.GLANCE ) return;
    if ( !crucible.api.hooks.talent.duelist000000000._isDueling(this) ) return;
    roll.data.result = T.PARRY;
    roll.data.damage.total = 0;
  }
};

/* -------------------------------------------- */

HOOKS.warchanter000000 = {
  _CHANT_IDS: new Set([
    "songMight0000000", "songAlacrity0000", "songEndurance000",
    "dirgeFeebleness0", "dirgeLethargy000", "dirgeFragility00"
  ]),
  finalizeAction(_item, action) {
    if ( !action.tags.has("melee") ) return;
    const {HIT} = game.system.api.dice.AttackRoll.RESULT_TYPES;
    const landedHit = action.events.some(e => (e.target !== this) && (e.roll?.data?.result >= HIT));
    if ( !landedHit ) return;
    const chants = this.effects.filter(e => HOOKS.warchanter000000._CHANT_IDS.has(e.id));
    if ( !chants.length ) return;

    // Lowest remaining duration is renewed first; ties favor the more recently started Chant
    chants.sort((a, b) => (a.duration.remaining - b.duration.remaining)
      || ((b._stats?.createdTime ?? 0) - (a._stats?.createdTime ?? 0)));
    const chant = chants[0];
    action.recordEvent({type: "effect", target: this, effects: [{
      _id: chant.id, _action: "update", duration: {value: (chant.duration.value ?? 0) + 1}
    }]});
  }
};

/* -------------------------------------------- */

HOOKS.ancestralForm000 = {
  prepareMovement(_item, movement) {
    movement.blockerStrength = SYSTEM.ACTOR.MOVEMENT_STRENGTHS.WEAK;
    movement.flankingStrength = 3;
    movement.baseStride = movement.strideBonus = 0;
    movement.engagementBonus = 1;
  },
  prepareResources(_item, resources) {
    for ( const r of ["action", "focus", "heroism"] ) {
      resources[r].base = 0;
      resources[r].bonus = 0;
    }
  },
  prepareResistances(_item, resistances) {
    for ( const r of Object.values(resistances) ) r.immune = true;
  }
};

/* -------------------------------------------- */

HOOKS.warden0000000000 = {
  _GROVE_EFFECT_ID: "ancestralGrove00",
  finalizeAction(_item, action) {
    if ( !action.tags.has("strike") ) return;
    const amount = Math.floor(this.system.abilities.wisdom.value / 2);
    if ( amount <= 0 ) return;

    // Partition the grove region's natively-tracked tokens into drainable foes and standing allies
    const regions = this.effects.get(HOOKS.warden0000000000._GROVE_EFFECT_ID)?.system.regions;
    if ( !regions?.size ) return;
    const friendly = action.token?.disposition;
    const foes = new Set();
    const allies = new Set();
    for ( const uuid of regions ) {
      const region = fromUuidSync(uuid);
      if ( !region ) continue;
      for ( const token of region.tokens ) {
        const actor = token.actor;
        if ( !actor ) continue;
        if ( (token.disposition === friendly) || (actor === this) ) {
          const health = actor.system.resources.health;
          if ( !actor.system.isIncapacitated && health.max ) allies.add(actor);
        }
        else foes.add(actor);
      }
    }

    // Each foe struck (Hit or better) within the grove suffers half-Wisdom Poison, drained once as it is found
    const {HIT} = game.system.api.dice.AttackRoll.RESULT_TYPES;
    const drained = new Set();
    for ( const event of action.events ) {
      const foe = event.target;
      if ( (foe === this) || !(event.roll?.data?.result >= HIT) ) continue;
      if ( !foes.has(foe) || drained.has(foe) ) continue;
      action.recordEvent({target: foe, resources: [{resource: "health", delta: -amount, damageType: "poison"}]});
      drained.add(foe);
    }
    if ( !drained.size ) return;

    // Transfer the drained life as one half-Wisdom heal per foe to allies: weakest first,
    const healed = [...allies].sort((a, b) =>
      a.system.resources.health.value - b.system.resources.health.value).slice(0, drained.size);
    for ( const ally of healed ) {
      action.recordEvent({target: ally, resources: [{resource: "health", delta: amount}]});
    }
  }
};

/* -------------------------------------------- */

export default HOOKS;
