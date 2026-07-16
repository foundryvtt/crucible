import {SKILLS} from "./skills.mjs";
import {ABILITIES, DAMAGE_TYPES, RESOURCES} from "./attributes.mjs";
import {MOVEMENT_ACTIONS} from "./actor.mjs";
import {defineEnum, defineIntEnum} from "./enum.mjs";
import AttackRoll from "../dice/attack-roll.mjs";

/**
 * The different required conditions under which an Active Effect can be applied from an Action.
 * @type {Readonly<Record<string, {id: string, label: string}>>}
 */
export const EFFECT_RESULT_TYPES = defineEnum({
  any: {
    label: "ACTION.EFFECT_RESULT_TYPES.Any"
  },
  custom: {
    label: "ACTION.EFFECT_RESULT_TYPES.Custom"
  },
  success: {
    label: "ACTION.EFFECT_RESULT_TYPES.Success"
  },
  successCritical: {
    label: "ACTION.EFFECT_RESULT_TYPES.CriticalSuccess"
  },
  failure: {
    label: "ACTION.EFFECT_RESULT_TYPES.Failure"
  },
  failureCritical: {
    label: "ACTION.EFFECT_RESULT_TYPES.CriticalFailure"
  }
});

/**
 * The scope of creatures affected by an action.
 * @enum {number}
 */
export const TARGET_SCOPES = defineIntEnum({
  NONE: {value: 0, label: "ACTION.TARGET_SCOPES.None"},
  SELF: {value: 1, label: "ACTION.TARGET_SCOPES.Self"},
  ALLIES: {value: 2, label: "ACTION.TARGET_SCOPES.Allies"},
  ENEMIES: {value: 3, label: "ACTION.TARGET_SCOPES.Enemies"},
  ALL: {value: 4, label: "ACTION.TARGET_SCOPES.All"}
});

/**
 * @typedef ActionTargetType
 * @property {string} id                        The target type id
 * @property {string} label                     Localization key for the target type label
 * @property {ActionTargetRegion|null} region   Region placement config, or null
 * @property {number} scope                     The TARGET_SCOPES value for this type
 */

/**
 * @typedef ActionTargetRegion
 * @property {string} shape             The Region shape type from BaseShapeData.TYPES
 * @property {boolean} ephemeral        Default behavior: true if no RegionDocument is created.
 *                                      Individual actions may override this default.
 * @property {"self"|"vertex"} anchor   Placement position: "self" (token center) or "vertex" (snapped to grid corner)
 * @property {number} [angle]           Interior angle in degrees, for cone shapes
 * @property {number} [width]           Width in grid units, for line and rectangle shapes
 * @property {number} [size]            Size in grid units, for rectangle shapes
 * @property {number} [direction]       Initial rotation direction in degrees
 * @property {number} [directionDelta]  Snap increment in degrees for rotation
 * @property {boolean} [addSize]        Whether to add the acting token's size to the shape radius
 */

/**
 * The allowed target types which an Action may have.
 * @type {Readonly<Record<string, ActionTargetType>>}
 */
export const TARGET_TYPES = defineEnum({
  none: {
    label: "ACTION.TARGET_TYPES.None",
    region: null,
    scope: TARGET_SCOPES.NONE
  },
  self: {
    label: "ACTION.TARGET_TYPES.Self",
    region: null,
    scope: TARGET_SCOPES.SELF
  },
  single: {
    label: "ACTION.TARGET_TYPES.Single",
    region: null,
    scope: TARGET_SCOPES.ALL
  },
  cone: {
    label: "ACTION.TARGET_TYPES.Cone",
    region: {
      shape: "cone",
      angle: 60,
      directionDelta: 15,
      anchor: "self",
      addSize: true,
      ephemeral: true
    },
    scope: TARGET_SCOPES.ALL
  },
  fan: {
    label: "ACTION.TARGET_TYPES.Fan",
    region: {
      shape: "cone",
      angle: 210,
      directionDelta: 15,
      anchor: "self",
      addSize: true,
      ephemeral: true
    },
    scope: TARGET_SCOPES.ALL
  },
  pulse: {
    label: "ACTION.TARGET_TYPES.Pulse",
    region: {
      shape: "circle",
      anchor: "self",
      addSize: true,
      ephemeral: true
    },
    scope: TARGET_SCOPES.ALL
  },
  aura: {
    label: "ACTION.TARGET_TYPES.Aura",
    region: {
      shape: "emanation",
      anchor: "self",
      addSize: false, // Accounted for directly by emanation shape
      ephemeral: false
    },
    scope: TARGET_SCOPES.ALL
  },
  blast: {
    label: "ACTION.TARGET_TYPES.Blast",
    region: {
      shape: "circle",
      anchor: "vertex",
      ephemeral: true
    },
    scope: TARGET_SCOPES.ALL
  },
  ray: {
    label: "ACTION.TARGET_TYPES.Ray",
    region: {
      shape: "line",
      width: 1,
      directionDelta: 3,
      anchor: "self",
      addSize: true,
      ephemeral: true
    },
    scope: TARGET_SCOPES.ALL
  },
  summon: {
    label: "ACTION.TARGET_TYPES.Summon",
    region: {
      shape: "rectangle",
      size: 3,
      anchor: "vertex",
      ephemeral: true
    },
    scope: TARGET_SCOPES.SELF
  },
  wall: {
    label: "ACTION.TARGET_TYPES.Wall",
    region: {
      shape: "line",
      width: 2,
      anchor: "vertex",
      ephemeral: false
    },
    scope: TARGET_SCOPES.ALL
  },
  movement: {
    label: "ACTION.TARGET_TYPES.Movement",
    region: null,
    scope: TARGET_SCOPES.ALL
  }
});

/* -------------------------------------------- */

/**
 * Categories of action tags which are supported by the system.
 * @type {Readonly<Record<string, {id: string, label: string}>>}
 */
export const TAG_CATEGORIES = defineEnum({
  attack: {label: "ACTION.TAG_CATEGORIES.Attack"},
  spellcraft: {label: "ACTION.TAG_CATEGORIES.Spellcraft"},
  skills: {label: "ACTION.TAG_CATEGORIES.Skills"},
  requirements: {label: "ACTION.TAG_CATEGORIES.Requirements"},
  context: {label: "ACTION.TAG_CATEGORIES.Context"},
  movement: {label: "ACTION.TAG_CATEGORIES.Movement"},
  modifiers: {label: "ACTION.TAG_CATEGORIES.Modifiers"},
  defenses: {label: "ACTION.TAG_CATEGORIES.Defenses"},
  damage: {label: "ACTION.TAG_CATEGORIES.Damage"},
  scaling: {label: "ACTION.TAG_CATEGORIES.Scaling"},
  resources: {label: "ACTION.TAG_CATEGORIES.Resources"},
  special: {label: "ACTION.TAG_CATEGORIES.Special"}
});

