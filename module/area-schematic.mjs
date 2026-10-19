/**
 * Crucible's encounter and spawn dialog classes, which extend those of the area-schematic library.
 * Area map modules bundle the library, whose newest copy present provides the classes to extend at init.
 */
import CrucibleGroupActor from "./models/actor-group.mjs";

/**
 * @typedef {InstanceType<ReturnType<typeof defineEncounterClass>>} CrucibleEncounter
 */

/**
 * The threat of an encounter's allies, and of each planned combat's sides.
 * @typedef CrucibleEncounterAssessment
 * @property {number} allies                      The threat of the party and the first combat's friendly tokens
 * @property {Map<number, CrucibleCombatAssessment>} combats  Each planned combat with combatants which count
 */

/**
 * @typedef CrucibleCombatAssessment
 * @property {number} allies                      The threat of the shared allies and the combat's own friendly tokens
 * @property {number} threat                      The threat of the combat's hostile tokens
 */

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
 * Replace the library's encounter class with Crucible's subclass of it, which spawns through Crucible's dialog.
 */
export function registerEncounterClass() {
  const base = CONFIG.AreaSchematic.encounterClass;
  const spawnDialogClass = defineSpawnDialogClass(base.spawnDialogClass);
  CONFIG.AreaSchematic.encounterClass = defineEncounterClass(base, spawnDialogClass);
}

/* -------------------------------------------- */

/**
 * Define Crucible's encounter class, which assesses each encounter's difficulty.
 * @param {typeof foundry.abstract.DataModel} base                The library's encounter class
 * @param {typeof foundry.applications.api.ApplicationV2} spawnDialogClass  Crucible's spawn dialog class
 */
