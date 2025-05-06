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
      prepare: this._prepareAncestries
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

  static async _prepareAncestries() {
    const pack = game.packs.get("crucible.ancestry");
    await pack.getDocuments();
    const ancestries = [];
    for ( const item of pack.documents ) {
      if ( item.type !== "ancestry" ) continue;
      ancestries.push({
        item,
        name: item.name,
        img: item.img,
        color: item.system.color
      })
    }
    return ancestries;
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