/* -------------------------------------------- */

/**
 * @typedef ActionTag
 * @property {string} tag             The tag identifier
 * @property {string} label           A short label for this tag
 * @property {string} [tooltip]       A tooltip displayed when this tag is hovered
 * @property {string[]} propagate     Propagate this tag to also apply other tags
 * @property {number} [priority]      A priority that this tag should be resolved in. Lower values are higher priority
 * @property {number} [category]      A category that determines how this tag is grouped and sorted
 * @property {(this: CrucibleAction) => void} [initialize]
 * @property {(this: CrucibleAction) => void} [prepare]
 * @property {(this: CrucibleAction) => void} [canUse]
 * @property {(this: CrucibleAction, targets: ActionUseTarget[]) => void} [preActivate]
 * @property {(this: CrucibleAction) => void} [postActivate]
 * @property {(this: CrucibleAction, target: CrucibleActor, token: CrucibleTokenObject) => void} [roll]
 * @property {(this: CrucibleAction, reverse: boolean) => Promise<void>} [confirm]
 * @property {(this: CrucibleAction, reverse: boolean) => Promise<void>} [postConfirm]
 * @property {(this: CrucibleAction, vfxConfig: object|null) => object|null} [configureVFX]
 * @property {(this: CrucibleAction, vfxEffect: VFXEffect, references: Record<string, any>) => void} [resolveVFX]
 * @property {(this: CrucibleAction, vfxEffect: VFXEffect, references: Record<string, any>) => void} [finalizeVFX]
 */

/**
 * Define special logic for action tag types
 * @type {Record<string, ActionTag>}
 */