function defineEncounterClass(base, spawnDialogClass) {
  return class CrucibleEncounter extends base {

    /** @override */
    static spawnDialogClass = spawnDialogClass;

    /* -------------------------------------------- */
    /*  Assessment                                  */
    /* -------------------------------------------- */

    /**
     * Weigh each planned combat's hostile combatants against the allies, leaving neutral ones out.
     * The party and the first combat's friendly tokens are allies in every combat, other planned friendly tokens are
     * allies in their own combat alone, and friendly tokens planned for no combat do not count.
     * @returns {CrucibleEncounterAssessment|null}  The assessment, or null if an Actor does not exist
     */
    assessEncounter() {
      const {FRIENDLY, NEUTRAL} = CONST.TOKEN_DISPOSITIONS;
      const party = this.constructor.getPartyActors();
      const partyIds = new Set(party.map(a => a.id));
      const counted = new Set(); // Linked actors and party members, which are the same creature wherever they appear
      const combats = new Map();
      const addTo = (combat, side, threat) => {
        if ( !combats.has(combat) ) combats.set(combat, {allies: 0, threat: 0});
        combats.get(combat)[side] += threat;
      };
      let allies = 0;
      for ( const [g, group] of this.groups.entries() ) {
        for ( const {actor: actorId, number, tokenData} of this._getEntries(g, party) ) {
          const actor = game.actors.get(actorId);
          if ( !actor ) return null;
          const isParty = partyIds.has(actorId);
          let disposition = tokenData.disposition ?? actor.prototypeToken.disposition;
          if ( isParty ) disposition = Math.max(disposition, NEUTRAL);
          const threat = this.constructor.getThreat(actor, tokenData) * number;
          if ( disposition === FRIENDLY ) {
            const shared = isParty || (group.combat === 0);
            if ( (!shared && (group.combat === null)) || counted.has(actorId) ) continue;
            if ( isParty || (tokenData.actorLink ?? actor.prototypeToken.actorLink) ) counted.add(actorId);
            if ( shared ) allies += threat;
            else addTo(group.combat, "allies", threat);
          }
          else if ( (disposition < NEUTRAL) && (group.combat !== null) ) addTo(group.combat, "threat", threat);
        }
      }

      // Party members which spawn without an entry
      for ( const actor of party ) {
        if ( counted.has(actor.id) || (Math.max(actor.prototypeToken.disposition, NEUTRAL) !== FRIENDLY) ) continue;
        allies += actor.threat ?? 0;
      }

      // Every combat shares the allies
      for ( const combat of combats.values() ) combat.allies += allies;
      return {allies, combats};
    }

    /* -------------------------------------------- */
    /*  Enrichment                                  */
    /* -------------------------------------------- */

    /**
     * Describe the difficulty of the combat which starts, or else of the most threatening planned combat.
     * @inheritDoc
     */
    _enrichSubtitle(subtitle, options) {
      super._enrichSubtitle(subtitle, options);
      const contested = [...this.assessEncounter()?.combats ?? []].filter(([, c]) => c.threat > 0);
      if ( !contested.length ) return;
      const [, {allies, threat}] = contested.find(([id]) => id === 0)
        ?? contested.reduce((max, entry) => (entry[1].threat > max[1].threat ? entry : max));
      const {difficulty} = CrucibleGroupActor.evaluateEncounter(threat, allies);
      subtitle.dataset.tooltipHtml = [
        `${_loc("ENCOUNTER.PartyThreat")}: ${allies.toNearest(0.01)}`,
        `${_loc("ENCOUNTER.AdversaryThreat")}: ${threat.toNearest(0.01)}`
      ].join("<br>");
      if ( !difficulty ) return;

      // The difficulty in its tier's icon and color
      subtitle.dataset.difficulty = difficulty.id;
      subtitle.innerHTML = `<span class="encounter-difficulty ${difficulty.id}" style="--tier-color: `
        + `light-dark(${difficulty.colorLight}, ${difficulty.color})"><i class="${difficulty.icon}" inert></i> `
        + `${_loc(difficulty.label)}</span>`;
    }

    /* -------------------------------------------- */
    /*  Spawning                                    */
    /* -------------------------------------------- */

    /**
     * Move a linked adversary's configured level and rank onto its Actor, since its tokens share the Actor's data.
     * @inheritDoc
     */
    async _preSpawn(plan, options) {
      await super._preSpawn(plan, options);
      const actorUpdates = [];
      for ( const token of plan.tokens ) {
        const advancement = token.delta?.system?.advancement;
        if ( !token.actorLink || !advancement ) continue;
        actorUpdates.push({_id: token.actorId, system: {advancement}});
        delete token.delta.system.advancement;
      }
      if ( actorUpdates.length ) await Actor.implementation.updateDocuments(actorUpdates);
    }

    /* -------------------------------------------- */

    /**
     * The threat of one token of an Actor, at the level and rank its token data configures for an adversary.
     * @param {CrucibleActor} actor
     * @param {object} tokenData                  Token data which differs from the Actor's prototype token
     * @returns {number}
     */
    static getThreat(actor, tokenData) {
      if ( actor.type !== "adversary" ) return actor.threat ?? 0;
      const {level, rank} = {...actor.system.advancement,
        ...foundry.utils.getProperty(tokenData ?? {}, "delta.system.advancement")};
      const threatLevel = level < 0 ? 1 / Math.abs(level - 1) : level;
      return threatLevel * (SYSTEM.THREAT_RANKS[rank]?.scaling ?? 1);
    }
  };
}

/* -------------------------------------------- */

/**
 * Define Crucible's spawn dialog class, which shows threat and lets the GM adjust each adversary's level and rank.
 * @param {typeof foundry.applications.api.ApplicationV2} base    The library's spawn dialog class
 */
