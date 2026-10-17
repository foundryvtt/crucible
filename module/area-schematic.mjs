/**
 * Crucible's extension of encounter spawning from the area-schematic library, which area map modules bundle.
 * The library fires these hooks whichever copy of it spawns the encounter.
 */
import CrucibleGroupActor from "./models/actor-group.mjs";

/**
 * The width of the spawn dialog, wide enough for each row's threat and controls.
 * @type {number}
 */
const DIALOG_WIDTH = 540;

/**
 * A row of the spawn dialog as Crucible measures it, whose level and rank the GM may adjust for an adversary.
 * @typedef EncounterRowMeasure
 * @property {object} row                         The dialog row
 * @property {CrucibleActor} actor
 * @property {number} disposition
 * @property {boolean} adjustable                 Whether the level and rank may be adjusted
 * @property {number} level                       The adversary's level, as configured
 * @property {string} rank                        The adversary's threat rank, as configured
 * @property {{level: number, rank: string}} initial  The level and rank before configuration
 */

/* -------------------------------------------- */

/**
 * Register the hooks which extend encounter spawning.
 */
export function registerHooks() {
  Hooks.on("areaSchematic.initializeSpawnDialog", onInitializeSpawnDialog);
  Hooks.on("renderSchematicEncounterSpawnDialog", onRenderSpawnDialog);
  Hooks.on("areaSchematic.preSpawnEncounter", onPreSpawnEncounter);
}

/* -------------------------------------------- */

/**
 * Style the spawn dialog as a Crucible sheet, wide enough for its threat controls.
 * @param {object} options                        The dialog's application options
 */
function onInitializeSpawnDialog(options) {
  options.classes.push("crucible", "sheet", "themed", "theme-dark", "encounter-spawn");
  options.position.width = DIALOG_WIDTH;
}

/* -------------------------------------------- */

/**
 * Add each row's controls and threat, then the party threat beneath the allies and a balance for each planned combat.
 * @param {SchematicEncounterSpawnDialog} dialog
 * @param {HTMLElement} element
 * @param {object} context                        The render context, providing rows, spawnOptions, party and combat
 */
function onRenderSpawnDialog(dialog, element, context) {
  const measures = context.rows.map(measureRow);
  for ( const measure of measures ) renderRow(dialog, element, measure);
  renderBalances(element, context, measures);
}

/* -------------------------------------------- */

/**
 * Move a linked adversary's configured level and rank onto its Actor, since its tokens share the Actor's data.
 * @param {SchematicEncounter} _encounter
 * @param {object} plan                           The tokens and combatants to create
 */
function onPreSpawnEncounter(_encounter, plan) {
  const actorUpdates = [];
  for ( const token of plan.tokens ) {
    const advancement = token.delta?.system?.advancement;
    if ( !token.actorLink || !advancement ) continue;
    actorUpdates.push({_id: token.actorId, system: {advancement}});
    delete token.delta.system.advancement;
  }
  // noinspection JSIgnoredPromiseFromCall
  if ( actorUpdates.length ) Actor.implementation.updateDocuments(actorUpdates);
}

/* -------------------------------------------- */

/**
 * The threat of one of a row's tokens, at its configured level and rank for an adversary.
 * @param {EncounterRowMeasure} measure
 * @returns {number}
 */
function getThreat({actor, level, rank}) {
  if ( actor.type !== "adversary" ) return actor.threat ?? 0;
  const threatLevel = level < 0 ? 1 / Math.abs(level - 1) : level;
  return threatLevel * (SYSTEM.THREAT_RANKS[rank]?.scaling ?? 1);
}

/* -------------------------------------------- */

/**
 * Measure a row's level and rank from its token data, as configured and before configuration.
 * @param {object} row
 * @returns {EncounterRowMeasure}
 */
