/**
 * Crucible (WIP) Game System
 * Author: Atropos
 * Software License: GNU GPLv3
 * Repository: https://gitlab.com/foundrynet/crucible
 */

// Import Modules
import {SYSTEM} from "./module/config/system.js";

// Documents
import CrucibleActor from "./module/documents/actor.mjs";
import CrucibleItem from "./module/documents/item.mjs";
import ActionData from "./module/talents/action.mjs";

// Sheets
import HeroSheet from "./module/sheets/hero.js";
import AncestrySheet from "./module/sheets/ancestry.js";
import ArmorSheet from "./module/sheets/armor.js";
import BackgroundSheet from "./module/sheets/background.js";
import WeaponSheet from "./module/sheets/weapon.js";

// Apps
import StandardCheck from "./module/dice/standard-check.js";

// Helpers
import {handleSocketEvent} from "./module/socket.js";
import {addChatMessageContextOptions} from "./module/chat.js";
import {localizeSkillConfig} from "./module/config/skills.js";
import {buildJournalCompendium, renderJournalRules} from "./module/documents/journal.mjs";


/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Crucible Game System`);

  // System configuration values and module structure
  CONFIG.SYSTEM = SYSTEM;
  game.system.talents = {
    ActionData,
    defaultActions: SYSTEM.TALENT.DEFAULT_ACTIONS.map(a => new ActionData(a))
  }
  game.system.dice = { StandardCheck };
  game.system.journal = { buildJournalCompendium }

  // Actor document configuration
  CONFIG.Actor.documentClass = CrucibleActor;
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet(SYSTEM.id, HeroSheet, {types: ["hero"], makeDefault: true});

  // Item document configuration
  CONFIG.Item.documentClass = CrucibleItem;
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(SYSTEM.id, AncestrySheet, {types: ["ancestry"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, ArmorSheet, {types: ["armor"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, BackgroundSheet, {types: ["background"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, WeaponSheet, {types: ["weapon"], makeDefault: true});

  // Dice system configuration
  CONFIG.Dice.rolls.push(StandardCheck);

  // Activate socket handler
  game.socket.on(`system.${SYSTEM.id}`, handleSocketEvent);
});


/* -------------------------------------------- */
/*  Ready Hooks                                 */
/* -------------------------------------------- */

Hooks.once("ready", function() {

  // Apply localizations
  const toLocalize = [
    "ABILITIES", "ARMOR.CATEGORIES", "ARMOR.PROPERTIES", "ATTRIBUTE_CATEGORIES", "DAMAGE_CATEGORIES",
    "DAMAGE_TYPES", "RESOURCES", "SAVE_DEFENSES", "SKILL_CATEGORIES", "SKILL_RANKS",
    "QUALITY_TIERS", "ENCHANTMENT_TIERS",
    "WEAPON.CATEGORIES", "WEAPON.PROPERTIES"
  ];
  for ( let c of toLocalize ) {
    const conf = foundry.utils.getProperty(SYSTEM, c);
    for ( let [k, v] of Object.entries(conf) ) {
      if ( v.label ) v.label = game.i18n.localize(v.label);
      if ( v.abbreviation) v.abbreviation = game.i18n.localize(v.abbreviation);
      if ( typeof v === "string" ) conf[k] = game.i18n.localize(v);
    }
    Object.freeze(c);
  }
  localizeSkillConfig(SYSTEM.SKILLS, SYSTEM.id);
});


/* -------------------------------------------- */
/*  Rendering Hooks                             */
/* -------------------------------------------- */

Hooks.on("getChatLogEntryContext", addChatMessageContextOptions);
Hooks.on("renderJournalSheet", renderJournalRules);