function defineSpawnDialogClass(base) {
  return class CrucibleEncounterSpawnDialog extends base {

    /** @override */
    static DEFAULT_OPTIONS = {
      classes: ["crucible", "sheet", "themed", "theme-dark", "encounter-spawn"],
      position: {width: 540},
      actions: {
        adjustLevel: CrucibleEncounterSpawnDialog.#onAdjustLevel,
        cycleRank: CrucibleEncounterSpawnDialog.#onCycleRank,
        resetAdvancement: CrucibleEncounterSpawnDialog.#onResetAdvancement
      }
    };

    /**
     * @override
     * @type {CrucibleEncounter}
     */
    get encounter() {
      return /** @type {CrucibleEncounter} */ (super.encounter);
    }

    /**
     * The measure of each row as last rendered, keyed by row key.
     * @type {Map<string, EncounterRowMeasure>}
     */
    #measures = new Map();

    /* -------------------------------------------- */

    /**
     * Add each row's controls and threat, then the party threat beneath the allies and each planned combat's balance.
     * @inheritDoc
     */
    async _onRender(context, options) {
      await super._onRender(context, options);
      this.#measures.clear();
      for ( const row of context.rows ) {
        const measure = this.#measureRow(row);
        this.#measures.set(row.key, measure);
        this.#renderRow(measure);
      }
      this.#renderBalances(context);
    }

    /* -------------------------------------------- */

    /**
     * Configure an adversary row's level and rank in the token data of the dialog's copy of the encounter.
     * @param {EncounterRowMeasure} measure
     * @param {{level?: number, rank?: string}} change
     * @returns {Promise<this>}
     */
    #configureAdvancement({row}, change) {
      const tokenData = foundry.utils.deepClone(row.tokenData);
      tokenData.delta ??= {};
      const current = foundry.utils.getProperty(tokenData, "delta.system.advancement") ?? {};
      foundry.utils.setProperty(tokenData, "delta.system.advancement", {...current, ...change});
      return this.updateTokenData(row.key, tokenData);
    }

    /* -------------------------------------------- */

    /**
     * The measure of the row containing an element.
     * @param {HTMLElement} target
     * @returns {EncounterRowMeasure}
     */
    #getMeasure(target) {
      return this.#measures.get(target.closest("[data-key]").dataset.key);
    }

    /* -------------------------------------------- */

    /**
     * Measure a row's level and rank from its token data, as configured and before configuration.
     * @param {object} row
     * @returns {EncounterRowMeasure}
     */
    #measureRow(row) {
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
     * Weigh each planned combat's hostile combatants against the allies.
     * Adding to a Scene also weighs the combatants already in its active Combat against the first combat.
     * @param {object} context                    The render context
     */
    #renderBalances(context) {
      const assessment = this.encounter.assessEncounter();
      if ( !assessment ) return;
      const {FRIENDLY, NEUTRAL} = CONST.TOKEN_DISPOSITIONS;
      const {allies} = assessment;
      const counter = (id, label, value, {difficulty, total=false}={}) => {
        const assessed = difficulty ? `<span class="difficulty ${difficulty.id}" style="--tier-color: `
          + `light-dark(${difficulty.colorLight}, ${difficulty.color})"><i class="${difficulty.icon}" inert></i> `
          + `${_loc(difficulty.label)}</span>` : "";
        return `<div class="counter ${id}"><span class="label">${_loc(label)}</span>${assessed}`
          + `<span class="value${total ? " hex flat" : ""}">${value}</span></div>`;
      };
      const appendBalance = (fieldset, counters) => {
        const balance = document.createElement("div");
        balance.classList.add("encounter-balance");
        balance.innerHTML = counters.join("");
        fieldset.append(balance);
      };

      // The allies, shared by every combat
      const alliesFieldset = this.element.querySelector("fieldset[data-side=allies]");
      if ( alliesFieldset ) {
        appendBalance(alliesFieldset, [counter("party", "ENCOUNTER.PartyThreat", allies.toNearest(0.01), {total: true})]);
      }

      // Each combat's adversaries, where the first combat joins the ongoing Combat when adding
      const spawning = new Set([...context.party, ...context.rows.filter(r => r.linked).map(r => r.actor)]
        .map(a => a.id));
      for ( const fieldset of this.element.querySelectorAll("fieldset[data-combat]") ) {
        const combat = Number(fieldset.dataset.combat);
        let {allies: party, threat} = assessment.combats.get(combat) ?? {allies, threat: 0};
        let ongoing = null;
        if ( (combat === 0) && (context.spawnOptions.mode === "add") && context.combat ) {
          let hostile = 0;
          let friendly = 0;
          for ( const {actor, token} of context.combat.combatants ) {
            if ( !actor || spawning.has(actor.id) ) continue;
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
     * @param {EncounterRowMeasure} measure
     */
    #renderRow(measure) {
      const {row, adjustable, level, rank, initial} = measure;
      const item = this.element.querySelector(`.line-item[data-key="${row.key}"]`);
      const controls = item?.querySelector(":scope > .controls");
      if ( !controls ) return;
      const threat = (this.encounter.constructor.getThreat(row.actor, row.tokenData) * row.number).toNearest(0.01);
      item.insertAdjacentHTML("beforeend",
        `<span class="value" aria-label="${_loc("ENCOUNTER.Threat", {threat})}">${threat}</span>`);
      if ( !adjustable ) return;

      // A reset once changed, which leads so that its appearance shifts nothing, then level carets and the rank
      const {min, max} = row.actor.system.schema.getField("advancement.level").options;
      const rankConfig = SYSTEM.THREAT_RANKS[rank];
      const changed = (level !== initial.level) || (rank !== initial.rank);
      const reset = changed ? `<button type="button" class="icon fa-solid fa-arrow-rotate-left reset"
        data-action="resetAdvancement" data-tooltip aria-label="${_loc("ACTOR.ADVERSARY.ACTIONS.ResetAdjustment")}">
        </button>` : "";
      controls.insertAdjacentHTML("afterbegin", `${reset}
      <div class="advancement">
        <div class="controls flexcol">
          <button type="button" class="icon fa-solid fa-caret-up" data-action="adjustLevel" data-delta="1" data-tooltip
            ${level >= max ? "disabled" : ""} aria-label="${_loc("ACTOR.ADVERSARY.ACTIONS.IncreaseLevel")}"></button>
          <button type="button" class="icon fa-solid fa-caret-down" data-action="adjustLevel" data-delta="-1"
            data-tooltip ${level <= min ? "disabled" : ""} aria-label="${_loc("ACTOR.ADVERSARY.ACTIONS.DecreaseLevel")}">
          </button>
        </div>
        <span class="level" data-tooltip aria-label="${_loc("ADVANCEMENT.Level")}">${level}</span>
      </div>
      <button type="button" class="icon ${rankConfig.icon} cycle-rank" data-action="cycleRank" data-tooltip
        aria-label="${_loc(rankConfig.label)}: ${_loc("ACTOR.ADVERSARY.ACTIONS.CycleRank")}"></button>`);
    }

    /* -------------------------------------------- */

    /**
     * Raise or lower an adversary row's level.
     * @this {CrucibleEncounterSpawnDialog}
     * @param {PointerEvent} _event
     * @param {HTMLButtonElement} target
     * @returns {Promise<CrucibleEncounterSpawnDialog>}
     */
    static #onAdjustLevel(_event, target) {
      const measure = this.#getMeasure(target);
      return this.#configureAdvancement(measure, {level: measure.level + Number(target.dataset.delta)});
    }

    /* -------------------------------------------- */

    /**
     * Cycle an adversary row's threat rank.
     * @this {CrucibleEncounterSpawnDialog}
     * @param {PointerEvent} _event
     * @param {HTMLButtonElement} target
     * @returns {Promise<CrucibleEncounterSpawnDialog>}
     */
    static #onCycleRank(_event, target) {
      const measure = this.#getMeasure(target);
      const ranks = Object.keys(SYSTEM.THREAT_RANKS);
      return this.#configureAdvancement(measure, {rank: ranks[(ranks.indexOf(measure.rank) + 1) % ranks.length]});
    }

    /* -------------------------------------------- */

    /**
     * Restore an adversary row's level and rank to those of the encounter before configuration.
     * @this {CrucibleEncounterSpawnDialog}
     * @param {PointerEvent} _event
     * @param {HTMLButtonElement} target
     * @returns {Promise<CrucibleEncounterSpawnDialog>}
     */
    static #onResetAdvancement(_event, target) {
      const {row} = this.#getMeasure(target);
      const tokenData = foundry.utils.deepClone(row.tokenData);
      const advancement = foundry.utils.getProperty(row.initialTokenData, "delta.system.advancement");
      if ( advancement ) foundry.utils.setProperty(tokenData, "delta.system.advancement", {...advancement});
      else delete tokenData.delta?.system?.advancement;
      return this.updateTokenData(row.key, tokenData);
    }
  };
}
