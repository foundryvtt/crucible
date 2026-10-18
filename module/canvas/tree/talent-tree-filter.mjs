import CrucibleTalentNode from "../../const/talent-node.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {SearchFilter} = foundry.applications.ux;

/**
 * A HUD which searches and filters the talent tree, highlighting the nodes and Talents that match.
 */
export default class CrucibleTalentTreeFilter extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "crucible-talent-filter",
    tag: "form",
    window: {
      frame: false,
      positioned: false
    },
    classes: ["crucible", "standard-form", "themed", "theme-dark"],
    form: {
      handler: this.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      clear: this.#onClear
    }
  };

  /** @override */
  static PARTS = {
    filter: {
      template: "systems/crucible/templates/hud/talent-tree-filter.hbs"
    }
  };

  /**
   * The ephemeral schema of filter fields, localized on first access.
   * @type {foundry.data.fields.SchemaField}
   */
  static get schema() {
    if ( this.#schema ) return this.#schema;
    const {SchemaField, SetField, StringField, NumberField} = foundry.data.fields;
    const maxLevel = Math.max(...Object.values(SYSTEM.TALENT.NODE_TIERS).map(t => t.level));
    const level = {required: true, nullable: true, integer: true, min: 0, max: maxLevel, initial: null};
    this.#schema = new SchemaField({
      query: new StringField({required: true, blank: true}),
      levels: new SchemaField({
        min: new NumberField(level),
        max: new NumberField(level)
      }),
      ability: new StringField({required: true, blank: true, choices: SYSTEM.ABILITIES}),
      training: new SetField(new StringField({required: true, blank: false, choices: () => {
        return Object.entries(SYSTEM.PROFICIENCIES).reduce((obj, [id, {label, group}]) => {
          obj[id] = {label, group: SYSTEM.PROFICIENCY.GROUPS[group]?.label};
          return obj;
        }, {});
      }})),
      keywords: new SetField(new StringField({required: true, blank: false, choices: SYSTEM.TALENT.KEYWORDS}))
    });
    foundry.helpers.Localization.localizeSchema(this.#schema, ["TALENT.FILTER"]);
    return this.#schema;
  }

  static #schema;

  /* -------------------------------------------- */

  /**
   * The current filter values.
   * @type {object}
   */
  #filters = this.constructor.schema.getInitialValue({});

  /**
   * The current filter matches, or null when no filter is active.
   * @type {Map<CrucibleTalentNode, Set<string>>|null}
   */
  #matches = null;

  /**
   * A debounced controller for the text search input.
   * @type {SearchFilter}
   */
  #search = new SearchFilter({
    inputSelector: "input[name=query]",
    callback: () => this.submit()
  });

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(_options) {
    const fields = this.constructor.schema.fields;
    const keywordGroups = crucible.api.models.CrucibleTalentItem.keywordGroups;
    return {fields, filters: this.#filters, keywordGroups, matches: this.#getMatchesLabel()};
  }

  /* -------------------------------------------- */

  /** @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if ( existing ) existing.replaceWith(element);
    else crucible.tree.canvas.insertAdjacentElement("afterend", element);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.element.setAttribute("role", "search");
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#search.bind(this.element);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options) {
    super._onClose(options);
    this.#reset();
  }

  /* -------------------------------------------- */

  /**
   * Format the count of matching Talents and nodes.
   * @returns {string}
   */
  #getMatchesLabel() {
    if ( !this.#matches ) return "";
    const talents = new Set();
    for ( const ids of this.#matches.values() ) ids.forEach(id => talents.add(id));
    return _loc("TALENT.FILTER.Matches", {talents: talents.size, nodes: this.#matches.size});
  }

  /* -------------------------------------------- */
  /*  Filtering                                   */
  /* -------------------------------------------- */

  /**
   * Identify the Talents on each drawn node which satisfy every active filter.
   * @returns {Map<CrucibleTalentNode, Set<string>>|null}   Matching Talent ids by node, or null if no filter is active
   */
  #match() {
    const {query, levels, ability, training, keywords} = this.#filters;
    const isActive = query || (levels.min !== null) || (levels.max !== null) || ability || training.length
      || keywords.length;
    if ( !isActive ) return null;
    const rgx = query ? new RegExp(RegExp.escape(query), "i") : null;
    const actor = crucible.tree.actor;
    const matches = new Map();
    for ( const node of CrucibleTalentNode.nodes.values() ) {
      if ( !node.icon || !this.#testNode(node) ) continue;
      const owned = Array.from(actor.system.talentNodes[node.id] ?? [], id => actor.items.get(id)).filter(Boolean);
      const ids = new Set();
      for ( const talent of [...node.talents, ...owned] ) {
        if ( this.#testTalent(talent, rgx) ) ids.add(talent.id);
      }
      if ( ids.size ) matches.set(node, ids);
    }
    return matches;
  }

  /* -------------------------------------------- */

  /**
   * Test a node against the level and ability filters.
   * @param {CrucibleTalentNode} node
   * @returns {boolean}
   */
  #testNode(node) {
    const {levels, ability} = this.#filters;
    const level = SYSTEM.TALENT.NODE_TIERS[node.tier].level;
    if ( (levels.min !== null) && (level < levels.min) ) return false;
    if ( (levels.max !== null) && (level > levels.max) ) return false;
    return !ability || node.abilities.has(ability);
  }

  /* -------------------------------------------- */

  /**
   * Test a Talent against the search, proficiency, and keyword filters.
   * @param {CrucibleItem} talent
   * @param {RegExp|null} rgx       The search pattern, if any
   * @returns {boolean}
   */
  #testTalent(talent, rgx) {
    const {training, keywords} = this.#filters;
    if ( rgx ) {
      const test = name => SearchFilter.testQuery(rgx, name);
      if ( !test(talent.name) && !talent.actions.some(a => test(a.name)) ) return false;
    }
    if ( training.length && !training.includes(talent.system.training) ) return false;
    return keywords.every(k => talent.system.keywords.has(k));
  }

  /* -------------------------------------------- */

  /**
   * Recompute matches, apply them to the tree, and update the displayed count.
   */
  #refreshMatches() {
    this.#matches = this.#match();
    crucible.tree.setHighlights(this.#matches);
    const label = this.element?.querySelector(".matches");
    if ( label ) label.textContent = this.#getMatchesLabel();
  }

  /* -------------------------------------------- */

  /**
   * Restore all filters to their initial empty state and clear highlights from the tree.
   */
  #reset() {
    this.#filters = this.constructor.schema.getInitialValue({});
    this.#matches = null;
    this.#search.unbind();
    crucible.tree.setHighlights(null);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Clear all filters.
   * @this {CrucibleTalentTreeFilter}
   * @type {ApplicationClickAction}
   */
  static async #onClear() {
    this.#reset();
    await this.render();
  }

  /* -------------------------------------------- */

  /**
   * Update filters from the submitted form.
   * @this {CrucibleTalentTreeFilter}
   * @type {ApplicationFormSubmission}
   */
  static async #onSubmit(_event, _form, formData) {
    const filters = this.constructor.schema.clean(foundry.utils.expandObject(formData.object));
    filters.query = SearchFilter.cleanQuery(filters.query);
    this.#filters = filters;
    this.#refreshMatches();
  }
}
