import {SYSTEM} from "../../config/system.mjs";
import CrucibleItem from "../../documents/item.mjs";

const {ActorSheetV2} = foundry.applications.sheets;
const {HandlebarsApplicationMixin} = foundry.applications.api;

/**
 * @typedef CrucibleHeroCreationState
 * @property {string} name
 * @property {Record<string, CrucibleHeroCreationItem>} ancestries
 * @property {string} ancestryId
 * @property {Record<string, CrucibleHeroCreationItem>} backgrounds
 * @property {string} backgroundId
 * @property {Set<string>} talents
 */

/**
 * @typedef CrucibleHeroCreationItem
 * @property {CrucibleItem} item
 * @property {string} name
 * @property {string} color
 * @property {string} icon
 * @property {string} summary
 */

/**
 * @typedef CrucibleHeroCreationItemFeature
 * @property {string} label
 * @property {string[]} tags
 * @property {CrucibleItem[]} items
 */

/**
 * An Actor Sheet responsible for managing the Crucible character creation process.
 * @template {CrucibleHeroCreationState} CreationState
 */
export default class CrucibleHeroCreationSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "crucible-hero-creation",
    tag: "div",
    classes: ["crucible", "crucible-fullscreen", "themed", "theme-dark"],
    window: {
      frame: false,
      positioned: false
    },
    actions: {
      chooseAncestry: CrucibleHeroCreationSheet.#onChooseAncestry,
      chooseBackground: CrucibleHeroCreationSheet.#onChooseBackground,
      restart: CrucibleHeroCreationSheet.#onRestart,
      abilityIncrease: CrucibleHeroCreationSheet.#onAbilityIncrease,
      abilityDecrease: CrucibleHeroCreationSheet.#onAbilityDecrease,
      complete: CrucibleHeroCreationSheet.#onComplete
    }
  };

  /**
   * Define the steps of character creation.
   */
  static STEPS = {
    ancestry: {
      id: "ancestry",
      label: "Ancestry",
      order: 1,
      numeral: "I",
      template: "systems/crucible/templates/sheets/creation/ancestry.hbs",
      initialize: CrucibleHeroCreationSheet.#initializeAncestries,
      prepare: CrucibleHeroCreationSheet.#prepareAncestries,
    },
    background: {
      id: "background",
      label: "Background",
      order: 2,
      numeral: "II",
      template: "systems/crucible/templates/sheets/creation/background.hbs",
      initialize: CrucibleHeroCreationSheet.#initializeBackgrounds,
      prepare: CrucibleHeroCreationSheet.#prepareBackgrounds,
    },
    talents: {
      id: "talents",
      label: "Talents",
      order: 3,
      numeral: "III",
      template: "systems/crucible/templates/sheets/creation/talents.hbs"
    }
  };

  /** @override */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/crucible/templates/sheets/creation/header.hbs",
      templates: [CrucibleItem.INLINE_TEMPLATE_PATH]
    }
    // PARTS from STEPS are defined dynamically in _configureRenderParts
  };

  /**
   * Configuration of application tabs, with an entry per tab group.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
  static TABS = {
    header: this._defineTabs()
  };

  /* -------------------------------------------- */

  /**
   * A clone of the Actor which the character creation process operates upon.
   * @type {CrucibleActor}
   * @protected
   */
  _clone = this.#createClone();

  /**
   * Data which persists the current state of character creation.
   * @type {Partial<CreationState>}
   * @protected
   */
  _state = {}

  /**
   * Track completed steps.
   * @type {Record<string, boolean>}
   * @protected
   */
  _completed = Object.seal(Object.values(this.constructor.STEPS).reduce((obj, s) => {
    obj[s.id] = false;
    return obj;
  }, {}));

  /* -------------------------------------------- */

  get steps() {
    return this.constructor.STEPS;
  }

  get step() {
    return this.tabGroups.header;
  }

  /* -------------------------------------------- */

  /**
   * Dynamically define the structure of TABS given declared STEPS.
   * @returns {{initial, tabs: *[]}}
   * @internal
   */
  static _defineTabs() {
    const tabs = [];
    for ( const s of Object.values(this.STEPS) ) {
      tabs.push({id: s.id, label: s.label});
    }
    return {tabs, initial: tabs[0].id};
  }

  /* -------------------------------------------- */
  /*  Data Initialization                         */
  /* -------------------------------------------- */

  /**
   * Create a clone of the true Actor which is managed by the character creation process.
   * @returns {CrucibleActor}
   */
  #createClone() {
    const actorData = this.document.toObject();
    actorData._id = null;
    return this.document.constructor.fromSource(actorData);
  }

  /* -------------------------------------------- */

  /**
   * Perform one-time initialization of context data that is performed upon the first render.
   * @returns {Promise<void>}
   * @protected
   */
  async _initializeState() {
    this._state.name = this._clone.name;
    const promises = [];
    for ( const step of Object.values(this.constructor.STEPS) ) {
      if ( step?.initialize instanceof Function ) promises.push(step.initialize.call(this));
    }
    await Promise.all(promises);
  }

  /* -------------------------------------------- */

  /**
   * Initialize data for each of the available Ancestry items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @returns {Promise<Record<string, CrucibleHeroCreationItem>>}
   */
  static async #initializeAncestries() {
    const {ancestryPacks} = crucible.CONFIG;
    this._state.ancestries = await CrucibleHeroCreationSheet.#initializeItemOptions("ancestry", ancestryPacks,
      this._initializeAncestry);
  }

  /* -------------------------------------------- */

  /**
   * Initialize an ancestry option, augmenting it with further functionality.
   * @param {CrucibleHeroCreationItem} ancestry
   * @returns {Promise<void>}
   * @protected
   */
  async _initializeAncestry(ancestry) {
    const {abilities, resistances, movement, talents, schema} = ancestry.item.system;

    // Ability Bonuses
    const primary = SYSTEM.ABILITIES[abilities.primary];
    const secondary = SYSTEM.ABILITIES[abilities.secondary];
    ancestry.features.push({
      label: schema.getField("abilities").label,
      tags: [
        {text: `${primary.label} ${SYSTEM.ANCESTRIES.primaryAbilityStart}`},
        {text: `${secondary.label} ${SYSTEM.ANCESTRIES.secondaryAbilityStart}`}
      ]
    });

    // Resistances and Vulnerabilities
    const res = SYSTEM.DAMAGE_TYPES[resistances.resistance];
    const vuln = SYSTEM.DAMAGE_TYPES[resistances.vulnerability];
    ancestry.features.push({
      label: schema.getField("resistances").label,
      tags: [
        {text: res ? `Resistance: ${res.label} +${SYSTEM.ANCESTRIES.resistanceAmount}` : "Resistance: None"},
        {text: res ? `Vulnerability: ${vuln.label} -${SYSTEM.ANCESTRIES.resistanceAmount}` : "Vulnerability: None"}
      ]
    });

    // Movement
    const {size, stride} = movement;
    ancestry.features.push({
      label: schema.getField("movement").label,
      tags: [
        {text: `Size ${size}ft`},
        {text: `Stride ${stride}ft`}
      ]
    });

    // Talents
    ancestry.features.push({
      label: schema.getField("talents").label,
      items: await Promise.all(talents.map(uuid => CrucibleHeroCreationSheet._renderFeatureItem(uuid)))
    });
  }

  /* -------------------------------------------- */

  /**
   * Initialize data for each of the available Background items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @returns {Promise<Record<string, CrucibleHeroCreationItem>>}
   */
  static async #initializeBackgrounds() {
    const {backgroundPacks} = crucible.CONFIG;
    this._state.backgrounds = await CrucibleHeroCreationSheet.#initializeItemOptions("background", backgroundPacks,
      this._initializeBackground);
  }

  /* -------------------------------------------- */

  /**
   * Initialize an ancestry option, augmenting it with further functionality.
   * @param {CrucibleHeroCreationItem} background
   * @returns {Promise<void>}
   * @protected
   */
  async _initializeBackground(background) {
    const {talents, schema} = background.item.system;
    background.features.push({
      label: schema.getField("talents").label,
      items: await Promise.all(talents.map(uuid => CrucibleHeroCreationSheet._renderFeatureItem(uuid)))
    });
  }

  /* -------------------------------------------- */

  /**
   * Initialize data for each of the available Background items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @param {string} itemType
   * @param {Set<string>} packs
   * @param {Function} [fn]
   * @returns {Promise<Record<string, CrucibleHeroCreationItem>>}
   */
  static async #initializeItemOptions(itemType, packs, fn) {
    const options = {};
    await Promise.allSettled(Array.from(packs).map(async packId => {
      const pack = game.packs.get(packId);
      if ( !pack ) {
        console.warn(`crucible.CONFIG.ancestryPacks entry "${packId}" does not exist as a valid compendium ID`);
        return;
      }
      const items = await pack.getDocuments({type: itemType});
      for ( const item of items ) {
        const identifier = item.system.identifier;
        const option = {
          identifier,
          item,
          name: item.name,
          color: item.system.ui.color ?? "#8a867c",
          icon: item.img,
          summary: await TextEditor.enrichHTML(item.system.description),
          features: []
        }
        if ( fn instanceof Function ) await fn.call(this, option);
        options[identifier] = option;
      }
    }));
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Render partial HTML for an item provided by a character creation feature.
   * @param {string} uuid
   * @returns {Promise<string>}
   * @protected
   */
  static async _renderFeatureItem(uuid) {
    const item = await fromUuid(uuid);
    if ( !item ) return "";
    return item.renderInline();
  }

  /* -------------------------------------------- */
  /*  Context Preparation                         */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {

    // One-time initialization
    if ( options.isFirstRender || foundry.utils.isEmpty(this._state) ) await this._initializeState();

    // Base context preparation
    const context = {
      actor: this.actor,
      abilities: this._prepareAbilityScores(),
      buttons: this._prepareHeaderButtons(),
      activeStep: this.step,
      charname: this._state.name,
      state: this._state,
      tabs: this._prepareHeaderTabs()
    }

    // Step-specific preparation
    await this._prepareSteps(context, options);

    // Finalize tab steps
    for ( const tab of Object.values(context.tabs) ) {
      tab.cssClass = [
        tab.active ? "active" : "",
        tab.completed ? "complete" : "incomplete"
      ].filterJoin(" ")
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare fullscreen control buttons displayed in the header.
   * @returns {[{icon: string, tooltip: string, action: string, label: string}]}
   * @protected
   */
  _prepareHeaderButtons() {
    const buttons = [
      {action: "close", icon: "fa-light fa-hexagon-xmark", label: "Exit", tooltip: "Exit Creation"},
      {action: "restart", icon: "fa-light fa-hexagon-exclamation", label: "Restart", tooltip: "Restart Creation"}
    ];
    if ( Object.values(this._completed).every(v => v === true) ) {
      buttons.push({action: "complete", icon: "fa-light fa-hexagon-check", label: "Complete", tooltip: "Complete Creation"});
    }
    return buttons;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareHeaderTabs() {
    const tabs = this._prepareTabs("header");
    const plurals = new Intl.PluralRules(game.i18n.lang);

    // Default icons and completion state
    for ( const tab of Object.values(tabs) ) {
      const step = this.constructor.STEPS[tab.id];
      const completed = !!this._completed[tab.id];
      Object.assign(tab, step, {
        selectionIcon: `systems/crucible/ui/svg/hexagon-${completed ? "checkmark" : "xmark"}.svg`,
        completed: completed,
        cssClass: completed ? "complete" : "incomplete"
      });
    }

    // Background specifically
    if ( "background" in tabs ) {
      const ap = this._clone.points.ability.pool;
      tabs.background.selectionLabel = `${ap} ${game.i18n.localize("TALENT.LABELS.Points." + plurals.select(ap))}`;
    }

    // Talents specifically
    if ( "talents" in tabs ) {
      const tp = this._clone.points.talent.available;
      tabs.talents.selectionLabel = tp > 0
        ? `${tp} ${game.i18n.localize("TALENT.LABELS.Talents." + plurals.select(tp))}`
        : "Completed";
    }
    return tabs;
  }

  /* -------------------------------------------- */

  /**
   * Prepare ability score data.
   * @returns {object}
   * @protected
   */
  _prepareAbilityScores() {
    const abilities = [];
    for ( const [abilityId, cfg] of Object.entries(SYSTEM.ABILITIES) ) {
      const {value, base} = this._clone.system.abilities[abilityId];
      abilities.push({
        id: abilityId,
        label: cfg.label,
        group: cfg.group,
        order: cfg.sheetOrder,
        total: value,
        increases: base ? base.signedString() : "",
        canIncrease: this._clone.canPurchaseAbility(abilityId, 1),
        canDecrease: this._clone.canPurchaseAbility(abilityId, -1)
      });
    }
    abilities.sort((a, b) => a.order - b.order);
    return {abilities, points: this._clone.points.ability};
  }

  /* -------------------------------------------- */

  /**
   * Perform one-time initialization of context data that is performed upon the first render.
   * @returns {Promise<void>}
   * @private
   */
  async _prepareSteps(context, options) {
    const promises = [];
    for ( const step of Object.values(this.constructor.STEPS) ) {
      if ( step?.initialize instanceof Function ) promises.push(step.prepare.call(this, context, options));
    }
    await Promise.all(promises);
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for rendering on the ancestry step.
   * @this CrucibleHeroCreationSheet
   * @returns {Promise<void>}
   */
  static async #prepareAncestries(context, _options) {
    const {ancestries, ancestryId} = this._state;
    const t = context.tabs.ancestry;

    // Ancestry options
    context.ancestries = Object.values(ancestries).sort((a, b) => a.name.localeCompare(b.name));
    for ( const a of context.ancestries ) {
      a.selected = a.identifier === ancestryId;
      a.cssClass = a.selected ? "active" : "";
    }

    // Chosen Ancestry
    this._completed.ancestry = ancestryId in ancestries;
    if ( ancestryId ) {
      const a = context.ancestry = ancestries[ancestryId];
      if ( a.color ) t.selectionColor = a.color;
      if ( a.icon ) t.selectionIcon = a.icon;
      t.selectionLabel = a.name;
      t.completed = true;
    }
    else context.ancestry = null;
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for rendering on the background step.
   * @this CrucibleHeroCreationSheet
   * @returns {Promise<void>}
   */
  static async #prepareBackgrounds(context, _options) {
    const {backgrounds, backgroundId} = this._state;
    const t = context.tabs.background;

    // Background options
    context.backgrounds = Object.values(backgrounds).sort((a, b) => a.name.localeCompare(b.name));
    for ( const b of context.backgrounds ) {
      b.selected = b.identifier === backgroundId;
      b.cssClass = b.selected ? "active" : "";
    }

    // Chosen Background
    this._completed.background = backgroundId in backgrounds;
    if ( backgroundId ) {
      const b = context.background = backgrounds[backgroundId];
      if ( b.color ) t.selectionColor = b.color;
      if ( b.icon ) t.selectionIcon = b.icon;
      if ( this._clone.points.ability.pool === 0 ) {
        t.selectionLabel = b.name;
        t.completed = true;
      }
    }
    else context.background = null;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if ( !options.isFirstRender ) options.parts.findSplice(p => p === "talents"); // Never re-render talents
    if ( this.element ) this._state.name = this.element.querySelector("#hero-creation-name").value.trim();
  }

  /* -------------------------------------------- */

  /** @override */
  _canRender(_options) {
    super._canRender(_options);
    if ( (this.document.type !== "hero") || (this.document.level > 0) ) {
      throw new Error("You may only use the CrucibleHeroCreationSheet for a hero Actor which is level zero.")
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _configureRenderParts(_options) {
    const parts = foundry.utils.deepClone(this.constructor.PARTS);
    for ( const step of Object.values(this.constructor.STEPS) ) {
      parts[step.id] = {id: step.id, template: step.template}
    }
    return parts;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  changeTab(...args) {
    super.changeTab(...args);
    this.element.dataset.step = this.step;
    crucible.api.audio.playClick();
    this.deactivateTalentTree().then(() => {
      this.render({parts: ["header", this.step]});
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async close(options={}) {
    if ( options.dialog !== false ) {
      crucible.api.audio.playClick();
      const confirm = await foundry.applications.api.DialogV2.confirm({
        window: {
          title: "Abandon Creation Progress?",
          icon: "fa-solid fa-circle-x"
        },
        content: "Discard creation progress and exit the creator?",
        modal: true
      });
      if ( !confirm ) return;
    }
    options.animate = false;
    return super.close(options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.dataset.step = this.step;
    // Activate talent tree
    if ( this.step === "talents" ) {
      await this.activateTalentTree();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onClose(options) {
    await this._reset();
    await super._onClose(options);
  }

  /* -------------------------------------------- */
  /*  Public API                                  */
  /* -------------------------------------------- */

  /**
   * Choose an Ancestry.
   * @param {string} ancestryId
   * @returns {Promise<void>}
   */
  async chooseAncestry(ancestryId) {
    if ( !(ancestryId in this._state.ancestries) ) throw new Error(`Invalid Ancestry identifier "${ancestryId}"`);
    this._state.ancestryId = ancestryId;
    const actor = this._clone;
    const ancestryItem = this._state.ancestries[ancestryId].item;

    // Remove prior Ancestry talents
    for ( const item of actor.items ) {
      if ( (item.type === "talent") && item.flags.crucible?.ancestry ) actor.items.delete(item.id);
    }

    // Add new Ancestry talents
    for ( const uuid of ancestryItem.system.talents ) {
      const talent = await fromUuid(uuid);
      if ( !talent ) continue;
      const talentData = talent.toObject()
      foundry.utils.mergeObject(talentData, {"flags.crucible.ancestry": ancestryId});
      actor.items.set(talent.id, new talent.constructor(talentData, {parent: actor}));
    }

    // Add new Ancestry data
    const ancestryData = {name: ancestryItem.name, img: ancestryItem.img, ...ancestryItem.system.toObject()};
    actor.updateSource({system: {details: {"==ancestry": ancestryData}}});
    await this.render({parts: ["header", this.step]});
  }

  /* -------------------------------------------- */
  /**
   * Choose a Background.
   * @param {string|CrucibleItem} background
   * @returns {Promise<void>}
   */
  async chooseBackground(background) {
    const actor = this._clone;
    let backgroundId;
    let backgroundItem;

    // Background ID
    if ( typeof background === "string" ) {
      backgroundId = background;
      if ( !(backgroundId in this._state.backgrounds) ) {
        throw new Error(`Invalid Background identifier "${backgroundId}"`);
      }
      backgroundItem = this._state.backgrounds[backgroundId].item;
    }

    // Background Item
    else if ( background instanceof CrucibleItem ) {
      backgroundId = background.system.identifier;
      backgroundItem = background;
    }
    else throw new Error("Invalid background provided to CrucibleHeroCreationSheet#chooseBackground");

    // Remove prior background
    this.removeBackground();
    this._state.backgroundId = backgroundId;

    // Add new Background talents
    for ( const uuid of backgroundItem.system.talents ) {
      const talent = await fromUuid(uuid);
      if ( !talent ) continue;
      const talentData = talent.toObject()
      foundry.utils.mergeObject(talentData, {"flags.crucible.background": backgroundId});
      actor.items.set(talent.id, new talent.constructor(talentData, {parent: actor}));
    }

    // Add new Background data
    actor.updateSource({
      system: {
        details: {
          "==background": {name: backgroundItem.name, img: backgroundItem.img, ...backgroundItem.system.toObject()}
        }
      }
    });
    await this.render({parts: ["header", this.step]});
  }

  /* -------------------------------------------- */

  /**
   * Remove a background item from the actor being created.
   */
  removeBackground() {
    if ( !this._state.backgroundId ) return;
    const actor = this._clone;
    delete this._state.backgroundId;
    for ( const item of actor.items ) {
      if ( (item.type === "talent") && item.flags.crucible?.background ) actor.items.delete(item.id);
    }
    actor.updateSource({system: {details: {"==background": null}}});
  }

  /* -------------------------------------------- */

  /**
   * Activate the talent tree by embedding it within the character creation application.
   * @returns {Promise<void>}
   */
  async activateTalentTree() {
    const tree = crucible.tree;
    if ( tree.actor === this._clone ) return;
    await tree.open(this._clone, {parentApp: this});
    const tab = this.element.querySelector(".tab[data-tab=talents]");
    tab.replaceChildren(tree.canvas);
  }

  /* -------------------------------------------- */

  /**
   * Deactivate the talent tree by removing it from the character creation interface.
   * @returns {Promise<void>}
   */
  async deactivateTalentTree() {
    if ( crucible.tree.actor === this._clone ) {
      await crucible.tree.close();
      document.body.append(crucible.tree.canvas);
    }
  }

  /* -------------------------------------------- */

  /**
   * Callback logic invoked when the embedded talent tree is updated.
   * @internal
   */
  async _onRefreshTalentTree() {
    this._completed.talents = this._clone.points.talent.available === 0;
    await this.render({parts: ["header"]});
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle click events to choose an Ancestry.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onAbilityIncrease(event) {
    const ability = event.target.closest(".ability");
    crucible.api.audio.playClick();
    await this._clone.purchaseAbility(ability.dataset.ability, 1);
    await this.render({parts: [this.step, "header"]});
  }
  /* -------------------------------------------- */

  /**
   * Handle click events to choose an Ancestry.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onAbilityDecrease(event) {
    const ability = event.target.closest(".ability");
    crucible.api.audio.playClick();
    await this._clone.purchaseAbility(ability.dataset.ability, -1);
    await this.render({parts: [this.step, "header"]});
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to choose an Ancestry.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static #onChooseAncestry(event) {
    const choice = event.target.closest(".option");
    this.chooseAncestry(choice.dataset.ancestryId);
    crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to choose a Background.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static #onChooseBackground(event) {
    const choice = event.target.closest(".option");
    this.chooseBackground(choice.dataset.backgroundId);
    crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  /**
   * Reset the creation process and restart from the beginning.
   * @this {CrucibleHeroCreationSheet}
   * @returns {Promise<void>}
   */
  static async #onRestart() {
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Reset Creation Progress?",
        icon: "fa-solid fa-hexagon-exclamation"
      },
      content: "Discard creation progress and restart from the beginning?",
      modal: true
    });
    if ( !confirm ) return;
    await this._reset();
    await this.render();
  }

  /* -------------------------------------------- */

  /**
   * Conclude the character creation process.
   * @this {CrucibleHeroCreationSheet}
   * @returns {Promise<void>}
   */
  static async #onComplete() {
    this._state.name = this.element.querySelector("#hero-creation-name").value.trim();
    const creationData = this._clone.toObject();
    const creationOptions = {recursive: false, diff: false, noHook: true};
    await this._finalizeCreationData(creationData, creationOptions);

    // Close the creation sheet
    await this.close({dialog: false});
    this.document._sheet = null;

    // Update the actor and render the regular sheet
    await this.document.update(creationData, creationOptions);
    this.document.sheet.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * Finalize the ActorData which will be applied at the end of character creation.
   * @param {ActorData} creationData
   * @param {Partial<DatabaseUpdateOperation>} creationOptions
   * @protected
   */
  async _finalizeCreationData(creationData, creationOptions) {
    creationData.name = this._state.name;
    delete creationData.flags.core.sheetClass;
    creationData.system.advancement.level = 1;
  }

  /* -------------------------------------------- */

  /**
   * Reset the creation process. Used close and restart.
   * @returns {Promise<void>}
   * @protected
   */
  async _reset() {
    await this.deactivateTalentTree();
    this._clone = this.#createClone();
    this._state = {};
    await this._initializeState();
    this.tabGroups.header = Object.values(this.constructor.STEPS).find(s => s.order === 1).id;
  }
}