export const TAGS = {

  /* -------------------------------------------- */
  /*  Required Equipment                          */
  /* -------------------------------------------- */

  // Requires Dual-Wield
  dualwield: {
    tag: "dualwield",
    label: "ACTION.TAG.DualWield",
    tooltip: "ACTION.TAG.DualWieldTooltip",
    category: "requirements",
    canUse() {
      return this.actor.equipment.weapons.dualWield;
    }
  },

  // Requires One-Handed weapon
  onehand: {
    tag: "onehand",
    label: "ACTION.TAG.OneHand",
    tooltip: "ACTION.TAG.OneHandTooltip",
    category: "requirements",
    canUse() {
      return !this.actor.equipment.weapons.twoHanded;
    }
  },

  // Requires Dexterity Weapon
  finesse: {
    tag: "finesse",
    label: "ACTION.TAG.Finesse",
    tooltip: "ACTION.TAG.FinesseTooltip",
    category: "requirements",
    priority: 5,
    prepare() {
      for ( const c of this.usage.weaponChoices ?? [] ) {
        if ( !c.item.config.category.scaling.includes("dexterity") ) c.viable = false;
      }
    },
    canUse() {
      if ( !this.usage.strikes.every(w => w.config.category.scaling.includes("dexterity")) ) {
        throw new Error(_loc("ACTION.WARNINGS.MustScaleDex"));
      }
    }
  },

  // Requires Strength Weapon
  brute: {
    tag: "brute",
    label: "ACTION.TAG.Brute",
    tooltip: "ACTION.TAG.BruteTooltip",
    category: "requirements",
    priority: 5,
    prepare() {
      for ( const c of this.usage.weaponChoices ?? [] ) {
        if ( !c.item.config.category.scaling.includes("strength") ) c.viable = false;
      }
    },
    canUse() {
      if ( !this.usage.strikes.every(w => w.config.category.scaling.includes("strength")) ) {
        throw new Error(_loc("ACTION.WARNINGS.MustScaleStrength"));
      }
    }
  },

  // Requires a Projectile Weapon
  projectile: {
    tag: "projectile",
    label: "ACTION.TAG.Projectile",
    tooltip: "ACTION.TAG.ProjectileTooltip",
    category: "requirements",
    priority: 5,
    propagate: ["ranged"],
    prepare() {
      for ( const c of this.usage.weaponChoices ?? [] ) {
        if ( !["projectile1", "projectile2"].includes(c.item.system.category) ) c.viable = false;
      }
    },
    canUse() {
      return this.usage.strikes.every(w => ["projectile1", "projectile2"].includes(w.system.category));
    }
  },

  // Requires a Mechanical Weapon
  mechanical: {
    tag: "mechanical",
    label: "ACTION.TAG.Mechanical",
    tooltip: "ACTION.TAG.MechanicalTooltip",
    category: "requirements",
    priority: 5,
    propagate: ["ranged"],
    prepare() {
      for ( const c of this.usage.weaponChoices ?? [] ) {
        if ( !["mechanical1", "mechanical2"].includes(c.item.system.category) ) c.viable = false;
      }
    },
    canUse() {
      return this.usage.strikes.every(w => ["mechanical1", "mechanical2"].includes(w.system.category));
    }
  },

  // Requires Shield
  shield: {
    tag: "shield",
    label: "ACTION.TAG.Shield",
    tooltip: "ACTION.TAG.ShieldTooltip",
    category: "requirements",
    canUse() {
      return this.actor.equipment.weapons.shield;
    }
  },

  // Requires Talisman Weapon
  talisman: {
    tag: "talisman",
    label: "ACTION.TAG.Talisman",
    tooltip: "ACTION.TAG.TalismanTooltip",
    category: "requirements",
    priority: 5,
    propagate: ["strike"],
    prepare() {
      for ( const c of this.usage.weaponChoices ?? [] ) {
        if ( !c.item.config.category.training.includes("talisman") ) c.viable = false;
      }
    },
    canUse() {
      if ( !this.usage.strikes.length
        || !this.usage.strikes.every(w => w.config.category.training.includes("talisman")) ) {
        throw new Error(_loc("ACTION.WARNINGS.RequiresTalisman", {action: this.name}));
      }
    }
  },

  // Requires Unarmed
  unarmed: {
    tag: "unarmed",
    label: "ACTION.TAG.Unarmed",
    tooltip: "ACTION.TAG.UnarmedTooltip",
    category: "requirements",
    propagate: ["melee"],
    canUse() {
      return this.actor.equipment.weapons.unarmed;
    }
  },

  // Requires Unarmored
  unarmored: {
    tag: "unarmored",
    label: "ACTION.TAG.Unarmored",
    tooltip: "ACTION.TAG.UnarmoredTooltip",
    category: "requirements",
    canUse() {
      return this.actor.equipment.unarmored;
    }
  },

  // After a Basic Strike
  afterStrike: {
    tag: "afterStrike",
    label: "ACTION.TAG.AfterStrike",
    tooltip: "ACTION.TAG.AfterStrikeTooltip",
    category: "requirements",
    canUse() {
      const lastAction = this.actor.lastConfirmedAction;
      if ( lastAction?.id !== "strike" ) {
        throw new Error(_loc("ACTION.WARNINGS.MustFollowStrike", {action: this.name}));
      }
      for ( const [actor, events] of lastAction.eventsByActor ) {
        if ( actor === this.actor ) continue;
        if ( events.isCriticalFailure ) {
          throw new Error(_loc("ACTION.WARNINGS.LastCriticallyMissed", {action: this.name}));
        }
      }
    }
  },

  // Immediately follows a Rest
  rest: {
    tag: "rest",
    label: "ACTION.TAG.Rest",
    tooltip: "ACTION.TAG.RestTooltip",
    category: "requirements",
    propagate: ["noncombat"],
    canUse() {
      if ( this.actor.lastConfirmedAction?.id !== "rest" ) {
        throw new Error(_loc("ACTION.WARNINGS.MustFollowRest", {action: this.name}));
      }
    }
  },

  // Requires the ability to speak
  vocal: {
    tag: "vocal",
    label: "ACTION.TAG.Vocal",
    tooltip: "ACTION.TAG.VocalTooltip",
    category: "requirements",
    canUse() {
      if ( this.actor.statuses.has("silenced") ) throw new Error(game.i18n.localize("ACTION.WARNINGS.Silenced"));
    }
  },

  // Requires the ability to hear
  auditory: {
    tag: "auditory",
    label: "ACTION.TAG.Auditory",
    tooltip: "ACTION.TAG.AuditoryTooltip",
    category: "requirements",
    preActivate() {
      // Remove targets which are deafened
      for ( const [actor] of this.targets ) {
        if ( actor.statuses.has("deafened") ) this.targets.delete(actor);
      }
    }
  },

  /* -------------------------------------------- */
  /*  Context Requirements                        */
  /* -------------------------------------------- */

  // Requires Reaction
  reaction: {
    tag: "reaction",
    label: "ACTION.TAG.Reaction",
    tooltip: "ACTION.TAG.ReactionTooltip",
    category: "context",
    canUse() {
      if ( !this.actor.inCombat ) return false;
      if ( this.actor.statuses.has("unaware") ) throw new Error(_loc("ACTION.WARNINGS.ReactionUnaware"));
      if ( !this.actor.abilities.dexterity.value ) throw new Error(_loc("ACTION.WARNINGS.NoAbility", {
        actor: this.actor.name,
        ability: SYSTEM.ABILITIES.dexterity.label,
        action: this.name
      }));
      return this.actor !== game.combat?.combatant?.actor;
    },
    prepare() {
      const a = this.actor;
      const canFreeReact = a.talentIds.has("gladiator0000000") && !a.system.status.gladiator
        && (this.tags.has("mainhand") || this.tags.has("offhand"));
      if ( canFreeReact ) {
        this.cost.focus = -Infinity;
        this.usage.actorStatus.gladiator = true;
      }
    }
  },

  // Non-Combat Actions
  noncombat: {
    tag: "noncombat",
    label: "ACTION.TAG.NonCombat",
    tooltip: "ACTION.TAG.NonCombatTooltip",
    category: "context",
    canUse() {
      if ( this.actor.inCombat ) throw new Error(_loc("ACTION.WARNINGS.NonCombat", {action: this.name}));
    }
  },

  // Requires a Flanked Opponent
  flanking: {
    tag: "flanking",
    label: "ACTION.TAG.Flanking",
    tooltip: "ACTION.TAG.FlankingTooltip",
    category: "context",
    acquireTargets(targets) {
      for ( const target of targets ) {
        if ( !target.actor.statuses.has("flanked") ) target.error ??= _loc("ACTION.WARNINGS.NotFlanked", {action: this.name, target: target.actor.name});
      }
    }
  },

  // Consumables
  consume: {
    tag: "consume",
    label: "ACTION.TAG.Consume",
    tooltip: "ACTION.TAG.ConsumeTooltip",
    category: "special",
    initialize() {
      if ( this.item?.type === "consumable" ) this.usage.consumable = this.item;
    },
    canUse() {
      const item = this.usage.consumable;
      if ( !item ) throw new Error(_loc("ACTION.WARNINGS.NoConsumable", {action: this.id}));
      if ( item.system.isDepleted ) {
        throw new Error(_loc("ACTION.WARNINGS.NoConsumableUses", {item: item.name, action: this.id}));
      }
    },
    preActivate() {
      const item = this.usage.consumable;
      const updateEvent = this.selfUpdateEvent;
      updateEvent.itemSnapshots.push(item.snapshot());
      updateEvent.actorUpdates.items.push(item.system.consume(1, {save: false}));
    }
  },

  /* -------------------------------------------- */
  /*  Spellcasting Tags                           */
  /* -------------------------------------------- */

  spell: {
    tag: "spell",
    label: "ACTION.TAG.Spell",
    tooltip: "ACTION.TAG.SpellTooltip",
    category: "spellcraft",
    priority: 1,
    initialize() {
      Object.assign(this.usage.context, {
        type: "spell",
        label: "Spell Tags",
        icon: "fa-solid fa-sparkles",
        tags: {}
      });
    },
    prepare() {
      this.usage.actorStatus.hasCast = true;
    },
    async roll(target) {
      const roll = await this.actor.spellAttack(this, target);
      if ( roll ) this.recordEvent({type: "spell", target, roll});
    }
  },

  // Composed Spells
  composed: {
    tag: "composed",
    label: "ACTION.TAG.Composed",
    tooltip: "ACTION.TAG.ComposedTooltip",
    category: "spellcraft",
    priority: 2,
    initialize() {
      if ( this.composition === 0 ) return;
      this.usage.context.tags.rune = _loc("SPELL.COMPONENTS.RuneSpecific", {rune: this.rune.name});
      this.usage.context.tags.gesture = _loc("SPELL.COMPONENTS.GestureSpecific", {gesture: this.gesture.name});
      if ( this.inflection ) this.usage.context.tags.inflection = _loc("SPELL.COMPONENTS.InflectionSpecific", {inflection: this.inflection.name});
      this.usage.actorFlags.lastSpell = this.id;
      this.usage.isAttack = true;
      this.usage.isRanged = (this.gesture.target.type !== "self") && (this.range.maximum > 1);
    },
    configureVFX(vfxConfig) {
      return crucible.api.canvas.vfx.spells.configureSpellVFXEffect(this, vfxConfig);
    },
    resolveVFX(vfxEffect, references) {
      crucible.api.canvas.vfx.spells.resolveSpellVFXReferences(this, vfxEffect, references);
    },
    finalizeVFX(vfxEffect, references) {
      crucible.api.canvas.vfx.spells.finalizeSpellVFXEffect(this, vfxEffect, references);
    }
  },

  // Iconic Spell
  iconicSpell: {
    tag: "iconicSpell",
    label: "ACTION.TAG.IconicSpell",
    tooltip: "ACTION.TAG.SpellTooltip",
    category: "spellcraft",
    priority: 2
  },

  summon: {
    tag: "summon",
    label: "ACTION.TAG.Summon",
    tooltip: "ACTION.TAG.SummonTooltip",
    category: "special",
    canUse() {
      if ( !this.usage.summons?.length || this.usage.summons.some(s => !s.actorUuid) ) {
        throw new Error(_loc("ACTION.WARNINGS.MisconfiguredSummon", { action: this.name }));
      }
    },
    async postActivate() {
      const summonEvents = this.events.filter(e => e.type === "summon");
      if ( !summonEvents.length ) return;
      const effectEvents = this.events.filter(e => (e.target === this.actor) && e.effects.length);
      for ( const event of summonEvents ) {
        const position = this.region?.shapes[0] || this.token;
        event.summon.tokenData ||= {};
        event.summon.tokenData.x ??= position.x;
        event.summon.tokenData.y ??= position.y;
        if ( this.token ) {
          event.summon.tokenData.elevation ??= this.token.elevation;
          event.summon.tokenData.level ??= this.token.level;
        }
        if ( (event.summon.permanent === false) && !effectEvents.length ) {
          throw new Error(_loc("ACTION.WARNINGS.MissingSummonEffect", {action: this.id}));
        }
      }
    },
    async confirm(reverse) {
      if ( reverse ) return; // TODO support reverse
      if ( !this.token ) return; // No token acting  TODO eventually this shouldn't be required?
      const summonEvents = this.events.filter(e => e.type === "summon");
      if ( !summonEvents.length ) return;

      // Create summoned tokens, track non-permanent ones
      const summonedTokens = [];
      for ( const event of summonEvents ) {
        const summon = event.summon;

        // Get or create a world level Actor for the summons
        const sourceActor = await fromUuid(summon.actorUuid);
        const ownership = this.actor.hasPlayerOwner ? {default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER} : {};
        let worldActor = game.actors.get(sourceActor.id);
        if ( !worldActor ) {
          worldActor = await game.actors.importFromCompendium(sourceActor.collection, sourceActor.id, {ownership},
            {keepId: true, clearOwnership: false});
        }
        else await worldActor.update({ownership});

        // Create Token
        const tokenName = worldActor.name;
        const tokenData = foundry.utils.mergeObject({
          name: tokenName,
          disposition: this.actor.prototypeToken.disposition,
          delta: {
            name: tokenName,
            system: {
              resources: {
                "health.value": worldActor.resources.health.max,
                "morale.value": worldActor.resources.morale.max,
                "action.value": worldActor.resources.action.max,
                "focus.value": worldActor.resources.focus.max
              }
            }
          }
        }, summon.tokenData || {});
        Object.assign(tokenData, {actorId: worldActor.id, actorLink: false});
        const preparedToken = await worldActor.getTokenDocument(tokenData, {parent: this.token.parent});
        const token = await TokenDocument.implementation.create(preparedToken, {parent: this.token.parent});
        if ( !event.summon.permanent ) summonedTokens.push(token.uuid);

        // Create a Combatant, unless opted-out
        if ( this.actor.inCombat && (event.summon.combatant !== false) ) {
          await game.combat.createEmbeddedDocuments("Combatant", [{
            tokenId: token.id,
            sceneId: canvas.scene.id,
            actorId: worldActor.id,
            initiative: 1
          }]);
        }
      }

      // Update Active Effect with summoned token UUIDs
      const effectEvent = this.events.find(e => (e.target === this.actor) && e.effects.length);
      const ae = effectEvent?.effects[0];
      if ( ae ) ae.system.summons = summonedTokens;
    }
  },

  /* -------------------------------------------- */
  /*  Attack Rolls                                */
  /* -------------------------------------------- */

  // Perform a Strike sequence
  strike: {
    tag: "strike",
    priority: Infinity, // Last
    internal: true,
    initialize() {
      this.usage.strikes = []; // Reset strike sequence
    },
    prepare() {
      // Capture the non-weapon cost before weapon cost is added, so candidate affordability can be measured against it
      this.usage.baseActionCost = this.cost.action;
      this.usage.focusBlock.enraged = false; // Strikes may be made while enraged

      // Resolve a specific weapon when a choice is allowed. Honor explicit user selection as usage.weaponChoice.
      // Otherwise, pick the best available weapon for the current target.
      if ( this.usage.weaponChoices ) {
        const choices = this.getValidWeaponChoices();
        const locked = this.usage.weaponChoice ? choices.find(c => c.id === this.usage.weaponChoice)?.item : null;
        const target = (canvas.ready && this.token?.object && game.user.targets.size)
          ? game.user.targets.values().next().value : null;
        this.usage.weapon = locked ?? choices.reduce((best, c) => {
          let {rank} = this._getWeaponAvailability(c.item, {target});
          if ( c.item.system.properties.has("natural") ) rank -= 0.5; // Prefer equipped > natural at same rank
          return (!best || (rank > best.rank)) ? {item: c.item, rank} : best;
        }, null)?.item;
      }
      const strikes = this.usage.strikes;

      // Default weapon-based strikes
      if ( !strikes.length && this.usage.weapon ) strikes.push(this.usage.weapon);
      if ( !strikes.length ) return;

      // Reflect the struck weapon as the action's weapon for downstream hooks on forced-weapon actions
      this.usage.weapon ??= strikes[0];

      // Record usage properties
      this.usage.actorStatus.hasAttacked = true;
      this.usage.hasDice = true;
      this.usage.isAttack = true;
      if ( this.tags.has("ranged") ) {
        if ( strikes.every(w => w.config.category.ranged) ) this.usage.isRanged = true;
        else this.tags.delete("ranged");
      }
      if ( this.tags.has("melee") ) {
        if ( strikes.every(w => !w.config.category.ranged) ) this.usage.isMelee = true;
        else this.tags.delete("melee");
      }
      this.usage.defenseType ??= "physical";

      // Prepare cost and range for the base strike sequence
      let weaponRange = 0;
      const contextTags = {};
      for ( const [i, weapon] of strikes.entries() ) {
        this.scaling.push(...weapon.config.category.scaling.split("."));
        if ( this.cost.weapon ) this.cost.action += (weapon.system.actionCost || 0);
        if ( this.range.weapon ) {
          if ( !weaponRange ) weaponRange = weapon.system.range;
          else weaponRange = Math.min(weaponRange, weapon.system.range);
        }
        contextTags[weapon.id] ||= {id: weapon.id, name: weapon.name, count: 0};
        contextTags[weapon.id].count += 1;
        if ( i === 0 ) Object.assign(this.usage.bonuses, weapon.system.actionBonuses);
      }

      // Repeat the sequence if multiple attacks are performed
      const n = this.target.multiple ?? 1;
      if ( n > 1 ) {
        const baseSequence = [...strikes];
        for ( let i=1; i<n; i++ ) {
          strikes.push(...baseSequence);
        }
      }

      // Context tags
      Object.assign(this.usage.context, {label: "Strikes", icon: "fa-solid fa-swords", tags: {}});
      for ( const v of Object.values(contextTags) ) {
        const count = v.count * n;
        this.usage.context.tags[`weapon.${v.id}`] = count > 1 ? `${v.name} (x${count})` : v.name;
      }

      // Configure action range
      if ( this.range.weapon ) {
        this.usage.weaponRange = weaponRange;
        if ( this.target.type !== "movement" ) { // Movement uses weapon range at the terminal waypoint
          const baseMaximum = this._source.range.maximum ?? 0;
          this.range.maximum = Math.max(this.range.maximum ?? 0, baseMaximum + weaponRange);
        }
      }
    },
    acquireTargets(targets) {
      const weapon = this.usage.strikes[0];
      if ( !weapon ) return;
      for ( const t of targets ) {
        if ( t.error || !t.token?.object ) continue;
        const {reason} = this._getWeaponAvailability(weapon, {target: t.token.object});
        if ( reason === "notLoaded" ) t.error = _loc("ACTION.WARNINGS.MustReload");
        else if ( reason === "dropped" ) t.error = _loc("ACTION.WARNINGS.WeaponDropped");
      }
    },
    preActivate() {
      const updateEvent = this.selfUpdateEvent;
      for ( const w of this.usage.strikes ) {
        updateEvent.itemSnapshots.push(w.snapshot());
        if ( w.config.category.reload ) {
          updateEvent.actorUpdates.items.push({_id: w.id, "system.loaded": false});
        }
      }
    },
    async roll(target) {
      for ( const [i, weapon] of this.usage.strikes.entries() ) {
        const roll = await this.actor.weaponAttack(this, weapon, target);
        roll.data.strike = i;
        this.recordEvent({type: "strike", target, roll, weapon: weapon.snapshot()});
      }
    },
    configureVFX(vfxConfig) {
      return crucible.api.canvas.vfx.strikes.configureStrikeVFXEffect(this, vfxConfig);
    }
  },

  // Requires a Melee Weapon
  melee: {
    tag: "melee",
    label: "ACTION.TAG.Melee",
    tooltip: "ACTION.TAG.MeleeTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 1,
    prepare() {
      // A melee action cannot use a ranged weapon unless the action is also ranged-capable
      if ( !this.tags.has("ranged") ) {
        for ( const c of this.usage.weaponChoices ?? [] ) {
          if ( c.item.config.category.ranged ) c.viable = false;
        }
      }
    },
    canUse() {
      if ( !this.actor.equipment.weapons.melee ) {
        throw new Error(_loc("ACTION.WARNINGS.RequiresMelee"));
      }
    }
  },

  // Requires a Ranged Weapon
  ranged: {
    tag: "ranged",
    label: "ACTION.TAG.Ranged",
    tooltip: "ACTION.TAG.RangedTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 1,
    canUse() {
      if ( !this.actor.equipment.weapons.ranged ) {
        throw new Error(_loc("ACTION.WARNINGS.RequiresRanged"));
      }
    },
    prepare() {
      this.usage.actorStatus.rangedAttack = true;

      // A ranged action cannot use a melee weapon unless the action is also melee-capable
      if ( !this.tags.has("melee") ) {
        for ( const c of this.usage.weaponChoices ?? [] ) {
          if ( !c.item.config.category.ranged ) c.viable = false;
        }
      }
    }
  },

  mainhand: {
    tag: "mainhand",
    label: "ACTION.TAG.MainHand",
    tooltip: "ACTION.TAG.MainHandTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 9,
    prepare() {
      this.usage.strikes ||= [];
      const mh = this.actor.equipment.weapons.mainhand;
      if ( mh ) this.usage.strikes.push(mh);
    }
  },

  twohand: {
    tag: "twohand",
    label: "ACTION.TAG.TwoHanded",
    tooltip: "ACTION.TAG.TwoHandedTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 9,
    prepare() {
      this.usage.strikes ||= [];
      const mh = this.actor.equipment.weapons.mainhand;
      if ( mh ) this.usage.strikes.push(mh);
    },
    canUse() {
      if ( !this.actor.equipment.weapons.twoHanded ) {
        throw new Error(_loc("ACTION.WARNINGS.RequiresTwoHanded"));
      }
    }
  },

  offhand: {
    tag: "offhand",
    label: "ACTION.TAG.OffHand",
    tooltip: "ACTION.TAG.OffHandTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 9,
    prepare() {
      this.usage.strikes ||= [];
      const oh = this.actor.equipment.weapons.offhand;
      if ( oh ) this.usage.strikes.push(oh);
    },
    canUse() {
      if ( !this.actor.equipment.weapons.offhand ) {
        throw new Error(_loc("ACTION.WARNINGS.RequiresOffhand"));
      }
    }
  },

  thrown: {
    tag: "thrown",
    label: "ACTION.TAG.Thrown",
    tooltip: "ACTION.TAG.ThrownTooltip",
    category: "attack",
    propagate: ["melee"],
    canUse() {
      for ( const w of this.usage.strikes ) {
        if ( !w.system.canThrow ) throw new Error(_loc("ACTION.WARNINGS.CannotThrow"));
      }
    },
    prepare() {
      this.range.maximum ??= 10;
      this.range.weapon = false;
    },
    preActivate() {
      if ( !this.usage.strikes?.length ) return;
      const updateEvent = this.selfUpdateEvent;
      for ( const weapon of this.usage.strikes ) {
        if ( !weapon.system.canThrow ) throw new Error(_loc("ACTION.WARNINGS.CannotThrow"));
        updateEvent.itemSnapshots.push(weapon.snapshot());
        updateEvent.actorUpdates.items.push({_id: weapon.id, system: {dropped: true, equipped: false}});
        if ( !weapon.system.properties.has("thrown") ) this.usage.banes[this.id] = {label: this.name, number: 2};
      }
    }
  },

  natural: {
    tag: "natural",
    category: "attack",
    label: "ACTION.TAG.Natural",
    tooltip: "ACTION.TAG.NaturalTooltip",
    propagate: ["melee"],
    priority: 9,
    canUse() {
      if ( !this.usage.strikes.every(w => w.system.properties.has("natural")) ) {
        throw new Error(_loc("ACTION.WARNINGS.RequiresNatural"));
      }
    },
    prepare() {
      for ( const c of this.usage.weaponChoices ?? [] ) {
        if ( !c.item.system.properties.has("natural") ) c.viable = false;
      }
    }
  },

  hazard: {
    tag: "hazard",
    category: "attack",
    priority: 0,
    internal: true,
    initialize() {
      this.usage.hasDice = true;
      this.usage.resource ??= "health";
      this.usage.defenseType ??= "physical";
      this.usage.bonuses.ability = this.usage.danger;
      this.usage.bonuses.base = 1;
    },
    async roll(target) {
      const n = this.target.multiple ?? 1;
      for ( let i = 0; i < n; i++ ) {
        const roll = await target.receiveAttack(this);
        this.recordEvent({type: "strike", target, roll});
      }
    }
  },

  /* -------------------------------------------- */
  /*  Special Actions                             */
  /* -------------------------------------------- */

  generic: {
    tag: "generic",
    label: "ACTION.TAG.Generic",
    tooltip: "ACTION.TAG.GenericTooltip",
    category: "special",
    priority: 9,
    prepare() {
      this.usage.hasDice = true;
      this.usage.bonuses.enchantment = this.item?.system.config?.enchantment.bonus || 0;
      this.usage.defenseType ??= "physical";
      this.usage.resource ??= "health";
      this.usage.damageType ??= "void";
    },
    async roll(target) {
      const {bonuses, damageType, defenseType, resource} = this.usage;

      // Create and evaluate a generic roll
      const roll = new AttackRoll({
        actorId: this.id,
        target: target.uuid,
        ability: bonuses.ability ?? 0,
        skill: bonuses.skill ?? 0,
        enchantment: bonuses.enchantment,
        defenseType,
        damageType,
        dc: target.defenses[defenseType].total
      });
      await roll.evaluate();

      // Resolve the outcome and structured damage against the target's defenses
      roll.resolveDamage(this.actor, target, {
        multiplier: bonuses.multiplier ?? 1,
        base: bonuses.base ?? 0,
        bonus: bonuses.damageBonus ?? 0,
        resource,
        damageType,
        restoration: this.usage.restoration ?? false
      });
      this.recordEvent({type: "strike", target, roll});
    }
  },

  /* -------------------------------------------- */

  reload: {
    tag: "reload",
    label: "ACTION.TAG.Reload",
    tooltip: "ACTION.TAG.ReloadTooltip",
    category: "special",
    canUse() {
      const {mainhand: m, offhand: o, reload} = this.actor.equipment.weapons;
      if ( !reload || (!m.system.needsReload && !o?.system.needsReload) ) {
        throw new Error(_loc("ACTION.WARNINGS.NoReloadRequired"));
      }
    },
    prepare() {
      this.usage.weapon ??= this.getValidWeaponChoices()[0]?.item;
      if ( this.usage.weapon ) {
        Object.assign(this.usage.context, {label: "Reload", icon: "fa-solid fa-arrow-rotate-right",
          tags: {[`weapon.${this.usage.weapon.id}`]: this.usage.weapon.name}});
      }
    },
    preActivate() {
      const w = this.usage.weapon;
      if ( w ) {
        const updateEvent = this.selfUpdateEvent;
        updateEvent.itemSnapshots.push(w.snapshot());
        updateEvent.actorUpdates.items.push({_id: w.id, "system.loaded": true});
      }
    }
  },

  /* -------------------------------------------- */

  disarm: {
    tag: "disarm",
    label: "ACTION.TAG.Disarm",
    tooltip: "ACTION.TAG.DisarmTooltip",
    category: "special",
    postActivate() {
      for ( const [target, events] of this.eventsByTarget ) {
        if ( !events.allSuccess ) continue;
        const {mainhand} = target.equipment.weapons; // TODO - allow usage customization?
        if ( !mainhand?.id ) continue;
        this.recordEvent({type: "actorUpdate", target,
          actorUpdates: {items: [{_id: mainhand.id, system: {dropped: true, equipped: false}}]},
          itemSnapshots: [mainhand.snapshot()],
          statusText: [{text: _loc("ACTOR.DisarmedStatus"), fontSize: 64}]});
      }
    }
  },

  /* -------------------------------------------- */
  /*  Attack Modifiers                            */
  /* -------------------------------------------- */

  deadly: {
    tag: "deadly",
    label: "ACTION.TAG.Deadly",
    tooltip: "ACTION.TAG.DeadlyTooltip",
    category: "modifiers",
    prepare() {
      this.usage.bonuses.multiplier += 1;
    }
  },

  difficult: {
    tag: "difficult",
    label: "ACTION.TAG.Difficult",
    tooltip: "ACTION.TAG.DifficultTooltip",
    category: "modifiers",
    prepare() {
      this.usage.banes.difficult = {label: "ACTION.TAG.Difficult", number: 1};
    }
  },

  empowered: {
    tag: "empowered",
    label: "ACTION.TAG.Empowered",
    tooltip: "ACTION.TAG.EmpoweredTooltip",
    category: "modifiers",
    prepare() {
      this.usage.bonuses.damageBonus += 6;
    }
  },
  keen: {
    tag: "keen",
    label: "ACTION.TAG.Keen",
    tooltip: "ACTION.TAG.KeenTooltip",
    category: "modifiers",
    prepare() {
      this.usage.bonuses.criticalSuccessThreshold -= 2;
    }
  },
  accurate: {
    tag: "accurate",
    label: "ACTION.TAG.Accurate",
    tooltip: "ACTION.TAG.AccurateTooltip",
    category: "modifiers",
    prepare() {
      this.usage.boons.accurate = {label: "ACTION.TAG.Accurate", number: 2};
    }
  },
  harmless: {
    tag: "harmless",
    label: "ACTION.TAG.Harmless",
    tooltip: "ACTION.TAG.HarmlessTooltip",
    category: "modifiers",
    postActivate() {
      for ( const event of this.events ) {
        if ( event.roll?.hasDamage ) {
          event.roll.data.damage.base = event.roll.data.damage.total = 0;
          event.roll.data.damage.harmless = true;
        }
      }
    }
  },
  undetectable: {
    tag: "undetectable",
    label: "ACTION.TAG.Undetectable",
    tooltip: "ACTION.TAG.UndetectableTooltip",
    category: "modifiers"
  },
  weakened: {
    tag: "weakened",
    label: "ACTION.TAG.Weakened",
    tooltip: "ACTION.TAG.WeakenedTooltip",
    category: "modifiers",
    prepare() {
      this.usage.bonuses.damageBonus -= 6;
    }
  },

  severe: {
    tag: "severe",
    label: "ACTION.TAG.Severe",
    tooltip: "ACTION.TAG.SevereTooltip",
    category: "modifiers",
    postActivate() {
      for ( const event of this.events ) {
        if ( !event.roll?.hasDamage ) continue;
        const targetResources = event.target?.system?.resources;
        if ( !targetResources ) continue;
        const resource = event.roll.data.damage.resource ?? "health";
        if ( (resource === "health") && (event.target.system.usesReserveResources) ) {
          event.roll.data.damage.resource = "wounds";
        }
        else if ( (resource === "morale") && (event.target.system.usesReserveResources) ) {
          event.roll.data.damage.resource = "madness";
        }
      }
    }
  },

  /* -------------------------------------------- */
  /*  Defense Modifiers                           */
  /* -------------------------------------------- */

  // Target Fortitude
  fortitude: {
    tag: "fortitude",
    label: "DEFENSES.Fortitude",
    category: "defenses",
    prepare() {
      this.usage.defenseType = "fortitude";
    }
  },

  // Target Reflex
  reflex: {
    tag: "reflex",
    label: "DEFENSES.Reflex",
    category: "defenses",
    prepare() {
      this.usage.defenseType = "reflex";
    }
  },

  // Target Willpower
  willpower: {
    tag: "willpower",
    label: "DEFENSES.Willpower",
    category: "defenses",
    prepare() {
      this.usage.defenseType = "willpower";
    }
  },

  /* -------------------------------------------- */
  /*  Healing Actions                             */
  /* -------------------------------------------- */

  healing: {
    tag: "healing",
    label: "ACTION.TAG.Healing",
    tooltip: "ACTION.TAG.HealingTooltip",
    category: "damage",
    prepare() {
      this.usage.hasDice = true;
      this.usage.resource = "health";
      this.usage.defenseType = "wounds";
      this.usage.restoration = true;
    }
  },

  rallying: {
    tag: "rallying",
    label: "ACTION.TAG.Rallying",
    tooltip: "ACTION.TAG.RallyingTooltip",
    category: "damage",
    prepare() {
      this.usage.hasDice = true;
      this.usage.resource = "morale";
      this.usage.defenseType = "madness";
      this.usage.restoration = true;
    }
  },

  /* -------------------------------------------- */
  /*  Resource Consumption                        */
  /* -------------------------------------------- */

  maintained: {
    tag: "maintained",
    label: "ACTION.TAG.Maintained",
    tooltip: "ACTION.TAG.MaintainedTooltip",
    category: "resources",
    postActivate() {
      const selfEffectEvent = this.events.find(e => (e.target === this.actor) && e.effects.length);
      if ( !selfEffectEvent ) return;
      const maintainedCost = this.actor.actions[this.id]?.cost.focus ?? this.gesture?.cost.focus ?? 1;
      selfEffectEvent.effects[0].system.maintenance = {cost: maintainedCost};
    }
  },

  /* -------------------------------------------- */
  /*  Movement Actions                            */
  /* -------------------------------------------- */

  movement: {
    tag: "movement",
    label: "ACTION.TAG.Movement",
    tooltip: "ACTION.TAG.MovementTooltip",
    category: "movement",
    canUse() {
      if ( this.actor.statuses.has("restrained") ) throw new Error(_loc("ACTION.WARNINGS.Restrained"));
    },
    prepare() {
      const stride = this.actor.system.movement.stride;
      const costFeet = this.movement ? this.movement.cost : stride;
      const {cost, useFreeMove} = this.actor.getMovementActionCost(costFeet);
      if ( useFreeMove ) this.usage.freeMove = true;
      if ( this.id === "move" ) this.cost.action = cost; // Standard movement cost
      else this.cost.action += cost; // Add movement cost to this action's base cost (0 if free move was consumed)
    },
    postActivate() {
      const actorUpdateEvent = this.events.find(e => (e.target === this.actor) && (e.type === "actorUpdate"));
      if ( !actorUpdateEvent ) return;
      const status = actorUpdateEvent.actorUpdates.system.status;
      const {freeMove} = this.usage;
      if ( this.movement?.id ) {
        const {id, origin} = this.movement;
        this.recordEvent({type: "movement", target: this.actor,
          movement: {id, origin: {x: origin.x, y: origin.y, elevation: origin.elevation}}});
        if ( freeMove ) status.freeMovementId = id;
      }
      status.hasMoved = true;

      // Voluntarily stand up from prone when performing your own movement
      if ( this.actor.statuses.has("prone") && this.movement?.waypoints?.some(w => w.action !== "crawl") ) {
        for ( const effect of this.actor.effects ) {
          if ( !effect.statuses.has("prone") ) continue;
          const change = effect.isStatusOnly("prone")
            ? {_id: effect.id, _action: "delete"}
            : {_id: effect.id, _action: "update", statuses: [...effect.statuses].filter(s => s !== "prone")};
          this.recordEvent({type: "effect", target: this.actor, effects: [change]});
        }
      }
    },
    confirm() {
      if ( !this.token ) throw new Error("We cannot confirm a movement action without a TokenDocument");
    }
  }
};

