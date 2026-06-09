import path from "path";
import {Command} from "commander";
import {compilePack, extractPack} from "@foundryvtt/foundryvtt-cli";

/* -------------------------------------------- */
/*  Build Configuration                         */
/* -------------------------------------------- */

const CONFIG = {
  dataPath: "packs",
  sourcePath: "_source",
  databases: [
    "adversary-equipment",
    "adversary-talents",
    "affixes",
    "ancestry",
    "archetype",
    "background",
    "equipment",
    "macros",
    "playtest",
    "pregens",
    "rules",
    "spell",
    "summons",
    "talent",
    "taxonomy"
  ],
  yaml: true
};

/* -------------------------------------------- */
/*  Task Handlers                               */
/* -------------------------------------------- */

/**
 * Extract LevelDB databases to YAML files
 * @param {string} [pack]                 Optional pack identifier to extract. If omitted, all packs are extracted.
 * @param {{volatile: boolean}} [options]
 */
export async function extract(pack, {volatile=false}={}) {
  if ( pack && !CONFIG.databases.includes(pack) ) {
    throw new Error(`Unknown pack identifier "${pack}". Valid packs: ${CONFIG.databases.join(", ")}`);
  }
  const databases = pack ? [pack] : CONFIG.databases;
  for ( const db of databases ) {
    const dbPath = path.join(CONFIG.dataPath, db);
    const sourcePath = path.join(CONFIG.sourcePath, db);
    await extractPack(dbPath, sourcePath, {yaml: CONFIG.yaml, clean: true, omitVolatile: !volatile} );
    console.log(`Extracted database: ${db}`);
  }
  console.log(`Successfully extracted ${databases.length} database(s).`);
}

/**
 * Compile YAML files to LevelDB databases
 * @param {string} [pack]   Optional pack identifier to compile. If omitted, all packs are compiled.
 */
export async function compile(pack) {
  if ( pack && !CONFIG.databases.includes(pack) ) {
    throw new Error(`Unknown pack identifier "${pack}". Valid packs: ${CONFIG.databases.join(", ")}`);
  }
  const databases = pack ? [pack] : CONFIG.databases;
  for ( const db of databases ) {
    const dbPath = path.join(CONFIG.dataPath, db);
    const sourcePath = path.join(CONFIG.sourcePath, db);
    await compilePack(sourcePath, dbPath, {yaml: CONFIG.yaml} );
    console.log(`Compiled database: ${db}`);
  }
  console.log(`Successfully compiled ${databases.length} database(s).`);
}

/* -------------------------------------------- */
/*  Command Definition                          */
/* -------------------------------------------- */

const startup = new Command();

startup
  .name("foundrybuild")
  .description("Module development and packaging tools");

/* LevelDB format compiling from extracted plain-text files */
startup
  .command("compile")
  .description("Constructs binary databases from plain-text source files.")
  .argument("[pack]", `Pack identifier to compile. One of: ${CONFIG.databases.join(", ")}. Omit to compile all.`)
  .action(compile);

/* Plain-text format extraction from LevelDB directory */
startup
  .command("extract")
  .description("Unpacks binary databases into plain-text source files.")
  .argument("[pack]", `Pack identifier to extract. One of: ${CONFIG.databases.join(", ")}. Omit to extract all.`)
  .option("--volatile", "Keep volatile fields in extracted data (default: omit them)")
  .action(extract);

/* Start program and parse commands */
startup.parseAsync();
