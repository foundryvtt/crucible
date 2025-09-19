const {api, sheets} = foundry.applications;

/**
 * A base ActorSheet built on top of ApplicationV2 and the Handlebars rendering backend.
 */
export default class CrucibleBaseActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "actor", "standard-form", "themed", "theme-dark"],
    tag: "form",
    position: {
      width: 900,
      height: 760
    },
    actions: {
      actionFavorite: CrucibleBaseActorSheet.#onActionFavorite,
      actionEdit: CrucibleBaseActorSheet.#onActionEdit,
      actionUse: CrucibleBaseActorSheet.#onActionUse,
      itemCreate: CrucibleBaseActorSheet.#onItemCreate,
      itemDrop: CrucibleBaseActorSheet.#onItemDrop,
      itemEdit: CrucibleBaseActorSheet.#onItemEdit,
      itemEquip: CrucibleBaseActorSheet.#onItemEquip,
      itemDelete: CrucibleBaseActorSheet.#onItemDelete,
      effectCreate: CrucibleBaseActorSheet.#onEffectCreate,
      effectEdit: CrucibleBaseActorSheet.#onEffectEdit,
      effectDelete: CrucibleBaseActorSheet.#onEffectDelete,
      effectToggle: CrucibleBaseActorSheet.#onEffectToggle,
      expandSection: CrucibleBaseActorSheet.#onExpandSection,
      skillRoll: CrucibleBaseActorSheet.#onSkillRoll
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
    main: {
      id: "main",
      template: "systems/crucible/templates/sheets/actor/main.hbs",
      root: true
    },
    sidebar: {
      id: "sidebar",
      template: "systems/crucible/templates/sheets/actor/sidebar.hbs"
    },
    tabs: {
      id: "tabs",
      template: "systems/crucible/templates/sheets/actor/tabs.hbs"
    },
    header: {
      id: "header",
      template: undefined  // Defined during _initializeActorSheetClass
    },
    attributes: {
      id: "attributes",
      template: undefined  // Defined during _initializeActorSheetClass
    },
    actions:{
      id: "actions",
      template: "systems/crucible/templates/sheets/actor/actions.hbs"
    },
    inventory: {
      id: "inventory",
      template: "systems/crucible/templates/sheets/actor/inventory.hbs"
    },
    skills: {
      id: "skills",
      template: "systems/crucible/templates/sheets/actor/skills.hbs"
    },
    talents: {
      id: "talents",
      template: "systems/crucible/templates/sheets/actor/talents.hbs"
    },
    spells: {
      id: "spells",
      template: "systems/crucible/templates/sheets/actor/spells.hbs"
    },
    effects:{
      id: "effects",
      template: "systems/crucible/templates/sheets/actor/effects.hbs"
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
      {id: "actions", group: "sheet", label: "ACTOR.TABS.ACTIONS"},
      {id: "inventory", group: "sheet", label: "ACTOR.TABS.INVENTORY"},
      {id: "talents", group: "sheet", label: "ACTOR.TABS.TALENTS"},
      {id: "skills", group: "sheet", label: "ACTOR.TABS.SKILLS"},
      {id: "spells", group: "sheet", label: "ACTOR.TABS.SPELLS"},
      {id: "effects", group: "sheet", label: "ACTOR.TABS.EFFECTS"},
      {id: "biography", group: "sheet", label: "ACTOR.TABS.BIOGRAPHY"}
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
    const {inventory, talents, iconicSpells} = this.#prepareItems();
    const {sections: actions, favorites: favoriteActions} = this.#prepareActions();
    return {
      abilityScores: this.#prepareAbilities(),
      actions,
      actor: this.document,
      biography: await this.#prepareBiography(),
      canPurchaseTalents: true,
      defenses: this.#prepareDefenses(),
      effects: this.#prepareActiveEffects(),
      favoriteActions,
      featuredEquipment: this.#prepareFeaturedEquipment(),
      fieldDisabled: this.isEditable ? "" : "disabled",
      fields: this.document.system.schema.fields,
      incomplete: {},
      inventory,
      isEditable: this.isEditable,
      languages: this.#prepareLanguageOptions(),
      resistances: this.#prepareResistances(),
      resources: this.#prepareResources(),
      skillCategories: this.#prepareSkills(),
      source: this.document.toObject(),
      spells: this.#prepareSpells(iconicSpells),
      tabGroups,
      tabs: tabGroups.sheet,
      talents
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _attachFrameListeners() {
    super._attachFrameListeners();
    this.element.addEventListener("focusin", this.#onFocusIn.bind(this));
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
      ability.canIncrease = this.actor.canPurchaseAbility(ability.id, 1);
      ability.canDecrease = this.actor.canPurchaseAbility(ability.id, -1);
      return ability;
    });
    abilities.sort((a, b) => a.sheetOrder - b.sheetOrder);
    return abilities;
  }

  /* -------------------------------------------- */

  /**
   * Prepare enriched biography HTML for the actor.
   * @returns {Promise<{object}>}
   */
  async #prepareBiography() {
    const fields = this.document.system.schema.fields.details.fields.biography.fields;
    const {appearance: appearanceSrc, public: publicSrc, private: privateSrc} = this.document.system.details.biography;
    const context = {relativeTo: this.document, secrets: this.document.isOwner};
    const editorCls = CONFIG.ux.TextEditor;
    return {
      appearanceField: fields.appearance,
      appearanceSrc,
      appearanceHTML: await editorCls.enrichHTML(appearanceSrc, context),
      appearanceClass: appearanceSrc ? "appearance" : "appearance empty",
      publicField: fields.public,
      publicSrc,
      publicHTML: await editorCls.enrichHTML(publicSrc, context),
      publicClass: publicSrc ? "public-biography" : "public-biography empty",
      privateField: fields.private,
      privateSrc,
      privateHTML: await editorCls.enrichHTML(privateSrc, context),
      privateClass: privateSrc ? "private-biography" : "private-biography empty"
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
   * @returns {{name: string, img: string, tags: string[]}[]}
   */
  #prepareFeaturedEquipment() {
    const featuredEquipment = [];
    const {armor, weapons} = this.actor.equipment;
    const {mainhand: mh, offhand: oh, natural} = weapons;

    // Up to three weapons
    if ( mh ) {
      const mhTags = mh.getTags("short");
      featuredEquipment.push({name: mh.name, img: mh.img, tags: [mhTags.damage, mhTags.range]});
    }
    if ( oh?.id ) {
      const ohTags = oh.getTags("short");
      featuredEquipment.push({name: oh.name, img: oh.img, tags: [ohTags.damage, ohTags.range]})
    }
    if ( natural.length ) {
      for ( let i=0; i<3-featuredEquipment.length; i++ ) {
        const n = natural[i];
        if ( n ) {
          const tags = n.getTags("short");
          featuredEquipment.push({name: n.name, img: n.img, tags: [tags.damage, tags.range]});
        }
      }
    }

    // Equipped Armor
    if ( armor.id || (this.actor.system.usesEquipment !== false) ) {
      const armorTags = armor.getTags();
      featuredEquipment.push({name: armor.name, img: armor.img, tags: [armorTags.armor, armorTags.dodge]});
    }
    return featuredEquipment;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering data for items owned by the Actor.
   */
  #prepareItems() {
    const {accessorySlots, consumableSlots} = this.actor.equipment;
    const sections = {
      talents: {
        signature: {label: "Signature Talents", items: []},
        active: {label: "Active Abilities", items: []},
        passive: {label: "Passive Talents", items: []},
        training: {label: "Training Talents", items: []},
        spell: {label: "Spellcraft Talents", items: []}
      },
      inventory: {
        weapon: {label: "Weapons", items: [], empty: game.i18n.localize("ACTOR.LABELS.WEAPONS_HINT")},
        armor: {label: "Armor", items: [], empty: game.i18n.localize("ACTOR.LABELS.ARMOR_HINT")},
        accessory: {label: "Accessories", items: [], counter: accessorySlots, empty: game.i18n.format("ACTOR.LABELS.ACCESSORIES_HINT", {slots: accessorySlots})},
        consumable: {label: "Consumables", items: [], counter: consumableSlots, empty: game.i18n.format("ACTOR.LABELS.CONSUMABLES_HINT", {slots: consumableSlots})},
        backpack: {label: "Backpack", items: [], empty: game.i18n.localize("ACTOR.LABELS.BACKPACK_HINT")}
      },
      iconicSpells: {label: game.i18n.localize("SPELL.IconicPl"), items: []}
    };

    // Iterate over items and organize them
    for ( const i of this.document.items ) {
      const d = {id: i.id, name: i.name, img: i.img, tags: i.getTags(), uuid: i.uuid, actions: [], sort: Infinity};
      let section;
      switch(i.type) {
        case "accessory":
        case "armor":
        case "consumable":
          this.#preparePhysicalItem(i, d);
          section = i.system.equipped ? sections.inventory[i.type] : sections.inventory.backpack;
          break;
        case "weapon":
          this.#preparePhysicalItem(i, d);
          if ( !i.system.dropped ) {
            d.actions.unshift({action: "itemDrop", icon: "fa-solid fa-hand-point-down", tooltip: "Drop Weapon"});
          }
          section = i.system.equipped ? sections.inventory.weapon : sections.inventory.backpack;
          break;
        case "base":
        case "loot":
          section = sections.inventory.backpack;
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
          else if ( i.system.training.type ) section ||= sections.talents.training;
          else section ||= sections.talents.passive;
          break;
        case "spell":
          d.isItem = true;
          section = sections.iconicSpells;
          break;
      }
      if ( section ) section.items.push(d);
    }

    // Remove unused sections
    if ( this.actor.system.usesEquipment === false ) {
      if ( !sections.inventory.accessory.items.length ) delete sections.inventory.accessory;
      if ( !sections.inventory.consumable.items.length ) delete sections.inventory.consumable;
    }

    // Sort inventory
    for ( const heading of Object.values(sections.inventory) ) {
      if ( heading.counter ) heading.label += ` (${heading.items.length}/${heading.counter})`;
      heading.items.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
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
   * Standard preparation steps for all physical item types.
   * @param {CrucibleItem} item
   * @param {object} config
   */
  #preparePhysicalItem(item, config) {
    const sortOrder = {weapon: 1, armor: 2, accessory: 3, consumable: 4};
    config.dropped = item.system.dropped;
    config.equipped = item.system.equipped;
    config.quantity = item.system.quantity;
    config.showStack = item.system.isStacked;
    config.cssClass = item.system.equipped ? "equipped" : "unequipped";
    config.sort = sortOrder[item.type] ?? Infinity;

    // Equip/Unequip/Recover action
    const typeLabel = game.i18n.localize(CONFIG.Item.typeLabels[item.type]);
    let equipAction;
    if ( item.system.dropped ) {
      config.cssClass += " dropped";
      equipAction = {action: "itemEquip", icon: "fa-solid fa-hand-back-fist", tooltip: `Recover ${typeLabel}`};
    }
    else equipAction = item.system.equipped ?
      {action: "itemEquip", icon: "fa-solid fa-shield-minus", tooltip: `Un-equip ${typeLabel}`} :
      {action: "itemEquip", icon: "fa-solid fa-shield-plus", tooltip: `Equip ${typeLabel}`};
    config.actions.push(equipAction);
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for the set of actions that are displayed on the Available Actions portion of the sheet.
   * @returns {{sections: Record<string, {label: string, actions: object[]}>, favorites: object[]}}
   */
  #prepareActions() {
    const sections = {
      attack: {label: "Attack Actions", actions: []},
      spell: {label: "Spellcraft Actions", actions: []},
      reaction: {label: "Reactions", actions: []},
      movement: {label: "Movement Actions", actions: []},
      general: {label: "General Actions", actions: []}
    };
    const favorites = [];

    // Iterate over all Actions
    for ( const [actionId, action] of Object.entries(this.actor.actions) ) {
      const a = {
        id: actionId,
        name: action.name,
        img: action.img,
        tags: action.getTags().activation,
        canEdit: !!action.parent,
        favorite: action.isFavorite ? {icon: "fa-solid fa-star", tooltip: "Remove Favorite"} :
          {icon: "fa-regular fa-star", tooltip: "Add Favorite"}
      }

      // Classify actions
      let section = "general";
      const tagMapping = {
        strike: "attack",
        reaction: "reaction",
        spell: "spell",
        iconicSpell: "spell",
        movement: "movement"
      };
      for ( const [tag, sectionId] of Object.entries(tagMapping) ) {
        if ( action.tags.has(tag) ) {
          section = sectionId;
          break;
        }
      }
      sections[section].actions.push(a);

      // Favorite actions which are able to be currently used
      if ( action.isFavorite && action._displayOnSheet() ) favorites.push(a);
    }

    // Sort each section
    for ( const [k, section] of Object.entries(sections) ) {
      if ( !section.actions.length ) delete sections[k];
      else section.actions.sort((a, b) => a.name.localeCompare(b.name));
    }
    favorites.sort((a, b) => a.name.localeCompare(b.name));
    return {sections, favorites};
  }

  /* -------------------------------------------- */

  /**
   * Format ActiveEffect data required for rendering the sheet
   * @returns {Record<string, {label: string, effects: object[]}>}
   */
  #prepareActiveEffects() {
    const sections = {
      temporary: {label: "Temporary Effects", effects: []},
      persistent: {label: "Persistent Effects", effects: []},
      disabled: {label: "Disabled Effects", effects: []}
    };

    // Categorize and prepare effects
    for ( const effect of this.actor.effects ) {
      const tags = effect.getTags();

      // Add effect to section
      const e = {
        id: effect.id,
        icon: effect.img,
        name: effect.name,
        tags: tags,
        uuid: effect.uuid,
        disabled: effect.disabled ? {icon: "fa-solid fa-toggle-off", tooltip: "Enable Effect"}
          : {icon: "fa-solid fa-toggle-on", tooltip: "Disable Effect"},
      };
      sections[tags.context.section].effects.push(e);
    }

    // Sort
    for ( const [k, section] of Object.entries(sections) ) {
      if ( !section.effects.length ) delete sections[k];
      else section.effects.sort((a, b) => (a.tags.context.t - b.tags.context.t) || (a.name.localeCompare(b.name)));
    }
    return sections;
  }

  /* -------------------------------------------- */

  /**
   * Format categories of the spells tab.
   * @param {{label: string, items: CrucibleItem[]}} iconicSpells
   * @returns {{
   *  runes: {label: string, known: Set<CrucibleSpellcraftRune>},
   *  inflections: {label: string, known: Set<CrucibleSpellcraftInflection>},
   *  gestures: {label: string, known: Set<CrucibleSpellcraftGesture>}
   * }}
   */
  #prepareSpells(iconicSpells) {
    const {runes, gestures, inflections, iconicSlots} = this.actor.grimoire;
    const spells = {
      runes: {
        label: game.i18n.localize("SPELL.COMPONENTS.RunePl"),
        known: runes,
        emptyLabel: game.i18n.localize("SPELL.COMPONENTS.RuneNone")
      },
      gestures: {
        label: game.i18n.localize("SPELL.COMPONENTS.GesturePl"),
        known: gestures,
        emptyLabel: game.i18n.localize("SPELL.COMPONENTS.GestureNone")
      },
      inflections: {
        label: game.i18n.localize("SPELL.COMPONENTS.InflectionPl"),
        known: inflections,
        emptyLabel: game.i18n.localize("SPELL.COMPONENTS.InflectionNone")
      },
      iconicSpells: {
        label: iconicSpells.label,
        known: iconicSpells.items,
        emptyLabel: game.i18n.localize("SPELL.IconicNone")
      }
    }

    // Placeholder Iconic Slots
    if ( iconicSlots > iconicSpells.items.length ) {
      for ( let i=iconicSpells.items.length; i<iconicSlots; i++ ) {
        const spell = {
          id: `iconicSlot${i}`,
          name: "Available Slot",
          img: "icons/magic/symbols/question-stone-yellow.webp",
          cssClass: "iconic-slot",
          tags: {},
          isItem: false
        };
        spells.iconicSpells.known.push(spell);
      }
    }
    return spells;
  }

  /* -------------------------------------------- */

  /**
   * Prepare options provided to a multi-select element for which languages the character may know.
   * @returns {FormSelectOption[]}
   */
  #prepareLanguageOptions() {
    const categories = crucible.CONFIG.languageCategories;
    const options = [];
    for ( const [value, {label, category}] of Object.entries(crucible.CONFIG.languages) ) {
      options.push({value, label, group: categories[category]?.label});
    }
    return options;
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
    const barCap = Math.max(this.document.level, 3);
    for ( const [id, d] of Object.entries(SYSTEM.DAMAGE_TYPES) ) {
      const r = Object.assign({}, d, rs[id]);
      r.cssClass = r.total < 0 ? "vuln" : (r.total > 0 ? "res" : "none");
      const p = Math.clamp(Math.abs(r.total) / barCap, 0, 1);
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
      s.pips = Array.fromRange(4).map((v, i) => i < s.rank ? "trained" : "untrained");

      // Specialization status
      const rank = SYSTEM.TALENT.TRAINING_RANK_VALUES[s.rank];
      s.rankTags = [rank.label];
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
   * Select input text when the element is focused.
   * @param {FocusEvent} event
   */
  #onFocusIn(event) {
    if ( (event.target.tagName === "INPUT") && (event.target.type === "number") ) {
      event.target.type = "text";
      event.target.classList.add("number-input");
      event.target.select();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {

    // Support relative input for number fields
    if ( event.target.name && event.target.classList.contains("number-input") ) {
      if ( ["+", "-"].includes(event.target.value[0]) ) {
        const v0 = foundry.utils.getProperty(this.document, event.target.name);
        const delta = Number(event.target.value);
        event.target.type = "number";
        event.target.valueAsNumber = v0 + delta;
      }
      else if ( event.target.value[0] === "=" ) {
        const value = Number(event.target.value.slice(1));
        event.target.type = "number";
        event.target.valueAsNumber = value;
      }
    }
    super._onChangeForm(formConfig, event);
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onActionEdit(_event, target) {
    const actionId = target.closest(".action").dataset.actionId;
    const action = this.actor.actions[actionId];
    if ( !action.parent ) return;
    await action.sheet.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onActionFavorite(_event, target) {
    const actionId = target.closest(".action").dataset.actionId;
    const action = this.actor.actions[actionId];
    if ( !action ) return;

    // Restrict favorites to actions which still exist
    const priorFavorites = this.actor.system.favorites;
    const favorites = new Set();
    for ( const action of Object.values(this.actor.actions) ) {
      if ( priorFavorites.has(action.id) ) favorites.add(action.id);
    }

    // Toggle favorite state for this action
    if ( favorites.has(action.id) ) favorites.delete(action.id);
    else favorites.add(action.id);
    await this.actor.update({"system.favorites": favorites});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onActionUse(_event, target) {
    const actionId = target.closest(".action").dataset.actionId;
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
  static async #onItemDelete(event, target) {
    const item = this.#getEventItem(event, target);
    await item.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onItemDrop(event, target) {
    const item = this.#getEventItem(event, target);
    await this.actor.equipItem(item.id, {equipped: false, dropped: true});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onItemEdit(event, target) {
    const item = this.#getEventItem(event, target);
    await item.sheet.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onItemEquip(event, target) {
    const item = this.#getEventItem(event, target);
    try {
      await this.actor.equipItem(item, {equipped: !item.system.equipped});
    } catch(err) {
      ui.notifications.warn(err.message);
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the Item document associated with an action event.
   * @param {PointerEvent} event
   * @returns {CrucibleItem}
   */
  #getEventItem(_event, target) {
    const itemId = target.closest(".line-item")?.dataset.itemId;
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
  static async #onEffectDelete(event, target) {
    const effect = this.#getEventEffect(event, target);
    await effect.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEffectEdit(event, target) {
    const effect = this.#getEventEffect(event, target);
    await effect.sheet.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEffectToggle(event, target) {
    const effect = this.#getEventEffect(event, target);
    await effect.update({disabled: !effect.disabled});
  }

  /* -------------------------------------------- */

  /**
   * Get the ActiveEffect document associated with an action event.
   * @param {PointerEvent} event
   * @returns {ActiveEffect}
   */
  #getEventEffect(_event, target) {
    const effectId = target.closest(".effect")?.dataset.effectId;
    return this.actor.effects.get(effectId, {strict: true});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onExpandSection(_event, target) {
    const section = target.closest(".sheet-section");
    const wasExpanded = section.classList.contains("expanded");
    if ( wasExpanded ) {
      for ( const s of section.parentElement.children ) s.classList.remove("expanded", "collapsed");
      return;
    }
    for ( const s of section.parentElement.children ) {
      s.classList.toggle("expanded", s === section);
      s.classList.toggle("collapsed", s !== section);
    }
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleBaseActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onSkillRoll(_event, target) {
    return this.actor.rollSkill(target.closest(".skill").dataset.skill, {dialog: true});
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDragStart(event) {
    super._onDragStart(event);
    const li = event.currentTarget;
    let dragData;

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
    if ( dragData ) event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return;
    const section = event.target.closest("[data-inventory-section]")?.dataset.inventorySection;

    // Moving already owned items
    if ( this.actor.uuid === item.parent?.uuid ) {
      switch ( section ) {
        case "backpack":
          if ( item.system.equipped ) {
            try {
              await this.actor.equipItem(item, {equipped: false});
            } catch(err) {
              ui.notifications.warn(err.message);
            }
          }
          else await this._onSortItem(event, item);
          break;
        default:
          if ( item.type === section ) {
            try {
              await this.actor.equipItem(item, {equipped: true});
            } catch(err) {
              ui.notifications.warn(err.message);
            }
          }
          break;
      }
      return;
    }

    // Create a new item
    const keepId = !(item.system instanceof crucible.api.models.CruciblePhysicalItem);
    item = item.clone({system: {equipped: false}}, {keepId});
    if ( section === item.type ) { // Attempt equipment
      try {
        const equipResult = this.actor.canEquipItem(item);
        item.updateSource({system: equipResult});
      } catch(err) {
        return ui.notifications.warn(err.message);
      }
    }
    const itemData = this.actor._cleanItemData(item);
    await Item.implementation.create(itemData, {parent: this.actor, keepId});
  }
}
