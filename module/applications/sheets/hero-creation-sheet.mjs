import {SYSTEM} from "../../const/system.mjs";
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
 * @property {{item: CrucibleItem, scaledPrice: number}[]} equipmentItems
 * @property {Record<string, {item: CrucibleItem, quantity: number, scaledPrice: number}>} equipment
 * @property {{type: string|null, category: string|null}} equipmentFilter
 * @property {Record<string, Record<string, string>>} categoriesByType
 */

/**
 * @typedef CrucibleHeroCreationItem
 * @property {string} identifier
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
      addEquipmentItem: CrucibleHeroCreationSheet.#onAddEquipmentItem,
      removeEquipmentItem: CrucibleHeroCreationSheet.#onRemoveEquipmentItem,
      filterEquipmentType: CrucibleHeroCreationSheet.#onFilterEquipmentType,
      filterEquipmentCategory: CrucibleHeroCreationSheet.#onFilterEquipmentCategory,
      complete: CrucibleHeroCreationSheet.#onComplete
    }
  };

  /**
   * Define the steps of character creation.
   */
  static STEPS = {
    ancestry: {
      id: "ancestry",
      label: "TYPES.Item.ancestry",
      order: 1,
      numeral: "I",
      template: "systems/crucible/templates/sheets/creation/ancestry.hbs",
      initialize: CrucibleHeroCreationSheet.#initializeAncestries,
      prepare: CrucibleHeroCreationSheet.#prepareAncestries
    },
    background: {
      id: "background",
      label: "TYPES.Item.background",
      order: 2,
      numeral: "II",
      template: "systems/crucible/templates/sheets/creation/background.hbs",
      initialize: CrucibleHeroCreationSheet.#initializeBackgrounds,
      prepare: CrucibleHeroCreationSheet.#prepareBackgrounds
    },
    talents: {
      id: "talents",
      label: "TALENT.LABELS.Talents.other",
      order: 3,
      numeral: "III",
      template: "systems/crucible/templates/sheets/creation/talents.hbs"
    },
    equipment: {
      id: "equipment",
      label: "ACTOR.CREATION.Equipment",
      order: 4,
      numeral: "IV",
      template: "systems/crucible/templates/sheets/creation/equipment.hbs",
      initialize: CrucibleHeroCreationSheet.#initializeEquipment,
      prepare: CrucibleHeroCreationSheet.#prepareEquipment,
      scrollable: [".equipment-list", ".equipment-selected"]
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
   * @protected
   */
  _clone = this.#createClone();

  /**
   * Data which persists the current state of character creation.
   * @type {Partial<CreationState>}
   * @protected
   */
  _state = {};

  /**
   * Track completed steps.
   * @type {Record<string, boolean>}
   * @protected
   */
  _completed = Object.seal(Object.values(this.constructor.STEPS).reduce((obj, s) => {
    obj[s.id] = false;
    return obj;
  }, {}));

  /**
   * Record when the entire process is complete so we can avoid displaying warnings on close.
   * @type {boolean}
   */
  #complete = false;

  /**
   * A SearchFilter instance for filtering the equipment list.
   * @type {foundry.applications.ux.SearchFilter}
   */
  #equipmentSearch = new foundry.applications.ux.SearchFilter({
    inputSelector: ".equipment-search",
    contentSelector: ".equipment-list",
    callback: CrucibleHeroCreationSheet.#onEquipmentSearchFilter
  });

  /**
   * The Actor's name, stored only when restarting character creation
   * @type {string|null}
   */
  #characterName = this._clone.name;

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
    this._state.name = this.#characterName;
    this.#characterName = null;
    this.#complete = false;
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
    const packs = crucible.CONFIG.packs.ancestry;
    this._state.ancestries = await CrucibleHeroCreationSheet.#initializeItemOptions("ancestry", packs,
      this.constructor._initializeAncestry);
  }

  /* -------------------------------------------- */

  /**
   * Initialize an ancestry option, augmenting it with further functionality.
   * @param {CrucibleHeroCreationItem} ancestry
   * @returns {Promise<void>}
   * @protected
   */
  static async _initializeAncestry(ancestry) {
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
        {text: _loc("ACTOR.ResistanceSpecific", {resistance: res ? `${res.label} +${SYSTEM.ANCESTRIES.resistanceAmount}` : _loc("None")})},
        {text: _loc("ACTOR.VulnerabilitySpecific", {vulnerability: vuln ? `${vuln.label} -${SYSTEM.ANCESTRIES.resistanceAmount}` : _loc("None")})}
      ]
    });

    // Movement
    const {size, stride} = movement;
    ancestry.features.push({
      label: schema.getField("movement").label,
      tags: [
        {text: _loc("ACTOR.SizeSpecific", {size})},
        {text: _loc("ACTOR.StrideSpecific", {stride})}
      ]
    });

    // Talents
    ancestry.features.push({
      label: schema.getField("talents").label,
      items: await Promise.all(talents.map(({item: uuid}) => this._renderFeatureItem(uuid)))
    });
  }

  /* -------------------------------------------- */

  /**
   * Initialize data for each of the available Background items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @returns {Promise<Record<string, CrucibleHeroCreationItem>>}
   */
  static async #initializeBackgrounds() {
    const packs = crucible.CONFIG.packs.background;
    this._state.backgrounds = await CrucibleHeroCreationSheet.#initializeItemOptions("background", packs,
      this.constructor._initializeBackground);
  }

  /* -------------------------------------------- */

  /**
   * Initialize an ancestry option, augmenting it with further functionality.
   * @param {CrucibleHeroCreationItem} background
   * @returns {Promise<void>}
   * @protected
   */
  static async _initializeBackground(background) {
    const {knowledge, skills, talents, schema, languages} = background.item.system;

    // Knowledge Areas
    const knowledgeTags = Array.from(knowledge.map(knowledgeId => {
      const k = crucible.CONFIG.knowledge[knowledgeId];
      return {text: _loc("ACTOR.KnowledgeSpecific", {knowledge: k?.label || k})};
    }));
    if ( knowledgeTags.length ) background.features.push({
      label: schema.getField("knowledge").label,
      tags: knowledgeTags
    });

    // Languages
    const languageTags = Array.from(languages.map(languageId => {
      const l = crucible.CONFIG.languages[languageId];
      return {text: _loc("ACTOR.LanguageSpecific", {language: l?.label || l})};
    }));
    if ( languageTags.length ) background.features.push({
      label: schema.getField("languages").label,
      tags: languageTags
    });

    // Skills
    const skillItems = await Promise.all(skills.map(skillId => {
      const uuid = SYSTEM.SKILLS[skillId].talents[1];
      return this._renderFeatureItem(uuid);
    }));
    if ( skillItems.length ) background.features.push({
      label: schema.getField("skills").label,
      items: skillItems
    });

    // Talents
    const talentItems = await Promise.all(talents.map(({item: uuid}) => this._renderFeatureItem(uuid)));
    if ( talentItems.length ) background.features.push({
      label: schema.getField("talents").label,
      items: talentItems
    });
  }

  /* -------------------------------------------- */

  /**
   * Initialize data for the available physical items which may be purchased during character creation.
   * @this CrucibleHeroCreationSheet
   * @returns {Promise<void>}
   */
  static async #initializeEquipment() {
    const packs = crucible.CONFIG.packs.equipment;
    const budget = SYSTEM.ACTOR.STARTING_EQUIPMENT_BUDGET;
    const items = [];
    await Promise.allSettled(Array.from(packs).map(async packId => {
      const pack = game.packs.get(packId);
      if ( !pack ) {
        console.warn(`Compendium pack "${packId}" does not exist as a valid compendium ID`);
        return;
      }
      const packItems = await pack.getDocuments();
      for ( const item of packItems ) {
        if ( !item.system.price ) continue;
        const scaledPrice = item.system.price;
        if ( scaledPrice > budget ) continue;
        items.push({item, scaledPrice});
      }
    }));
    items.sort((a, b) => a.item.name.localeCompare(b.item.name));
    this._state.equipmentItems = items;
    this._state.equipment = {};

    // Build category label map indexed by item type for the filter sidebar
    const categoriesByType = {};
    for ( const {item} of items ) {
      const type = item.type;
      const catId = item.system.category;
      if ( !catId ) continue;
      if ( !(type in categoriesByType) ) categoriesByType[type] = {};
      if ( !(catId in categoriesByType[type]) ) categoriesByType[type][catId] = item.system.config.category.label;
    }
    this._state.categoriesByType = categoriesByType;
    this._state.equipmentFilter = {type: null, category: null};
  }

  /* -------------------------------------------- */

  /**
   * Prepare context data for the equipment selection step.
   * @this CrucibleHeroCreationSheet
   * @param {object} context
   * @param {object} _options
   * @returns {Promise<void>}
   */
  static async #prepareEquipment(context, _options) {
    const budget = SYSTEM.ACTOR.STARTING_EQUIPMENT_BUDGET;
    const equipment = this._state.equipment;
    const {type: filterType, category: filterCategory} = this._state.equipmentFilter ?? {type: null, category: null};

    // Calculate spent amount
    let spent = 0;
    for ( const {scaledPrice, quantity} of Object.values(equipment) ) {
      spent += scaledPrice * quantity;
    }
    const remaining = budget - spent;

    // Build type filter options from item types present in the pack
    const seenTypes = new Map();
    for ( const {item} of this._state.equipmentItems ) {
      if ( !seenTypes.has(item.type) ) seenTypes.set(item.type, _loc(`TYPES.Item.${item.type}`));
    }
    context.filterTypes = [...seenTypes.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]) => ({id, label, active: filterType === id}));
    context.filterType = filterType;

    // Build category filter options for the selected item type
    if ( filterType && this._state.categoriesByType[filterType] ) {
      context.filterCategories = Object.entries(this._state.categoriesByType[filterType])
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, label]) => ({id, label, active: filterCategory === id}));
      context.filterCategory = filterCategory;
    }

    // Apply type and category pre-filters to the item list
    let sourceItems = this._state.equipmentItems;
    if ( filterType ) sourceItems = sourceItems.filter(e => e.item.type === filterType);
    if ( filterCategory ) sourceItems = sourceItems.filter(e => e.item.system.category === filterCategory);

    // Build the available items list with affordability state
    context.equipmentItems = sourceItems.map(({item, scaledPrice}) => ({
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      tags: Object.values(item.system.getTags()),
      scaledPrice,
      quantity: equipment[item.uuid]?.quantity ?? 0,
      unaffordable: scaledPrice > remaining && !(item.uuid in equipment)
    }));

    // Selected items for sidebar
    context.equipmentSelected = Object.values(equipment).map(({item, quantity, scaledPrice}) => ({
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      quantity,
      scaledPrice,
      totalCost: scaledPrice * quantity,
      unaffordable: scaledPrice > remaining
    }));

    context.equipmentRemaining = remaining;
  }

  /* -------------------------------------------- */

  /**
   * Initialize data for each of the available Background items which may be chosen.
   * @this CrucibleHeroCreationSheet
   * @param {string} itemType
   * @param {Set<string>} packs
   * @param {function} [fn]
   * @returns {Promise<Record<string, CrucibleHeroCreationItem>>}
   */
  static async #initializeItemOptions(itemType, packs, fn) {
    const options = {};
    await Promise.allSettled(Array.from(packs).map(async packId => {
      const pack = game.packs.get(packId);
      if ( !pack ) {
        console.warn(`Compendium pack "${packId}" does not exist as a valid compendium ID`);
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
          summary: await CONFIG.ux.TextEditor.enrichHTML(item.system.description),
          features: []
        };
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
      activeStep: this.step,
      charname: this._state.name,
      state: this._state,
      tabs: this._prepareTabs("header")
    };

    // Step-specific preparation
    await this._prepareSteps(context, options);

    // Header Buttons and Tabs
    context.buttons = this._prepareHeaderButtons();
    this._finalizeHeaderTabs(context);
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
      {action: "close", icon: "fa-light fa-hexagon-xmark", label: "ACTOR.CREATION.Exit", tooltip: "ACTOR.CREATION.ExitHint"},
      {action: "restart", icon: "fa-light fa-hexagon-exclamation", label: "ACTOR.CREATION.Restart", tooltip: "ACTOR.CREATION.RestartHint"}
    ];
    if ( Object.values(this._completed).every(v => v === true) ) {
      buttons.push({action: "complete", icon: "fa-light fa-hexagon-check", label: "ACTOR.CREATION.Complete", tooltip: "ACTOR.CREATION.CompleteHint"});
    }
    return buttons;
  }

  /* -------------------------------------------- */

  /**
   * Finalize the state of each tab on the header navigation based on creation completion state.
   * @param {object} context
   */
  _finalizeHeaderTabs(context) {
    const plurals = new Intl.PluralRules(game.i18n.lang);

    // Default icons and completion state
    for ( const tab of Object.values(context.tabs) ) {
      const step = this.constructor.STEPS[tab.id];
      const completed = !!this._completed[tab.id];
      tab.selectionIcon ||= `systems/crucible/ui/svg/hexagon-${completed ? "checkmark" : "xmark"}.svg`;
      Object.assign(tab, step, {
        completed,
        cssClass: [
          tab.active ? "active" : "",
          completed ? "complete" : "incomplete"
        ].filterJoin(" ")
      });

      // Ability Step
      if ( step.id === "abilities" ) {
        const ap = this._clone.points.ability.pool;
        const chosen = context[step.id];
        tab.selectionLabel = (ap || !chosen)
          ? `${ap} ${_loc(`TALENT.LABELS.Points.${plurals.select(ap)}`)}`
          : chosen.name;
      }

      // Talents
      if ( step.id === "talents" ) {
        const tp = this._clone.points.talent.available;
        tab.selectionLabel = tp > 0
          ? `${tp} ${_loc(`TALENT.LABELS.Talents.${plurals.select(tp)}`)}`
          : _loc("ACTOR.CREATION.Completed");
      }

      // Equipment
      if ( (step.id === "equipment") && completed ) {
        tab.selectionLabel = _loc("ACTOR.CREATION.Completed");
      }
    }
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
        group: cfg.groupInternal,
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
   * @param {object} context
   * @param {object} options
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
   * @param {object} context
   * @param {object} _options
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
    }
    else context.ancestry = null;
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for rendering on the background step.
   * @param {object} context
   * @param {object} _options
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
    const spentPoints = this._clone.points.ability.pool === 0;
    this._completed.background = (backgroundId in backgrounds) && spentPoints;
    if ( backgroundId ) {
      const b = context.background = backgrounds[backgroundId];
      if ( b.color ) t.selectionColor = b.color;
      if ( b.icon ) t.selectionIcon = b.icon;
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
    if ( this.element && (this.#characterName === null) ) this._state.name = this.element.querySelector("#hero-creation-name").value.trim();
  }

  /* -------------------------------------------- */

  /** @override */
  _canRender(_options) {
    super._canRender(_options);
    if ( !this.#complete && ((this.document.type !== "hero") || (this.document.level > 0)) ) {
      throw new Error("You may only use the CrucibleHeroCreationSheet for a hero Actor which is level zero.");
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _configureRenderParts(_options) {
    const parts = foundry.utils.deepClone(this.constructor.PARTS);
    for ( const step of Object.values(this.constructor.STEPS) ) {
      const part = {id: step.id, template: step.template};
      if ( step.scrollable ) part.scrollable = step.scrollable;
      parts[step.id] = part;
    }
    return parts;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  changeTab(...args) {
    super.changeTab(...args);
    this.element.dataset.step = this.step;
    crucible.api.audio.playClick();
    if ( (this.step === "equipment") && this._state ) this._completed.equipment = true;
    this.deactivateTalentTree().then(() => {
      this.render({parts: ["header", this.step]});
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async close(options={}) {
    if ( (options.dialog !== false) && !this.#complete ) {
      crucible.api.audio.playClick();
      const confirm = await foundry.applications.api.DialogV2.confirm({
        window: {
          title: "ACTOR.CREATION.AbandonTitle",
          icon: "fa-solid fa-circle-x"
        },
        content: _loc("ACTOR.CREATION.AbandonContent"),
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
    if ( this.step === "talents" ) await this.activateTalentTree();
    if ( options.parts?.includes("equipment") ) this.#equipmentSearch.bind(this.element);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _tearDown(options) {
    super._tearDown(options);
    this.#equipmentSearch.unbind();
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
    const actor = this._clone;
    const ancestryItem = this._state.ancestries[ancestryId].item;

    // Update the Actor clone
    await actor._applyDetailItem(ancestryItem, {type: "ancestry", local: true, notify: false});
    this._state.ancestryId = ancestryId;
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

    // Remove background
    else {
      backgroundItem = null;
      backgroundId = undefined;
    }

    // Update the Actor clone
    await actor._applyDetailItem(backgroundItem, {type: "background", local: true, notify: false, canClear: true});
    this._state.backgroundId = backgroundId;
    await this.render({parts: ["header", this.step]});
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
   * Handle click events to increase an ability score during character creation.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onAbilityIncrease(_event, target) {
    const ability = target.closest(".ability");
    crucible.api.audio.playClick();
    await this._clone.purchaseAbility(ability.dataset.ability, 1);
    await this.render({parts: [this.step, "header"]});
  }
  /* -------------------------------------------- */

  /**
   * Handle click events to decrease an ability score during character creation.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onAbilityDecrease(_event, target) {
    const ability = target.closest(".ability");
    crucible.api.audio.playClick();
    await this._clone.purchaseAbility(ability.dataset.ability, -1);
    await this.render({parts: [this.step, "header"]});
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to choose an Ancestry.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onChooseAncestry(_event, target) {
    const choice = target.closest(".option");
    this.chooseAncestry(choice.dataset.ancestryId);
    crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to choose a Background.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onChooseBackground(_event, target) {
    const choice = target.closest(".option");
    this.chooseBackground(choice.dataset.backgroundId);
    crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  /**
   * Handle search filter input for the equipment list.
   * @param {KeyboardEvent|null} _event
   * @param {string} query
   * @param {RegExp} rgx
   * @param {HTMLElement} html
   */
  static #onEquipmentSearchFilter(_event, query, rgx, html) {
    if ( !html ) return;
    for ( const entry of html.querySelectorAll(".equipment-entry") ) {
      const name = foundry.applications.ux.SearchFilter.cleanQuery(entry.dataset.itemName ?? "");
      entry.hidden = !!query && !rgx.test(name);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to filter the equipment list by item type.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onFilterEquipmentType(_event, target) {
    const filterType = target.dataset.filterType ?? null;
    this._state.equipmentFilter.type = filterType;
    this._state.equipmentFilter.category = null;
    crucible.api.audio.playClick();
    await this.render({parts: ["equipment"]});
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to filter the equipment list by item sub-category.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onFilterEquipmentCategory(_event, target) {
    const filterCategory = target.dataset.filterCategory ?? null;
    this._state.equipmentFilter.category = filterCategory;
    crucible.api.audio.playClick();
    await this.render({parts: ["equipment"]});
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to add one unit of an equipment item to the starting inventory.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onAddEquipmentItem(_event, target) {
    const uuid = target.closest("[data-uuid]").dataset.uuid;
    const found = this._state.equipmentItems.find(e => e.item.uuid === uuid);
    if ( !found ) return;
    const {item, scaledPrice} = found;
    const isExisting = uuid in this._state.equipment;

    // Require remaining budget
    const spent = Object.values(this._state.equipment).reduce((sum, e) => sum + (e.scaledPrice * e.quantity), 0);
    if ( (spent + scaledPrice) > SYSTEM.ACTOR.STARTING_EQUIPMENT_BUDGET ) {
      ui.notifications.warn(_loc("ACTOR.CREATION.EquipmentInsufficient", {name: item.name}));
      return;
    }

    // Increment quantity or add new item
    if ( isExisting ) this._state.equipment[uuid].quantity++;
    else this._state.equipment[uuid] = {item, quantity: 1, scaledPrice};
    crucible.api.audio.playClick();
    await this.render({parts: ["equipment"]});
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to remove one unit of an equipment item from the starting inventory.
   * @this {CrucibleHeroCreationSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onRemoveEquipmentItem(_event, target) {
    const uuid = target.closest("[data-uuid]").dataset.uuid;
    if ( !(uuid in this._state.equipment) ) return;
    this._state.equipment[uuid].quantity--;
    if ( this._state.equipment[uuid].quantity <= 0 ) delete this._state.equipment[uuid];
    crucible.api.audio.playClick();
    await this.render({parts: ["equipment"]});
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
        title: "ACTOR.CREATION.RestartTitle",
        icon: "fa-solid fa-hexagon-exclamation"
      },
      content: _loc("ACTOR.CREATION.RestartContent"),
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
    const creationOptions = {recursive: false, diff: false, noHook: true, characterCreation: true};
    await this._finalizeCreationData(creationData, creationOptions);

    // Update the actor and render the regular sheet
    this.#complete = true;
    await this.document.update(creationData, creationOptions);
    await this.close({dialog: false});
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
    delete creationData.ownership;
    creationData.flags.core.sheetClass = "";
    creationData.system.advancement.level = 1;

    // Grant purchased equipment items and apply remaining currency
    let spent = 0;
    for ( const {item, quantity, scaledPrice} of Object.values(this._state.equipment) ) {
      if ( quantity <= 0 ) continue;
      const itemData = this._clone._cleanItemData(item);
      itemData.system.quantity = quantity;
      creationData.items.push(itemData);
      spent += scaledPrice * quantity;
    }
    creationData.system.currency = SYSTEM.ACTOR.STARTING_EQUIPMENT_BUDGET - spent;
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
    this.#characterName = this._state.name;
    this._state = {};
    for ( const k in this._completed ) this._completed[k] = false;
    this.tabGroups.header = Object.values(this.constructor.STEPS).find(s => s.order === 1).id;
  }
}