function measureRow(row) {
  const {actor, tokenData, initialTokenData, disposition} = row;
  const base = actor.system.advancement ?? {};
  const advancement = data => ({...base, ...foundry.utils.getProperty(data ?? {}, "delta.system.advancement")});
  const {level, rank} = advancement(tokenData);
  const initial = advancement(initialTokenData);
  const adjustable = (actor.type === "adversary") && !!initialTokenData;
  return {row, actor, disposition, adjustable, level, rank, initial: {level: initial.level, rank: initial.rank}};
}

/* -------------------------------------------- */

/**
 * Weigh each planned combat's hostile combatants against the allies, leaving neutral ones out.
 * Adding to a Scene also weighs the combatants already in its active Combat against the first combat.
 * @param {HTMLElement} element
 * @param {object} context
 * @param {EncounterRowMeasure[]} measures
 */
function renderBalances(element, context, measures) {
  const {FRIENDLY, NEUTRAL} = CONST.TOKEN_DISPOSITIONS;
  const threatOf = measure => getThreat(measure) * measure.row.number;
  const counter = (id, label, value, {difficulty, total=false}={}) => {
    const assessment = difficulty ? `<span class="difficulty ${difficulty.id}" style="--tier-color: ${difficulty.color}">`
      + `${_loc(difficulty.label)}</span>` : "";
    return `<div class="counter ${id}"><span class="label">${_loc(label)}</span>${assessment}`
      + `<span class="value${total ? " hex flat" : ""}">${value}</span></div>`;
  };
  const appendBalance = (fieldset, counters) => {
    const balance = document.createElement("div");
    balance.classList.add("encounter-balance");
    balance.innerHTML = counters.join("");
    fieldset.append(balance);
  };

  // The allies, shared by every combat, including party members which spawn without a row
  let allies = 0;
  const counted = new Set(); // Linked actors, which are the same creature wherever they appear
  for ( const measure of measures ) {
    if ( measure.disposition !== FRIENDLY ) continue;
    allies += threatOf(measure);
    if ( measure.row.linked ) counted.add(measure.actor.id);
  }
  for ( const actor of context.party ) {
    if ( counted.has(actor.id) || (Math.max(actor.prototypeToken.disposition, NEUTRAL) !== FRIENDLY) ) continue;
    allies += actor.threat ?? 0;
    counted.add(actor.id);
  }
  const alliesFieldset = element.querySelector("fieldset[data-side=allies]");
  if ( alliesFieldset ) {
    appendBalance(alliesFieldset, [counter("party", "ENCOUNTER.PartyThreat", allies.toNearest(0.01), {total: true})]);
  }

  // Each combat's adversaries, where the first combat joins the ongoing Combat when adding
  for ( const fieldset of element.querySelectorAll("fieldset[data-combat]") ) {
    const combat = Number(fieldset.dataset.combat);
    const rows = measures.filter(m => (m.row.combat === combat) && (m.disposition < NEUTRAL));
    let threat = rows.reduce((total, m) => total + threatOf(m), 0);
    let party = allies;
    let ongoing = null;
    if ( (combat === 0) && (context.spawnOptions.mode === "add") && context.combat ) {
      const linked = new Set([...counted, ...rows.filter(m => m.row.linked).map(m => m.actor.id)]);
      let hostile = 0;
      let friendly = 0;
      for ( const {actor, token} of context.combat.combatants ) {
        if ( !actor || linked.has(actor.id) ) continue;
        const disposition = token?.disposition ?? NEUTRAL;
        if ( disposition === FRIENDLY ) friendly += actor.threat ?? 0;
        else if ( disposition < NEUTRAL ) hostile += actor.threat ?? 0;
      }
      threat += hostile;
      party += friendly;
      ongoing = hostile - friendly;
    }

    // Repeat the party threat only where this combat changes it, or where the allies are not shown
    const {difficulty} = CrucibleGroupActor.evaluateEncounter(threat, party);
    appendBalance(fieldset, [
      (!alliesFieldset || (party !== allies)) ? counter("party", "ENCOUNTER.PartyThreat", party.toNearest(0.01)) : "",
      ongoing !== null ? counter("ongoing", "ENCOUNTER.OngoingCombat", ongoing.toNearest(0.01)) : "",
      counter("threat", "ENCOUNTER.AdversaryThreat", threat.toNearest(0.01), {difficulty, total: true})
    ]);
  }
}