/* -------------------------------------------- */
/*  Movement Actions                            */
/* -------------------------------------------- */

for ( const id of Object.keys(MOVEMENT_ACTIONS) ) {
  TAGS[id] = {
    tag: id,
    label: `ACTION.TAG.Movement${id[0].toUpperCase()}${id.slice(1)}`,
    tooltip: `ACTION.TAG.Movement${id[0].toUpperCase()}${id.slice(1)}Tooltip`,
    category: "movement",
    propagate: ["movement"],
    prepare() {
      this.usage.movement.action = id;
    }
  };
}

/* -------------------------------------------- */
/*  Specialized Damage Type                     */
/* -------------------------------------------- */

for ( const {id, label} of Object.values(DAMAGE_TYPES) ) {
  TAGS[id] = {
    tag: id,
    label: label,
    category: "damage",
    initialize() {
      this.usage.damageType ??= id;
    }
  };
}

/* -------------------------------------------- */
/*  Specialized Scaling                         */
/* -------------------------------------------- */

for ( const {id, label} of Object.values(ABILITIES) ) {
  TAGS[id] = {
    tag: id,
    label,
    category: "scaling",
    initialize() {
      this.usage.bonuses.ability = this.actor.getAbilityBonus([id]);
    }
  };
}

/* -------------------------------------------- */
/*  Target Resources                            */
/* -------------------------------------------- */

