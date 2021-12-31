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
import CrucibleCombat from "./module/documents/combat.mjs";
import CrucibleCombatant from "./module/documents/combatant.mjs";
import ActionData from "./module/data/action.mjs";
import {TalentData, TalentRankData, TalentPassiveData} from "./module/data/talent.mjs";

// Sheets
import HeroSheet from "./module/sheets/hero.js";
import AncestrySheet from "./module/sheets/ancestry.js";
import ArmorSheet from "./module/sheets/armor.js";
import BackgroundSheet from "./module/sheets/background.js";
import TalentSheet from "./module/sheets/talent.mjs";
import WeaponSheet from "./module/sheets/weapon.js";

// Apps
import StandardCheck from "./module/dice/standard-check.js";
import AttackRoll from "./module/dice/attack-roll.mjs";

// Helpers
import {handleSocketEvent} from "./module/socket.js";
import * as chat from "./module/chat.js";
import {localizeSkillConfig} from "./module/config/skills.js";
import {buildJournalCompendium, renderJournalRules} from "./module/documents/journal.mjs";


/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Crucible Game System`);

  // System configuration values and module structure
  CONFIG.SYSTEM = SYSTEM;
  game.system.dice = { AttackRoll, StandardCheck };
  game.system.journal = { buildJournalCompendium }
  game.system.api = {
    ActionData,
    AttackRoll,
    CrucibleActor,
    CrucibleItem,
    CrucibleCombat,
    CrucibleCombatant,
    StandardCheck,
    TalentData,
    TalentRankData,
    TalentPassiveData,
    packageItemCompendium
  }

  // Actor document configuration
  CONFIG.Actor.documentClass = CrucibleActor;
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet(SYSTEM.id, HeroSheet, {types: ["hero", "npc"], makeDefault: true});

  // Item document configuration
  CONFIG.Item.documentClass = CrucibleItem;
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(SYSTEM.id, AncestrySheet, {types: ["ancestry"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, ArmorSheet, {types: ["armor"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, BackgroundSheet, {types: ["background"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, TalentSheet, {types: ["talent"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, WeaponSheet, {types: ["weapon"], makeDefault: true});

  // Combat Configuration
  CONFIG.Combat.documentClass = CrucibleCombat;
  CONFIG.Combatant.documentClass = CrucibleCombatant;

  // Dice system configuration
  CONFIG.Dice.rolls.push(StandardCheck, AttackRoll);

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

  // Pre-localize config translations
  preLocalizeConfig()
  localizeSkillConfig(SYSTEM.SKILLS, SYSTEM.id); // TODO: Make this cleaner

  // Preload Handlebars Templates
  loadTemplates([
    // Dice Partials
    `systems/${SYSTEM.id}/templates/dice/partials/action-use-header.html`,
  ]);

  // Activate window listeners
  $("#chat-log").on("mouseenter mouseleave", ".crucible.action .target-link", chat.onChatTargetLinkHover);
  $("body").on("mouseenter mouseleave", ".crucible .tags .tag", onTagHoverTooltip)

  // Display Playtest Introduction journal
  const intro = game.journal.getName("Playtest Introduction");
  if ( intro ) intro.sheet.render(true);
});


/* -------------------------------------------- */
/*  Rendering Hooks                             */
/* -------------------------------------------- */

Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatMessage", chat.renderChatMessage)
Hooks.on("renderJournalSheet", renderJournalRules);

/* -------------------------------------------- */
/*  Convenience Functions                       */
/* -------------------------------------------- */

/**
 * Package all Items of a certain type into their appropriate Compendium pack
 * @param itemType
 * @returns {Promise<void>}
 */
async function packageItemCompendium(itemType) {
  const pack = game.packs.get(`crucible.${itemType}`);
  const items = game.items.filter(i => i.type === itemType);
  const data = items.map(i => i.toCompendium(pack, {keepId: true}));

  // Delete everything in the pack currently
  await pack.configure({locked: false});
  await pack.getDocuments();
  await Item.deleteDocuments(Array.from(pack.index.keys()), {pack: pack.collection});

  // Load everything to the pack, keeping IDs
  await Item.createDocuments(data, {pack: pack.collection, keepId: true});
  await pack.configure({locked: true});
}

/* -------------------------------------------- */


function preLocalizeConfig() {
  const localizeConfigObject = (obj, keys) => {
    for ( let o of Object.values(obj) ) {
      for ( let k of keys ) {
        o[k] = game.i18n.localize(o[k]);
      }
    }
  }

  // Action Tags
  localizeConfigObject(SYSTEM.TALENT.ACTION_TAGS, ["label", "tooltip"]);
}

/* -------------------------------------------- */

// Create a global tooltip
const _tooltip = document.createElement("div");
_tooltip.id = "crucible-tooltip";
_tooltip.classList.add("tooltip");
document.body.appendChild(_tooltip);

function onTagHoverTooltip(event) {
  const el = event.currentTarget;
  const parent = el.parentElement;
  const tagType = parent.dataset.tagType;
  const tag = el.dataset.tag;

  // No tooltip
  if ( !tagType || !tag ) {
    _tooltip.classList.remove("active");
    return;
  }

  // Add tooltip
  if ( event.type === "mouseenter" ) {
    const tip = getTagTooltip(tagType, tag);
    if ( !tip ) return _tooltip.classList.remove("active");
    _tooltip.classList.add("active");
    _tooltip.innerText = tip;
    const pos = el.getBoundingClientRect();
    _tooltip.style.top = `${pos.bottom + 5}px`;

    // Extend left
    if ( (pos.x + _tooltip.offsetWidth) > window.innerWidth ) {
      _tooltip.style.right = `${window.innerWidth - pos.right}px`;
      _tooltip.style.left = null;
    }

    // Extend right
    else {
      _tooltip.style.left = `${pos.left}px`;
      _tooltip.style.right = null;
    }
  }

  // Remove tooltip
  else _tooltip.classList.remove("active");
}

/* -------------------------------------------- */

/**
 * Get the localized tooltip which should be displayed for a given tag.
 * @param {string} tagType      The tag type being displayed
 * @param {string} tag          The tag value being displayed
 * @returns {string}            The localized tag tooltip, if any
 */
function getTagTooltip(tagType, tag) {
  switch ( tagType ) {
    case "action":
      switch ( tag ) {
        case "target":
          return game.i18n.localize("ACTION.TagTargetTooltip");
        case "cost":
          return game.i18n.localize("ACTION.TagCostTooltip");
        default:
          return game.i18n.localize(SYSTEM.TALENT.ACTION_TAGS[tag]?.tooltip);
      }
    case "weapon":
      switch ( tag ) {
        case "damage":
          return game.i18n.localize("WEAPON.TagDamageTooltip");
        default:
          return game.i18n.localize(SYSTEM.WEAPON.PROPERTIES[tag]?.tooltip);
      }
    default:
      return "";
  }
}