/* -------------------------------------------- */

/**
 * Add a row's threat as its final column, and for an adversary the controls which adjust its level and rank.
 * @param {SchematicEncounterSpawnDialog} dialog
 * @param {HTMLElement} element
 * @param {EncounterRowMeasure} measure
 */
function renderRow(dialog, element, measure) {
  const {row, adjustable, level, rank, initial} = measure;
  const item = element.querySelector(`.line-item[data-key="${row.key}"]`);
  const controls = item?.querySelector(":scope > .controls");
  if ( !controls ) return;
  const threat = (getThreat(measure) * row.number).toNearest(0.01);
  item.insertAdjacentHTML("beforeend",
    `<span class="value" aria-label="${_loc("ENCOUNTER.Threat", {threat})}">${threat}</span>`);
  if ( !adjustable ) return;

  // A reset once changed, which leads so that its appearance shifts nothing, then level carets and the rank
  const {min, max} = row.actor.system.schema.getField("advancement.level").options;
  const rankConfig = SYSTEM.THREAT_RANKS[rank];
  const changed = (level !== initial.level) || (rank !== initial.rank);
  const reset = changed ? `<button type="button" class="icon fa-solid fa-arrow-rotate-left reset" data-tooltip
    aria-label="${_loc("ACTOR.ADVERSARY.ACTIONS.ResetAdjustment")}"></button>` : "";
  controls.insertAdjacentHTML("afterbegin", `${reset}
  <div class="advancement">
    <div class="controls flexcol">
      <button type="button" class="icon fa-solid fa-caret-up" data-tooltip ${level >= max ? "disabled" : ""}
        aria-label="${_loc("ACTOR.ADVERSARY.ACTIONS.IncreaseLevel")}"></button>
      <button type="button" class="icon fa-solid fa-caret-down" data-tooltip ${level <= min ? "disabled" : ""}
        aria-label="${_loc("ACTOR.ADVERSARY.ACTIONS.DecreaseLevel")}"></button>
    </div>
    <span class="level" data-tooltip aria-label="${_loc("ADVANCEMENT.Level")}">${level}</span>
  </div>
  <button type="button" class="icon ${rankConfig.icon} cycle-rank" data-tooltip
    aria-label="${_loc(rankConfig.label)}: ${_loc("ACTOR.ADVERSARY.ACTIONS.CycleRank")}"></button>`);

  // Configure the level and rank in the token data of the dialog's copy of the encounter
  const configure = advancement => {
    const tokenData = foundry.utils.deepClone(row.tokenData);
    tokenData.delta ??= {};
    foundry.utils.setProperty(tokenData, "delta.system.advancement", advancement);
    dialog.updateTokenData(row.key, tokenData);
  };
  const current = foundry.utils.getProperty(row.tokenData, "delta.system.advancement") ?? {};
  const ranks = Object.keys(SYSTEM.THREAT_RANKS);
  controls.querySelector(".fa-caret-up").addEventListener("click", () => configure({...current, level: level + 1}));
  controls.querySelector(".fa-caret-down").addEventListener("click", () => configure({...current, level: level - 1}));
  controls.querySelector(".cycle-rank").addEventListener("click", () => {
    configure({...current, rank: ranks[(ranks.indexOf(rank) + 1) % ranks.length]});
  });
  controls.querySelector(".reset")?.addEventListener("click", () => {
    const tokenData = foundry.utils.deepClone(row.tokenData);
    const advancement = foundry.utils.getProperty(row.initialTokenData, "delta.system.advancement");
    if ( advancement ) foundry.utils.setProperty(tokenData, "delta.system.advancement", {...advancement});
    else delete tokenData.delta?.system?.advancement;
    dialog.updateTokenData(row.key, tokenData);
  });
}