for ( const resource of ["health", "morale"] ) {
  TAGS[resource] = {
    tag: resource,
    label: RESOURCES[resource].label,
    category: "resources",
    initialize() {
      this.usage.resource = resource;
    }
  };
}

/* -------------------------------------------- */
/*  Skill Attacks                               */
/* -------------------------------------------- */

// All Skill Attacks
TAGS.skill = {
  tag: "skill",
  label: "ACTION.TAG.Skill",
  category: "skills"
};

// Specific Skills
for ( const {id, abilities, label} of Object.values(SKILLS) ) {
  TAGS[id] = {
    tag: id,
    label,
    category: "skills",
    propagate: ["skill"],
    initialize() {
      this.scaling.push(...abilities);
      this.training.push(id);
      this.usage.skillId = id;
      const skill = this.actor.skills[id];
      this.usage.hasDice = true;
      Object.assign(this.usage.bonuses, {
        ability: skill.abilityBonus,
        skill: skill.skillBonus,
        enchantment: skill.enchantmentBonus
      });
      Object.assign(this.usage.context, {type: "skill", label: "Skill Tags", icon: "fa-solid fa-cogs"});
      this.usage.context.tags.skill = SKILLS[id].label;
    },
    async roll(target) {
      const roll = await this.actor.skillAttack(this, target);
      this.recordEvent({type: "check", target, roll});
    }
  };
}

