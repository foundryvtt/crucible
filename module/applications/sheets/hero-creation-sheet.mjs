const {ActorSheetV2} = foundry.applications.sheets;
const {HandlebarsApplicationMixin} = foundry.applications.api;

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
      prepare: CrucibleHeroCreationSheet.#prepareAncestries
    },
    background: {
      id: "background",
      label: "Background",
      order: 2,
      numeral: "II",
      template: "systems/crucible/templates/sheets/creation/background.hbs"
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
   * The character name that has been chosen.
   * @type {string}
   */
  #charname;

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
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Prepare data for each of the available Ancestry items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @param {object} context
   * @param {object} options
   * @returns {Promise<{item: CrucibleItem, name: string, color: string, icon: string}[]>}
   */
  static async #prepareAncestries(context, options) {
    context.ancestries = await CrucibleHeroCreationSheet.#prepareItems("ancestry", crucible.CONFIG.ancestryPacks);
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for each of the available Background items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @param {object} context
   * @param {object} options
   * @returns {Promise<{item: CrucibleItem, name: string, color: string, icon: string}[]>}
   */
  static async #prepareBackgrounds(context, options) {
    context.backgrounds = await CrucibleHeroCreationSheet.#prepareItems("background", crucible.CONFIG.backgroundPacks);
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for each of the available Background items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @param {string} itemType
   * @param {Set<string>} packs
   * @returns {Promise<{item: CrucibleItem, name: string, color: string, icon: string}[]>}
   */
  static async #prepareItems(itemType, packs) {
    const options = [];
    await Promise.allSettled(Array.from(packs).map(async packId => {
      const pack = game.packs.get(packId);
      if ( !pack ) {
        console.warn(`crucible.CONFIG.ancestryPacks entry "${packId}" does not exist as a valid compendium ID`);
        return;
      }
      const items = await pack.getDocuments({type: itemType});
      for ( const item of items ) {
        const {color, icon} = item.system.ui;
        options.push({item, name: item.name, color, icon});
      }
    }));
    options.sort((a, b) => a.name.localeCompare(b.name));
    return options;
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
    return {
      charname: this.#charname,
      actor: this.actor,
      buttons: this._prepareHeaderButtons(),
      activeStep: this.step,
      tabs: this._prepareHeaderTabs()
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    await super._preparePartContext(partId, context, options);
    const step = this.constructor.STEPS[partId];
    if ( step?.prepare instanceof Function ) await step.prepare.call(this, context, options);
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
    return buttons;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareHeaderTabs() {
    const tabs = super._prepareTabs("header");
    for ( const tab of Object.values(tabs) ) {
      const step = this.constructor.STEPS[tab.id];
      Object.assign(tab, step);
      step.completed = !!this.#completed[tab.id];
      if ( tab.completed ) tab.cssClass += ` completed`;
    }
    return tabs;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  changeTab(...args) {
    super.changeTab(...args);
    this.render({parts: ["header", this.step]});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async close(options={}) {
    options.animate = false;
    return super.close(options);
  }
}
