import path from 'path';
import fs from 'fs';
import { Command } from 'commander';
import {compilePack, extractPack} from '@foundryvtt/foundryvtt-cli';

/* -------------------------------------------- */
/*  Build Configuration                         */
/* -------------------------------------------- */

const CONFIG = {
  dataPath: "packs",
  sourcePath: "_source",
  databases: [
    "adversary-talents",
    "ancestry",
    "archetype",
    "armor",
    "background",
    "playtest",
    "pregens",
    "rules",
    "summons",
    "talent",
    "taxonomy",
    "weapon"
  ],
  yaml: true
};

/* -------------------------------------------- */
/*  Task Handlers                               */
/* -------------------------------------------- */

/**
 * Extract LevelDB databases to YAML files
 */
export async function extract() {
  for ( const db of CONFIG.databases ) {
    const dbPath = path.join(CONFIG.dataPath, db);
    const sourcePath = path.join(CONFIG.sourcePath, db);
    await extractPack(dbPath, sourcePath, {yaml: CONFIG.yaml, clean: true} );
    console.log(`Extracted database: ${db}`);
  }
  console.log(`Successfully extracted ${CONFIG.databases.length} databases.`);
}

/**
 * Compile YAML files to LevelDB databases
 */
export async function compile() {
  for ( const db of CONFIG.databases ) {
    const dbPath = path.join(CONFIG.dataPath, db);
    const sourcePath = path.join(CONFIG.sourcePath, db);
    await compilePack(sourcePath, dbPath, {yaml: CONFIG.yaml} );
    console.log(`Compiled database: ${db}`);
  }
  console.log(`Successfully compiled ${CONFIG.databases.length} databases.`);
}

/* -------------------------------------------- */
/*  Command Definition                          */
/* -------------------------------------------- */

const startup = new Command();

startup
  .name('foundrybuild')
  .description('Module development and packaging tools')

/* LevelDB format compiling from extracted plain-text files */
startup
  .command('compile')
  .description('Constructs binary databases from plain-text source files.')
  .action(compile);

/* Plain-text format extraction from LevelDB directory */
startup
  .command('extract')
  .description('Unpacks binary databases into plain-text source files.')
  .action(extract);
  
/* Start program and parse commands */
startup.parseAsync();
