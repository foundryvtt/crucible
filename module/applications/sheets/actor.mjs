/**
 * A common actor sheet class shared by both Hero and Adversary types.
 */
export default class CrucibleActorSheet extends ActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.dragDrop.push({dragSelector: ".actions .action", dropSelector: null});
    return Object.assign(options, {
      width: 760,
      height: 750,
      classes: [SYSTEM.id, "sheet", "actor", this.actorType],
      template: `systems/${SYSTEM.id}/templates/sheets/${this.actorType}.hbs`,
      resizable: false,
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes"}],
      scrollY: []
    });
  }

  /**
   * The type of Actor rendered using this sheet.
   * @type {string}
   */
  static actorType = "hero";

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {

    // Start with some elements from the basic DocumentSheet
    const context = await DocumentSheet.prototype.getData.call(this, options);
    const a = context.actor = context.document;
    const s = context.source = context.data;

    // Abilities, Defenses, Resources, and Resistances

    context.physicalDefenses = this.#formatPhysicalDefenses(a.system.defenses);
    context.saveDefenses = this.#formatSaveDefenses(a.system.defenses);
    context.resistances = this.#formatResistances(a.system.resistances);

    // Owned Items
    context.items = this.#formatItems(a.items);


    // Skills
    context.skillCategories = this.#formatSkills(a.system.skills);

    // Spellcraft
    context.grimoire = this.#formatGrimoire();
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Format physical defenses for display in the sheet.
   * @param {object} defenses     Prepared Actor system defenses
   * @returns {object[]}          A formatted array of physical defenses
   */
  #formatPhysicalDefenses(defenses) {
    return {
      total: {
        value: defenses.physical.total,
        label: SYSTEM.DEFENSES.physical.label,
        subtitle: this.actor.equipment.armor.name
      },
      armor: {
        value: defenses.armor.total,
        label: SYSTEM.DEFENSES.armor.label,
        pct: Math.round(defenses.armor.total * 100 / defenses.physical.total)
      },
      dodge: {
        value: defenses.dodge.total,
        label: SYSTEM.DEFENSES.dodge.label,
        pct: Math.round(defenses.dodge.total * 100 / defenses.physical.total)
      },
      parry: {
        value: defenses.parry.total,
        label: SYSTEM.DEFENSES.parry.label,
        pct: Math.round(defenses.parry.total * 100 / defenses.physical.total)
      },
      block: {
        value: defenses.block.total,
        label: SYSTEM.DEFENSES.block.label,
        pct: Math.round(defenses.block.total * 100 / defenses.physical.total)
      }
    };
  }

  /* -------------------------------------------- */

  /**
   * Format magic defenses for display in the sheet.
   * @param {object} defenses     Prepared Actor system defenses
   * @returns {object[]}          A formatted array of save defenses
   */
  #formatSaveDefenses(defenses) {
    const formatted = [];
    for ( const [id, defense] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( defense.type !== "save" ) continue;
      const d = foundry.utils.mergeObject(defense, defenses[id], {inplace: false});
      d.id = id;
      if ( d.bonus !== 0 ) {
        const sign = d.bonus > 0 ? "+" : "-";
        d.tooltip += ` ${sign} ${Math.abs(d.bonus)}`;
      }
      formatted.push(d);
    }
    return formatted;
  }

  /* -------------------------------------------- */

  /**
   * Organize resistances data for rendering
   * @param {object} resistances    The Actor's resistances data
   * @return {object}               Resistances data organized by category
   */
  #formatResistances(resistances) {
    const categories = foundry.utils.deepClone(SYSTEM.DAMAGE_CATEGORIES);
    return Object.entries(resistances).reduce((categories, e) => {

      // Merge resistance data for rendering
      let [id, r] = e;
      const resist = foundry.utils.mergeObject(r, SYSTEM.DAMAGE_TYPES[id]);

      // Add the resistance to its category
      const cat = categories[resist.type];
      cat.resists = cat.resists || {};
      cat.resists[id] = resist;
      return categories;
    }, categories);
  }

  /* -------------------------------------------- */

  /**
   * Structure owned items for display on the actor sheet.
   * @param {CrucibleItem[]} items        The array of owned items
   */
  #formatItems(items) {

    // Define placeholder structure
    const sections = {
      talents: {
        active: {
          label: "Active Abilities",
          items: []
        },
        passive: {
          label: "Passive Talents",
          items: []
        },
        spell: {
          label: "Spellcraft Talents",
          items: []
        }
      },
      inventory: {
        equipment: {
          label: "Equipment",
          items: [],
          empty: "Equip weapons and armor from your Backpack toggling the shield icon."
        },
        consumables: {
          label: "Consumables",
          items: [],
          empty: "Consumable items are not yet supported in the Crucible system Playtest 1."
        },
        backpack: {
          label: "Backpack",
          items: [],
          empty: "Add Armor or Weapons by dropping them from the provided Crucible system compendium packs."
        }
      }
    };

    // Iterate over items and organize them
    for ( let i of items ) {
      const d = i.toObject();
      d.showStack = d.system?.quantity && (d.system.quantity !== 1);
      switch(d.type) {
        case "armor":
        case "weapon":
          d.tags = i.getTags();
          d.cssClass = [i.system.equipped ? "equipped" : "unequipped"];
          if ( i.system.equipped ) sections.inventory.equipment.items.push(d);
          else sections.inventory.backpack.items.push(d);
          break;
        case "talent":
          d.tags = {};
          const action = i.actions.at(0);
          const spellComp = i.system.rune || i.system.gesture || i.system.inflection;
          if ( action ) {
            const tags = action.getTags();
            d.tags = Object.assign({}, tags.action, tags.activation);
            sections.talents.active.items.push(d);
          }
          else if ( spellComp ) sections.talents.spell.items.push(d);
          else sections.talents.passive.items.push(d);
          break;
      }
    }

    // Sort each array
    for ( let section of Object.values(sections) ) {
      for ( let heading of Object.values(section) ) {
        heading.items.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    // Return the prepared sections
    return sections;
  }

  /* -------------------------------------------- */

  /**
   * Format categories of the grimoire tab.
   * @returns {{
   *  runes: {label: string, known: Set<CrucibleRune>},
   *  inflections: {label: string, known: Set<CrucibleInflection>},
   *  gestures: {label: string, known: Set<CrucibleGesture>}
   * }}
   */
  #formatGrimoire() {
    const grimoire = {
      runes: {label: game.i18n.localize("SPELL.ComponentRune")},
      gestures: {label: game.i18n.localize("SPELL.ComponentGesture")},
      inflections: {label: game.i18n.localize("SPELL.ComponentInflection")}
    }
    for ( const [k, v] of Object.entries(this.actor.grimoire) ) {
      grimoire[k].known = v;
    }
    return grimoire;
  }

  /* -------------------------------------------- */

  /**
   * Organize skills by category in alphabetical order
   * @param {Object} skills
   * @return {*}
   */
  #formatSkills(skills) {
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
      const path = skill.paths[s.path] || null;
      s.rankName = SYSTEM.SKILL.RANKS[s.rank].label;
      s.pathName = path ? path.name : game.i18n.localize("SKILL.RANKS.Unspecialized");

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
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action]").click(this._onClickControl.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle click events on a sheet control button.
   * @param {PointerEvent} event   The originating click event
   * @protected
   */
  async _onClickControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
      case "effectDelete":
        this.#onEffectDelete(button);
        break;
      case "effectEdit":
        this.#onEffectEdit(button);
        break;
      case "itemDelete":
        this.#onItemDelete(button);
        break;
      case "itemEdit":
        this.#onItemEdit(button);
        break;
      case "itemEquip":
        this.#onItemEquip(button);
        break;
      case "useAction":
        await this.actor.useAction(button.closest(".action").dataset.actionId);
        break;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDragStart(event) {
    const target = event.currentTarget;
    if ( target.classList.contains("action") ) {
      const actionId = target.dataset.actionId;
      const action = this.actor.actions[actionId];
      if ( !action ) return;
      const macroData = {
        type: "script",
        scope: "actor",
        name: action.name,
        img: action.img,
        command: `game.system.api.documents.CrucibleActor.macroAction(actor, "${actionId}");`
      };
      event.dataTransfer.setData("text/plain", JSON.stringify({type: "crucible.action", macroData}));
      return;
    }
    return super._onDragStart(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an ActiveEffect within the Actor sheet.
   * @param {HTMLLinkElement} button    The clicked button element
   */
  #onEffectDelete(button) {
    const li = button.closest("[data-effect-id]");
    const effect = this.actor.effects.get(li.dataset.effectId);
    effect?.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an ActiveEffect within the Actor sheet.
   * @param {HTMLLinkElement} button    The clicked button element
   */
  #onEffectEdit(button) {
    const li = button.closest("[data-effect-id]");
    const effect = this.actor.effects.get(li.dataset.effectId);
    effect?.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an Owned Item from the Actor
   * @param {HTMLLinkElement} button
   */
  #onItemDelete(button) {
    const li = button.closest("[data-item-id]");
    const item = this.actor.items.get(li.dataset.itemId);
    return item?.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an Owned Item on the Actor
   * @param {HTMLLinkElement} button
   */
  #onItemEdit(button) {
    const li = button.closest("[data-item-id]");
    const item = this.actor.items.get(li.dataset.itemId);
    return item?.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Toggle the equipped state of an Owned Item on the Actor
   * @param {HTMLLinkElement} button
   */
  async #onItemEquip(button) {
    const li = button.closest("[data-item-id]");
    const item = this.actor.items.get(li.dataset.itemId);
    if ( !item ) return;
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
}
