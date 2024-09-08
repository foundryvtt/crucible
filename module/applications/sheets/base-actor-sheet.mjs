const {api, sheets} = foundry.applications;

/**
 * A base ActorSheet built on top of ApplicationV2 and the Handlebars rendering backend.
 */
export default class CrucibleBaseActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "actor", "standard-form"],
    tag: "form",
    position: {
      width: 900,
      height: 750
    },
    actions: {
      actionUse: CrucibleBaseActorSheet.#onActionUse,
      itemCreate: CrucibleBaseActorSheet.#onItemCreate,
      itemEdit: CrucibleBaseActorSheet.#onItemEdit,
      itemEquip: CrucibleBaseActorSheet.#onItemEquip,
      itemDelete: CrucibleBaseActorSheet.#onItemDelete,
      effectCreate: CrucibleBaseActorSheet.#onEffectCreate,
      effectEdit: CrucibleBaseActorSheet.#onEffectEdit,
      effectDelete: CrucibleBaseActorSheet.#onEffectDelete
    },
    form: {
      submitOnChange: true
    },
    actor: {
      type: undefined, // Defined by subclass
    }
  };

  /** @override */
  static PARTS = {
    sidebar: {
      id: "sidebar",
      template: "systems/crucible/templates/sheets/actor/sidebar.hbs"
    },
    tabs: {
      id: "tabs",
      template: "systems/crucible/templates/sheets/actor/tabs.hbs"
    },
    body: {
      id: "body",
      template: "systems/crucible/templates/sheets/actor/body.hbs"
    },
    header: {
      id: "header",
      template: undefined  // Defined during _initializeActorSheetClass
    },
    attributes: {
      id: "attributes",
      template: undefined  // Defined during _initializeActorSheetClass
    },
    skills: {
      id: "skills",
      template: "systems/crucible/templates/sheets/actor/skills.hbs"
    },
    talents: {
      id: "talents",
      template: "systems/crucible/templates/sheets/actor/talents.hbs"
    },
    inventory: {
      id: "inventory",
      template: "systems/crucible/templates/sheets/actor/inventory.hbs"
    },
    spells: {
      id: "spells",
      template: "systems/crucible/templates/sheets/actor/spells.hbs"
    },
    biography: {
      id: "biography",
      template: undefined  // Defined during _initializeActorSheetClass
    }
  };

  /**
   * Define the structure of tabs used by this Item Sheet.
   * @type {Record<string, Record<string, ApplicationTab>>}
   */
  static TABS = {
    sheet: [
      {id: "attributes", group: "sheet", label: "ACTOR.TABS.ATTRIBUTES"},
      {id: "skills", group: "sheet", label: "ACTOR.TABS.SKILLS"},
      {id: "talents", group: "sheet", label: "ACTOR.TABS.TALENTS"},
      {id: "inventory", group: "sheet", label: "ACTOR.TABS.INVENTORY"},
      {id: "spells", group: "sheet", label: "ACTOR.TABS.SPELLS"},
      {id: "biography", group: "sheet", label: "ACTOR.TABS.BIOGRAPHY"},
    ]
  }

  /** @override */
  tabGroups = {
    sheet: "attributes"
  };

  /* -------------------------------------------- */

  /**
   * A method which can be called by subclasses in a static initialization block to refine configuration options at the
   * class level.
   */
  static _initializeActorSheetClass() {
    const actor = this.DEFAULT_OPTIONS.actor;
    this.PARTS = foundry.utils.deepClone(this.PARTS);
    this.PARTS.header.template = `systems/crucible/templates/sheets/actor/${actor.type}-header.hbs`;
    this.PARTS.attributes.template = `systems/crucible/templates/sheets/actor/${actor.type}-attributes.hbs`;
    this.PARTS.biography.template = `systems/crucible/templates/sheets/actor/${actor.type}-biography.hbs`;
    this.TABS = foundry.utils.deepClone(this.TABS);
    this.DEFAULT_OPTIONS.classes = [actor.type];
  }

  /* -------------------------------------------- */
  /*  Sheet Rendering                             */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const tabGroups = this.#getTabs();
    const {inventory, talents} = this.#prepareItems();
    return {
      abilityScores: this.#prepareAbilities(),
      actions: this.#prepareAvailableActions(),
      actor: this.document,
      biography: await this.#prepareBiography(),
      defenses: this.#prepareDefenses(),
      effects: this.#prepareActiveEffects(),
      featuredEquipment: this.#prepareFeaturedEquipment(),
      fieldDisabled: this.isEditable ? "" : "disabled",
      fields: this.document.system.schema.fields,
      incomplete: {},
      inventory,
      isEditable: this.isEditable,
      resistances: this.#prepareResistances(),
      resources: this.#prepareResources(),
      skillCategories: this.#prepareSkills(),
      source: this.document.toObject(),
      spells: this.#prepareSpells(),
      tabGroups,
      tabs: tabGroups.sheet,
      talents
    };
  }

  /* -------------------------------------------- */

  /**
   * Configure the tabs used by this sheet.
   * @returns {Record<string, Record<string, ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {};
    for ( const [groupId, config] of Object.entries(this.constructor.TABS) ) {
      const group = {};
      for ( const t of config ) {
        const active = this.tabGroups[t.group] === t.id;
        const icon = `systems/crucible/ui/tabs/${t.id}.webp`;
        group[t.id] = Object.assign({active, cssClass: active ? "active" : "", icon}, t);
      }
      tabs[groupId] = group;
    }
    return tabs;
  }

  /* -------------------------------------------- */

  /**
   * Prepare formatted ability scores for display on the Actor sheet.
   * @return {object[]}
   */
  #prepareAbilities() {
    const a = this.actor.system.abilities;
    const abilities = Object.values(SYSTEM.ABILITIES).map(cfg => {
      const ability = foundry.utils.deepClone(cfg);
      ability.value = a[ability.id].value;
      if ( this.actor.points ) {
        ability.canIncrease = this.actor.canPurchaseAbility(ability.id, 1);
        ability.canDecrease = this.actor.canPurchaseAbility(ability.id, -1);
      }
      return ability;
    });
    abilities.sort((a, b) => a.sheetOrder - b.sheetOrder);
    return abilities;
  }

  /* -------------------------------------------- */

  /**
   * Prepare enriched biography HTML for the actor.
   * @returns {Promise<{private: string, public: string}>}
   */
  async #prepareBiography() {
    const biography = this.document.system.details.biography;
    const context = {relativeTo: this.document, secrets: this.document.isOwner};
    return {
      appearance: await TextEditor.enrichHTML(biography.appearance, context),
      public: await TextEditor.enrichHTML(biography.public, context),
      private: await TextEditor.enrichHTML(biography.private, context)
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare and structure data used to render defenses.
   * @returns {Record<string, object>}
   */
  #prepareDefenses() {
    const data = this.document.system.defenses;

    // Physical defenses
    const defenses = {
      physical: {
        value: data.physical.total,
        label: SYSTEM.DEFENSES.physical.label,
        subtitle: this.actor.equipment.armor.name,
        components: {
          armor: {
            value: data.armor.total,
            label: SYSTEM.DEFENSES.armor.label,
            pct: Math.round(data.armor.total * 100 / data.physical.total),
            cssClass: data.armor.total > 0 ? "active" : "inactive",
            separator: "="
          },
          dodge: {
            value: data.dodge.total,
            label: SYSTEM.DEFENSES.dodge.label,
            pct: Math.round(data.dodge.total * 100 / data.physical.total),
            cssClass: data.dodge.total > 0 ? "active" : "inactive",
            separator: "+"
          },
          parry: {
            value: data.parry.total,
            label: SYSTEM.DEFENSES.parry.label,
            pct: Math.round(data.parry.total * 100 / data.physical.total),
            cssClass: data.parry.total > 0 ? "active" : "inactive",
            separator: "+"
          },
          block: {
            value: data.block.total,
            label: SYSTEM.DEFENSES.block.label,
            pct: Math.round(data.block.total * 100 / data.physical.total),
            cssClass: data.block.total > 0 ? "active" : "inactive",
            separator: "+"
          }
        }
      },
    };

    // Non-physical defenses
    for ( const [id, defense] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( defense.type === "physical" ) continue;
      const d = foundry.utils.mergeObject(defense, data[id], {inplace: false});
      d.id = id;
      if ( d.bonus !== 0 ) {
        const sign = d.bonus > 0 ? "+" : "-";
        d.tooltip += ` ${sign} ${Math.abs(d.bonus)}`;
      }
      if ( ["wounds", "madness"].includes(id) ) d.tooltip = `${d.label}<br>${d.tooltip}`;
      defenses[id] = d;
    }
    return defenses;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the items of equipment which are showcased at the top of the sidebar.
   * @returns {{name: string, img: string, tag: string[]}[]}
   */
  #prepareFeaturedEquipment() {
    const featuredEquipment = [];
    const {armor, weapons} = this.actor.equipment;
    const {mainhand: mh, offhand: oh, twoHanded: th} = weapons;
    featuredEquipment.push({name: mh.name, img: mh.img, tag: [mh.getTags().damage]});
    if ( oh?.id && !th ) featuredEquipment.push({name: oh.name, img: oh.img, tag: [oh.getTags().damage]})
    featuredEquipment.push({name: armor.name, img: armor.img, tag: armor.getTags().armor});
    return featuredEquipment;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering data for items owned by the Actor.
   */
  #prepareItems() {
    const sections = {
      talents: {
        signature: {label: "Signature Talents", items: []},
        active: {label: "Active Abilities", items: []},
        passive: {label: "Passive Talents", items: []},
        spell: {label: "Spellcraft Talents", items: []}
      },
      inventory: {
        equipment: {label: "Equipment", items: [], empty: game.i18n.localize("ACTOR.LABELS.EQUIPMENT_HINT")},
        backpack: {label: "Backpack", items: [], empty: game.i18n.localize("ACTOR.LABELS.BACKPACK_HINT")}
      }
    };

    // Iterate over items and organize them
    for ( let i of this.document.items ) {
      const d = {id: i.id, name: i.name, img: i.img, tags: i.getTags()};
      let section;
      switch(i.type) {
        case "armor":
        case "weapon":
          Object.assign(d, {
            quantity: i.system.quantity,
            showStack: i.system?.quantity && (i.system.quantity !== 1),
            cssClass: i.system.equipped ? "equipped" : "unequipped"
          })
          if ( i.system.equipped ) section = sections.inventory.equipment;
          else section = sections.inventory.backpack;
          break;
        case "talent":
          d.tier = i.system.node?.tier || 0;
          const action = i.actions.at(0);
          const spellComp = i.system.rune || i.system.gesture || i.system.inflection;
          if ( i.system.isSignature ) section = sections.talents.signature;
          if ( action ) {
            const tags = action.getTags();
            d.tags = Object.assign({}, tags.action, tags.activation);
            section ||= sections.talents.active;
          }
          else if ( spellComp ) section ||= sections.talents.spell;
          else section ||= sections.talents.passive;
          break;
      }
      if ( section ) section.items.push(d);
    }

    // Sort inventory
    for ( const heading of Object.values(sections.inventory) ) {
      heading.items.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Sort talents
    for ( const [id, heading] of Object.entries(sections.talents) ) {
      if ( !heading.items.length ) delete sections.talents[id];
      heading.items.sort((a, b) => (a.tier - b.tier) || a.name.localeCompare(b.name));
    }
    return sections;
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for the set of actions that are displayed on the Available Actions portion of the sheet.
   * @returns {{img: *, name: *, id: *, totalCost, tags: *}[]}
   */
  #prepareAvailableActions() {
    const combatant = game.combat?.getCombatantByActor(this.actor);
    const actions = [];
    for ( const action of Object.values(this.actor.actions) ) {
      if ( !action._displayOnSheet(combatant) ) continue;
      const tags = action.getTags().activation;
      actions.push({
        id: action.id,
        name: action.name,
        img: action.img,
        tags,
        totalCost: action.cost.action + action.cost.focus
      });
    }
    actions.sort((a, b) => (a.totalCost - b.totalCost) || (a.name.localeCompare(b.name)));
    return actions;
  }

  /* -------------------------------------------- */

  /**
   * Format ActiveEffect data required for rendering the sheet
   * @returns {object[]}
   */
  #prepareActiveEffects() {
    return this.actor.effects.map(effect => {
      const {startRound, rounds, turns} = effect.duration;
      const elapsed = game.combat ? game.combat.round - startRound : 0;
      const tags = {};

      // Turn-based duration
      if ( Number.isFinite(turns) ) {
        const remaining = turns - elapsed;
        tags.duration = `${remaining} ${remaining === 1 ? "Turn" : "Turns"}`;
      }

      // Round-based duration
      else if ( Number.isFinite(rounds) ) {
        const remaining = rounds - elapsed + 1;
        tags.duration = `${remaining} ${remaining === 1 ? "Round" : "Rounds"}`;
      }

      // Infinite duration
      else tags.duration = "∞";
      return {
        id: effect.id,
        icon: effect.icon,
        label: effect.name,
        tags: tags
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Format categories of the spells tab.
   * @returns {{
   *  runes: {label: string, known: Set<CrucibleRune>},
   *  inflections: {label: string, known: Set<CrucibleInflection>},
   *  gestures: {label: string, known: Set<CrucibleGesture>}
   * }}
   */
  #prepareSpells() {
    const spells = {
      runes: {label: game.i18n.localize("SPELL.ComponentRunePl")},
      gestures: {label: game.i18n.localize("SPELL.ComponentGesturePl")},
      inflections: {label: game.i18n.localize("SPELL.ComponentInflectionPl")},
      signature: {label: game.i18n.localize("SPELL.SignaturePl")},
    }
    for ( const [k, v] of Object.entries(this.actor.grimoire) ) spells[k].known = v;
    return spells;
  }

  /* -------------------------------------------- */

  /**
   * Prepare and format resistance data for rendering.
   * @return {{physical: object[], elemental: object[], spiritual: object[]}}
   */
  #prepareResistances() {
    const resistances = foundry.utils.deepClone(SYSTEM.DAMAGE_CATEGORIES);
    for ( const c of Object.values(resistances) ) c.resistances = [];
    const rs = this.document.system.resistances;
    const barCap = this.document.level * 2;
    for ( const [id, d] of Object.entries(SYSTEM.DAMAGE_TYPES) ) {
      const r = Object.assign({}, d, rs[id]);
      r.cssClass = r.total < 0 ? "vuln" : (r.total > 0 ? "res" : "none");
      const p = Math.min(Math.abs(r.total) / barCap, 1);
      r.barPct = `${p * 50}%`;
      resistances[d.type].resistances.push(r);
    }
    return resistances;
  }

  /* -------------------------------------------- */

  /**
   * Prepare and format the display of resource attributes on the actor sheet.
   * @returns {Record<string, {id: string, pct: number, color: {bg: string, fill: string}}>}
   */
  #prepareResources() {
    const resources = {};
    const rs = this.document.system.resources;

    // Pools
    for ( const [id, resource] of Object.entries(rs) ) {
      const r = foundry.utils.mergeObject(SYSTEM.RESOURCES[id], resource, {inplace: false});
      r.id = id;
      r.pct = Math.round(r.value * 100 / r.max);
      r.cssPct = `--resource-pct: ${100 - r.pct}%`;
      resources[r.id] = r;
    }

    // Action
    resources.action.pips = [];
    const maxAction = Math.min(resources.action.max, 6);
    for ( let i=1; i<=maxAction; i++ ) {
      const full = resources.action.value >= i;
      const double = (resources.action.value - 6) >= i;
      const cssClass = [full ? "full" : "", double ? "double" : ""].filterJoin(" ");
      resources.action.pips.push({full, double, cssClass});
    }

    // Focus
    resources.focus.pips = [];
    const maxFocus = Math.min(resources.focus.max, 12);
    for ( let i=1; i<=maxFocus; i++ ) {
      const full = resources.focus.value >= i;
      const double = (resources.focus.value - 12) >= i;
      const cssClass = [full ? "full" : "", double ? "double" : ""].filterJoin(" ");
      resources.focus.pips.push({full, double, cssClass});
    }

    // Heroism
    resources.heroism.pips = [];
    for ( let i=1; i<=3; i++ ) {
      const full = resources.heroism.value >= i;
      const cssClass = full ? "full" : "";
      resources.heroism.pips.push({full, double: false, cssClass});
    }
    return resources;
  }

  /* -------------------------------------------- */

  /**
   * Organize skills by category in alphabetical order.
   * @return {Record<string, {
   *   label: string,
   *   defaultIcon: string,
   *   color: Color,
   *   abilityAbbrs: [string, string],
   *   pips: [string, string, string, string, string],
   *   css: string,
   *   canIncrease: boolean,
   *   canDecrease: boolean,
   *   rankName: string,
   *   pathName: string,
   *   tooltips: {value: string, passive: string},
   * }>}
   */
  #prepareSkills() {
    const skills = this.document.system.skills;
    const categories = foundry.utils.deepClone(SYSTEM.SKILL.CATEGORIES);
    for ( const skill of Object.values(SYSTEM.SKILLS) ) {
      const s = foundry.utils.mergeObject(skill, skills[skill.id], {inplace: false});
      const category = categories[skill.category];
      const a1 = SYSTEM.ABILITIES[skill.abilities[0]];
      const a2 = SYSTEM.ABILITIES[skill.abilities[1]];

      // Skill data
      s.abilityAbbrs = [a1.abbreviation, a2.abbreviation];
      s.pips = Array.fromRange(5).map((v, i) => i < s.rank ? "trained" : "untrained");
      s.css = [
        s.rank > 0 ? "trained" : "untrained",
        s.path ? "specialized" : "unspecialized"
      ].join(" ");
      s.canIncrease = this.actor.canPurchaseSkill(skill.id, 1);
      s.canDecrease = this.actor.canPurchaseSkill(skill.id, -1);

      // Specialization status
      s.rankTags = [SYSTEM.SKILL.RANKS[s.rank].label];
      const path = skill.paths[s.path] || null;
      if ( path ) s.rankTags.push(path.name);
      s.hexClass = skill.abilities.sort().join("-");

      // Tooltips
      s.tooltips = {
        value: game.i18n.format("SKILL.TooltipCheck", {a1: a1.label, a2: a2.label}),
        passive: game.i18n.localize("SKILL.TooltipPassive")
      }

      // Add to category
      category.skills ||= {};
      category.skills[skill.id] = s;
    }
    return categories;
  }

  /* -------------------------------------------- */
  /*  Action Event Handlers                       */
  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onActionUse(event) {
    const actionId = event.target.closest(".action").dataset.actionId;
    await this.actor.useAction(actionId);
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onItemCreate(event) {
    const cls = getDocumentClass("Item");
    await cls.createDialog({type: "weapon"}, {parent: this.document, pack: this.document.pack});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onItemDelete(event) {
    const item = this.#getEventItem(event);
    await item.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onItemEdit(event) {
    const item = this.#getEventItem(event);
    await item.sheet.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onItemEquip(event) {
    const item = this.#getEventItem(event);
    switch ( item.type ) {
      case "armor":
        try {
          await this.actor.equipArmor(item.id, {equipped: !item.system.equipped});
        } catch(err) {
          ui.notifications.warn(err.message);
        }
        break;
      case "weapon":
        try {
          await this.actor.equipWeapon(item.id, {equipped: !item.system.equipped});
        } catch(err) {
          ui.notifications.warn(err.message);
        }
        break;
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the Item document associated with an action event.
   * @param {PointerEvent} event
   * @returns {CrucibleItem}
   */
  #getEventItem(event) {
    const itemId = event.target.closest(".line-item")?.dataset.itemId;
    return this.actor.items.get(itemId, {strict: true});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEffectCreate(event) {
    const cls = getDocumentClass("ActiveEffect");
    await cls.createDialog({}, {parent: this.document, pack: this.document.pack});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEffectDelete(event) {
    const effect = this.#getEventEffect(event);
    await effect.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEffectEdit(event) {
    const effect = this.#getEventEffect(event);
    await effect.sheet.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * Get the ActiveEffect document associated with an action event.
   * @param {PointerEvent} event
   * @returns {ActiveEffect}
   */
  #getEventEffect(event) {
    const effectId = event.target.closest(".active-effect")?.dataset.effectId;
    return this.actor.effects.get(effectId, {strict: true});
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /*  TODO: Remove this entire section once V13
  /*  TODO: Keep the Action -> macro part of _onDragStart
  /* -------------------------------------------- */

  /** @override */
  _onRender(_context, _options) {
    if ( !game.user.isGM ) return;
    new DragDrop({
      dragSelector: '.draggable',
      dropSelector: null,
      callbacks: {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this)
      }
    }).bind(this.element);
  }

  /**
   * An event that occurs when a drag workflow begins for a draggable item on the sheet.
   * @param {DragEvent} event       The initiating drag start event
   * @returns {Promise<void>}
   * @protected
   */
  async _onDragStart(event) {
    const li = event.currentTarget;
    if ( "link" in event.target.dataset ) return;
    let dragData;

    // Owned Items
    if ( li.dataset.itemId ) {
      const item = this.actor.items.get(li.dataset.itemId);
      dragData = item.toDragData();
    }

    // Active Effect
    if ( li.dataset.effectId ) {
      const effect = this.actor.effects.get(li.dataset.effectId);
      dragData = effect.toDragData();
    }

    // Action
    if ( li.classList.contains("action-drag") ) {
      const actionId = li.closest(".action").dataset.actionId;
      const action = this.actor.actions[actionId];
      if ( !action ) return;
      dragData = {
        type: "crucible.action",
        macroData: {
          type: "script",
          scope: "actor",
          name: action.name,
          img: action.img,
          command: `game.system.api.documents.CrucibleActor.macroAction(actor, "${actionId}");`
        }
      };
    }

    // Set data transfer
    if ( !dragData ) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /* -------------------------------------------- */

  /**
   * An event that occurs when a drag workflow moves over a drop target.
   * @param {DragEvent} event
   * @protected
   */
  _onDragOver(event) {}

  /* -------------------------------------------- */

  /**
   * An event that occurs when data is dropped into a drop target.
   * @param {DragEvent} event
   * @returns {Promise<void>}
   * @protected
   */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const actor = this.actor;
    const allowed = Hooks.call("dropActorSheetData", actor, this, data);
    if ( allowed === false ) return;

    // Dropped Documents
    const documentClass = getDocumentClass(data.type);
    if ( documentClass ) {
      const document = await documentClass.fromDropData(data);
      await this._onDropDocument(event, document);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle a dropped document on the ActorSheet
   * @param {DragEvent} event         The initiating drop event
   * @param {Document} document       The resolved Document class
   * @returns {Promise<void>}
   * @protected
   */
  async _onDropDocument(event, document) {
    switch ( document.documentName ) {
      case "ActiveEffect":
        return this._onDropActiveEffect(event, /** @type ActiveEffect */ document);
      case "Actor":
        return this._onDropActor(event, /** @type Actor */ document);
      case "Item":
        return this._onDropItem(event, /** @type Item */ document);
      case "Folder":
        return this._onDropFolder(event, /** @type Folder */ document);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle a dropped Active Effect on the Actor Sheet.
   * The default implementation creates an Active Effect embedded document on the Actor.
   * @param {DragEvent} event       The initiating drop event
   * @param {ActiveEffect} effect   The dropped ActiveEffect document
   * @returns {Promise<void>}
   * @protected
   */
  async _onDropActiveEffect(event, effect) {
    if ( !this.actor.isOwner ) return;
    if ( !effect || (effect.target === this.actor) ) return;
    const keepId = !this.actor.effects.has(item.id);
    await ActiveEffect.create(effect.toObject(), {parent: this.actor, keepId});
  }

  /* -------------------------------------------- */

  /**
   * Handle a dropped Actor on the Actor Sheet.
   * @param {DragEvent} event     The initiating drop event
   * @param {Actor} actor         The dropped Actor document
   * @returns {Promise<void>}
   * @protected
   */
  async _onDropActor(event, actor) {}

  /* -------------------------------------------- */

  /**
   * Handle a dropped Item on the Actor Sheet.
   * @param {DragEvent} event     The initiating drop event
   * @param {Item} item           The dropped Item document
   * @returns {Promise<void>}
   * @protected
   */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return;
    if ( this.actor.uuid === item.parent?.uuid ) return this._onSortItem(event, item);
    const keepId = !this.actor.items.has(item.id);
    await Item.create(item.toObject(), {parent: this.actor, keepId});
  }

  /* -------------------------------------------- */

  /**
   * Handle a dropped Folder on the Actor Sheet.
   * @param {DragEvent} event     The initiating drop event
   * @param {object} data         Extracted drag transfer data
   * @returns {Promise<void>}
   * @protected
   */
  async _onDropFolder(event, data) {}

  /* -------------------------------------------- */

  /**
   * Handle a drop event for an existing embedded Item to sort that Item relative to its siblings.
   * @param {DragEvent} event     The initiating drop event
   * @param {Item} item           The dropped Item document
   * @protected
   */
  _onSortItem(event, item) {
    const items = this.actor.items;
    const source = items.get(item.id);

    // Confirm the drop target
    const dropTarget = event.target.closest("[data-item-id]");
    if ( !dropTarget ) return;
    const target = items.get(dropTarget.dataset.itemId);
    if ( source.id === target.id ) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for ( let el of dropTarget.parentElement.children ) {
      const siblingId = el.dataset.itemId;
      if ( siblingId && (siblingId !== source.id) ) siblings.push(items.get(el.dataset.itemId));
    }

    // Perform the sort
    const sortUpdates = SortingHelpers.performIntegerSort(source, {target, siblings});
    const updateData = sortUpdates.map(u => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.actor.updateEmbeddedDocuments("Item", updateData);
  }
}
