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
 */

/**
 * An Actor Sheet responsible for managing the Crucible character creation process.
 * @template {CrucibleHeroCreationState} CreationState
 */
export default class CrucibleHeroCreationSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  constructor(options) {
    super(options);
    this.#clone = this.document.constructor.fromSource(this.document.toObject());
  }

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
      // abilityIncrease: EmberCharacterCreationSheet.#onAbilityIncrease,
      // abilityDecrease: EmberCharacterCreationSheet.#onAbilityDecrease,
      // abilityBoostIncrease: EmberCharacterCreationSheet.#onAbilityBoostIncrease,
      // abilityBoostDecrease: EmberCharacterCreationSheet.#onAbilityBoostDecrease,
      // complete: EmberCharacterCreationSheet.#onComplete
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
      template: "systems/crucible/templates/sheets/creation/header.hbs"
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
   */
  #clone;

  /**
   * Data which persists the current state of character creation.
   * @type {Partial<CreationState>}
   * @protected
   */
  _state = {}

  /**
   * Track completed steps.
   * @type {Record<string, boolean>}
   */
  #completed = Object.seal(Object.values(this.constructor.STEPS).reduce((obj, s) => {
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
   * Perform one-time initialization of context data that is performed upon the first render.
   * @returns {Promise<void>}
   * @private
   */
  async _initializeState() {
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
  static async #initializeAncestries(context) {
    const {ancestryPacks} = crucible.CONFIG;
    this._state.ancestries = await CrucibleHeroCreationSheet.#initializeItemOptions("ancestry", ancestryPacks);
  }

  /* -------------------------------------------- */

  /**
   * Initialize data for each of the available Background items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @returns {Promise<Record<string, CrucibleHeroCreationItem>>}
   */
  static async #initializeBackgrounds(context) {
    const {backgroundPacks} = crucible.CONFIG;
    this._state.backgrounds = await CrucibleHeroCreationSheet.#initializeItemOptions("background", backgroundPacks);
  }

  /* -------------------------------------------- */

  /**
   * Initialize data for each of the available Background items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @param {string} itemType
   * @param {Set<string>} packs
   * @returns {Promise<Record<string, CrucibleHeroCreationItem>>}
   */
  static async #initializeItemOptions(itemType, packs) {
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
        const {color, icon} = item.system.ui;
        options[identifier] = {
          identifier,
          item,
          name: item.name,
          color: color ?? "#8a867c",
          icon: icon ?? "systems/crucible/ui/svg/unknown.svg"
        };
      }
    }));
    return options;
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
  static async #prepareAncestries(context, options) {
    const {ancestries, ancestryId} = this._state;
    const t = context.tabs.ancestry;

    // Ancestry options
    context.ancestries = Object.values(ancestries).sort((a, b) => a.name.localeCompare(b.name));
    for ( const a of context.ancestries ) {
      a.selected = a.identifier === ancestryId;
      a.cssClass = a.selected ? "active" : "";
    }

    // Chosen Ancestry
    this.#completed.ancestry = ancestryId in ancestries;
    if ( ancestryId ) {
      const a = context.ancestry = ancestries[ancestryId];
      if ( a.color ) t.selectionColor = a.color;
      if ( a.icon ) t.selectionIcon = a.icon;
      t.selectionLabel = a.name;
      t.complete = true;
    }
    else context.ancestry = null;
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for rendering on the background step.
   * @this CrucibleHeroCreationSheet
   * @returns {Promise<void>}
   */
  static async #prepareBackgrounds(context, options) {
    const {backgrounds, backgroundId} = this._state;
    const t = context.tabs.background;

    // Background options
    context.backgrounds = Object.values(backgrounds).sort((a, b) => a.name.localeCompare(b.name));
    for ( const b of context.backgrounds ) {
      b.selected = b.identifier === backgroundId;
      b.cssClass = b.selected ? "active" : "";
    }

    // Chosen Background
    if ( backgroundId ) {
      const b = context.background = backgrounds[backgroundId];
      if ( b.color ) t.selectionColor = b.color;
      if ( b.icon ) t.selectionIcon = b.icon;
      t.selectionLabel = b.name;
      t.complete = true;
    }
    else context.background = null;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  _canRender(_options) {
    super._canRender(_options);
    // TODO verify that this character has not already completed creation
  }

  /* -------------------------------------------- */

  /** @override */
  _configureRenderParts(options) {
    const parts = foundry.utils.deepClone(this.constructor.PARTS);
    for ( const step of Object.values(this.constructor.STEPS) ) {
      parts[step.id] = {id: step.id, template: step.template}
    }
    return parts;
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {

    // One-time initialization
    if ( options.isFirstRender || foundry.utils.isEmpty(this._state) ) await this._initializeState();

    // Base context preparation
    const context = {
      actor: this.actor,
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
        tab.complete ? "complete" : "incomplete"
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
      {action: "close", icon: "fa-light fa-circle-xmark", label: "Exit", tooltip: "Exit Creation"}
    ];
    if ( Object.values(this.#completed).every(v => v === true) ) {
      buttons.push({action: "complete", icon: "fa-light fa-circle-check", label: "Complete", tooltip: "Complete Creation"});
    }
    buttons.push({action: "restart", icon: "fa-light fa-undo", label: "Restart", tooltip: "Restart Creation"});
    return buttons;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareHeaderTabs() {
    const tabs = super._prepareTabs("header");
    for ( const tab of Object.values(tabs) ) {
      const step = this.constructor.STEPS[tab.id];
      Object.assign(tab, step, {
        selectionIcon: "systems/crucible/ui/svg/xmark.svg",
        completed: false,
        cssClass: "incomplete"
      });
    }
    return tabs;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  changeTab(...args) {
    super.changeTab(...args);
    this._state.name = this.element.querySelector("#hero-creation-name").value.trim();
    this.render({parts: ["header", this.step]});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async close(options={}) {
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Abandon Creation Progress?",
        icon: "fa-solid fa-circle-x"
      },
      content: "Discard creation progress and exit the creator?",
      modal: true
    });
    if ( !confirm ) return;
    options.animate = false;
    return super.close(options);
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
    const actor = this.#clone;

    // Remove prior Ancestry talents
    const existing = actor.system.details.ancestry;
    if ( existing?.talents?.size ) {
      for ( const uuid of existing.talents ) {
        const documentId = foundry.utils.parseUuid(uuid);
        actor.items.delete(documentId);
      }
    }

    // Add new Ancestry data
    const ancestryItem = this._state.ancestries[ancestryId].item;
    actor.updateSource({
      system: {
        details: {
          "==ancestry": {name: ancestryItem.name, img: ancestryItem.img, ...ancestryItem.system.toObject()}
        }
      }
    });

    // Add new Ancestry talents
    for ( const uuid of ancestryItem.system.talents ) {
      const talent = await fromUuid(uuid);
      if ( talent ) actor.items.set(talent.id, new talent.constructor(talent.toObject(), {parent: actor}));
    }
    await this.render({parts: ["header", "ancestry"]});
  }

  /* -------------------------------------------- */
  /**
   * Choose a Background.
   * @param {string} backgroundId
   * @returns {Promise<void>}
   */
  async chooseBackground(backgroundId) {
    if ( !(backgroundId in this._state.backgrounds) ) throw new Error(`Invalid Background identifier "${backgroundId}"`);
    this._state.backgroundId = backgroundId;
    const actor = this.#clone;

    // Clear prior Background talents
    const existing = actor.system.details.background;
    if ( existing?.talents?.size ) {
      for ( const uuid of existing.talents ) {
        const documentId = foundry.utils.parseUuid(uuid);
        actor.items.delete(documentId);
      }
    }

    // Add new Background data
    const backgroundItem = this._state.backgrounds[backgroundId].item;
    actor.updateSource({
      system: {
        details: {
          "==background": {name: backgroundItem.name, img: backgroundItem.img, ...backgroundItem.system.toObject()}
        }
      }
    });

    // Add new Background talents
    for ( const uuid of backgroundItem.system.talents ) {
      const talent = await fromUuid(uuid);
      if ( talent ) actor.items.set(talent.id, new talent.constructor(talent.toObject(), {parent: actor}));
    }
    await this.render({parts: ["header", "background"]});
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
  static #onChooseAncestry(event) {
    this._state.name = this.element.querySelector("#hero-creation-name").value.trim();
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
    this._state.name = this.element.querySelector("#hero-creation-name").value.trim();
    const choice = event.target.closest(".option");
    this.chooseBackground(choice.dataset.backgroundId);
    crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  /**
   * Reset the creation process and restart from the beginning.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onRestart(event) {
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Reset Creation Progress?",
        icon: "fa-solid fa-undo"
      },
      content: "Discard creation progress and restart from the beginning?",
      modal: true
    });
    if ( !confirm ) return;
    this.#clone = this.document.constructor.fromSource(this.document.toObject());
    this._state = {};
    this.tabGroups.header = Object.values(this.constructor.STEPS).find(s => s.order === 1).id;
    await this.render();
  }
}
