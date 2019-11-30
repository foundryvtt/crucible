/**
 * Crucible (WIP) Game System
 * Author: Atropos
 * Software License: GNU GPLv3
 * Repository: https://gitlab.com/foundrynet/crucible
 */

// Import Modules
import { SYSTEM } from "./module/config/system.js";
import { CrucibleItem } from "./module/entities/item.js";
import { SkillSheet } from "./module/sheets/skill.js";


/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Crucible Game System`);

  // Record Configuration Values
  CONFIG.SYSTEM = SYSTEM;
  CONFIG.Item.entityClass = CrucibleItem;

  // Register sheet application classes
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(SYSTEM.id, SkillSheet, {types: ["skill"], makeDefault: true});
});