/* -------------------------------------------- */

/**
 * The default actions that every character can perform regardless of their attributes or talents.
 * @type {object[]}
 */
export const DEFAULT_ACTIONS = Object.freeze([

  // Cast Spell
  {
    id: "cast",
    name: "ACTION.DEFAULT_ACTIONS.Cast.Name",
    img: "icons/magic/air/air-smoke-casting.webp",
    description: "ACTION.DEFAULT_ACTIONS.Cast.Description",
    tags: [],
    target: {
      type: "none"
    },
    autoFavorite: true
  },

  // Basic Movement
  {
    id: "move",
    name: "ACTION.DEFAULT_ACTIONS.Move.Name",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    description: "ACTION.DEFAULT_ACTIONS.Move.Description",
    target: {
      type: "none",
      number: 0,
      scope: 1
    },
    tags: ["movement"]
  },

  // Fall
  {
    id: "fall",
    name: "ACTION.DEFAULT_ACTIONS.Fall.Name",
    img: "systems/crucible/icons/statuses/falling.svg",
    description: "ACTION.DEFAULT_ACTIONS.Fall.Description",
    target: { type: "self", scope: 1 },
    cost: { action: 0 },
    tags: ["generic"],
    effects: [{ statuses: ["prone"] }]
  },

  // Defend
  {
    id: "defend",
    name: "ACTION.DEFAULT_ACTIONS.Defend.Name",
    img: "icons/magic/defensive/shield-barrier-deflect-teal.webp",
    description: "ACTION.DEFAULT_ACTIONS.Defend.Description",
    target: {
      type: "self",
      number: 0,
      scope: 1
    },
    cost: {
      action: 2
    },
    effects: [
      {
        duration: {value: 1, units: "rounds", expiry: "turnStart"},
        statuses: ["guarded"]
      }
    ]
  },

  // Delay
  {
    id: "delay",
    name: "ACTION.DEFAULT_ACTIONS.Delay.Name",
    img: "icons/magic/time/clock-analog-gray.webp",
    description: "ACTION.DEFAULT_ACTIONS.Delay.Description",
    target: {
      type: "self",
      scope: 1
    }
  },

  // Escape
  {
    id: "escape",
    name: "ACTION.DEFAULT_ACTIONS.Escape.Name",
    img: "icons/skills/movement/figure-running-gray.webp",
    description: "ACTION.DEFAULT_ACTIONS.Escape.Description",
    target: {
      type: "self",
      scope: 1
    },
    cost: {
      action: 2
    },
    tags: ["skill", "athletics", "harmless"],
    autoFavorite: true
  },

  // Reactive Strike
  {
    id: "reactiveStrike",
    name: "ACTION.DEFAULT_ACTIONS.ReactiveStrike.Name",
    img: "icons/skills/melee/blade-tip-orange.webp",
    description: "ACTION.DEFAULT_ACTIONS.ReactiveStrike.Description",
    cost: {
      action: -1,
      weapon: true
    },
    range: {
      weapon: true
    },
    target: {
      type: "single",
      number: 1,
      scope: 3
    },
    tags: ["reaction"], // Added to in #prepareDefaultActions
    autoFavorite: true
  },

  // Throw Weapon
  {
    id: "throwWeapon",
    name: "ACTION.DEFAULT_ACTIONS.ThrowWeapon.Name",
    img: "icons/skills/ranged/dagger-thrown-jeweled-green.webp",
    description: "ACTION.DEFAULT_ACTIONS.ThrowWeapon.Description",
    cost: {
      weapon: true
    },
    target: {
      type: "single",
      number: 1,
      scope: 3
    },
    tags: ["thrown"]
  },

  // Investiture
  {
    id: "investiture",
    name: "ACTION.DEFAULT_ACTIONS.Investiture.Name",
    img: "icons/magic/symbols/runes-star-orange-purple.webp",
    description: "ACTION.DEFAULT_ACTIONS.Investiture.Description",
    target: {
      type: "self",
      number: 0,
      scope: 1
    },
    cost: {
      action: 0
    },
    tags: ["noncombat"]
  },

  // Recover
  {
    id: "recover",
    name: "ACTION.DEFAULT_ACTIONS.Recover.Name",
    img: "icons/magic/life/cross-area-circle-green-white.webp",
    description: "ACTION.DEFAULT_ACTIONS.Recover.Description",
    target: {
      type: "self",
      number: 0,
      scope: 1
    },
    cost: {
      action: 0
    },
    tags: ["noncombat"],
    autoFavorite: action => {
      const r = action.actor.system.resources;
      return (r.health.value < r.health.max) || (r.morale.value < r.morale.max) || (r.focus.value < r.focus.max);
    }
  },

  // Reload
  {
    id: "reload",
    name: "ACTION.DEFAULT_ACTIONS.Reload.Name",
    img: "icons/skills/ranged/arrow-flying-broadhead-metal.webp",
    description: "ACTION.DEFAULT_ACTIONS.Reload.Description",
    cost: {
      action: 2
    },
    tags: ["reload"],
    target: {
      type: "self"
    },
    autoFavorite: true
  },

  // Rest (never auto-favorited; rests are managed through the party UI)
  {
    id: "rest",
    name: "ACTION.DEFAULT_ACTIONS.Rest.Name",
    img: "icons/magic/time/arrows-circling-green.webp",
    description: "ACTION.DEFAULT_ACTIONS.Rest.Description",
    target: {
      type: "self",
      number: 0,
      scope: 1
    },
    cost: {
      action: 0
    },
    tags: ["noncombat"]
  },

  // Basic Strike
  {
    id: "strike",
    name: "ACTION.DEFAULT_ACTIONS.Strike.Name",
    img: "icons/skills/melee/blade-tip-orange.webp",
    description: "ACTION.DEFAULT_ACTIONS.Strike.Description",
    range: {
      weapon: true
    },
    target: {
      type: "single",
      number: 1,
      scope: 3
    },
    cost: {
      action: 0,
      weapon: true
    },
    autoFavorite: true
  }
]);
