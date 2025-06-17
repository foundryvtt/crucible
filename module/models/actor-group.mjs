import CrucibleTalentItemSheet from "../applications/sheets/item-talent-sheet.mjs";

/**
 * Data schema, attributes, and methods specific to Group type Actors.
 */
export default class CrucibleGroupActor extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const schema = {};

    // Advancement
    schema.advancement = new fields.SchemaField({
      milestones: new fields.NumberField({...requiredInteger, min: 0, initial: 0})
    });

    // Group Members
    schema.members = new fields.ArrayField(new fields.SchemaField({
      actorId: new fields.DocumentIdField({nullable: false}),
      quantity: new fields.NumberField({...requiredInteger, min: 1, initial: 1})
    }));

    // Movement Attributes
    schema.movement = new fields.SchemaField({
      pace: new fields.StringField({required: true, choices: SYSTEM.ACTOR.TRAVEL_PACES, initial: "normal"}),
      land: new fields.NumberField({required: true, nullable: false, min: 0, initial: 2, step: 0.5}),
      water: new fields.NumberField({required: true, nullable: false, min: 0, initial: 0.5, step: 0.5}),
      air: new fields.NumberField({required: true, nullable: false, min: 0, initial: 0, step: 0.5}),
    });

    // Description
    schema.details = new fields.SchemaField({
      biography: new fields.SchemaField({
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      })
    });
    return schema;
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTOR.GROUP"];

  /**
   * The Handlebars template used to render this Action as a line item for tooltips or as a partial.
   * @type {string}
   */
  static TOOLTIP_CHECK_TEMPLATE = "systems/crucible/templates/tooltips/tooltip-group-check.hbs";

  /**
   * The median level of the group
   * @type {number}
   */
  medianLevel;

  /**
   * The IDs of current group members
   * @type {Set<string>}
   */
  memberIds = new Set();

  /* -------------------------------------------- */
  /*  Document Preparation                        */
  /* -------------------------------------------- */

  /** @override */
  prepareItems(items) {}

  /* -------------------------------------------- */

  /**
   * Derived data prepared for group actors.
   * @override
   */
  prepareDerivedData() {
    const levels = [];
    this.memberIds.clear();
    for ( const m of this.members ) {
      m.actor = game.actors.get(m.actorId);
      if ( !m.actor ) continue;
      for ( let i=0; i<m.quantity; i++ ) levels.push(m.actor.level);
      this.memberIds.add(m.actorId);
    }

    // Median member level
    const nl = levels.length;
    levels.sort();
    let medianLevel = levels[Math.floor((nl-1) / 2)];
    if ( levels.length % 2 !== 0 ) medianLevel = (medianLevel + levels[Math.ceil((nl-1) / 2)]) / 2;
    this.medianLevel = medianLevel;

    // Member IDs
    Object.defineProperty(this.members, "ids", {value: this.memberIds, enumerable: false, configurable: true});
  }

  /* -------------------------------------------- */
  /*  Member Management                           */
  /* -------------------------------------------- */

  /**
   * Add a new member to this group.
   * If the new member is a single Actor (hero or adversary), the group gains `quantity` that Actor.
   * If the new member is a group, this group is merged with the membership of the other group.
   * @param {CrucibleActor} actor     The Actor to add
   * @param {number} [quantity=1]     The quantity to add
   * @returns {Promise<void>}         The updated group Actor
   */
  async addMember(actor, quantity=1) {
    if ( !(actor instanceof Actor) || !!actor.pack ) throw new Error("You can only add a World Actor");
    if ( actor === this.parent ) throw new Error("You cannot add your own group!");

    // Prepare operation data
    const toJoin = new Map();
    if ( actor.type === "group" ) {
      for ( const m of actor.system._source.members ) toJoin.set(m.actorId, m);
    }
    else toJoin.set(actor.id, {actorId: actor.id, quantity});
    const operation = actor.type === "group" ? "merge" : "add";

    // Update group members
    const members = this.toObject().members;
    for ( const m of members ) {
      const j = toJoin.get(m.actorId);
      if ( !j ) continue;
      if ( operation === "merge" ) m.quantity = quantity;
      else m.quantity += quantity;
      toJoin.delete(m.actorId);
    }

    // Add new members
    for ( const m of toJoin.values() ) members.push(m);

    // Commit the update
    await this.parent.update({"system.members": members});
    return this.parent;
  }

  /* -------------------------------------------- */

  /**
   * Remove a member from this group.
   * If the member to remove is a single Actor (hero or adversary), the group loses `quantity` of that Actor.
   * If the member to remove is a group, the group loses `quantity` of each Actor in the other group.
   * @param {CrucibleActor|string} actor  The Actor or ID to remove
   * @param {number} [quantity=1]         The quantity to remove
   * @returns {Promise<void>}             The updated group Actor
   */
  async removeMember(actor, quantity=1) {
    if ( !((actor instanceof Actor) || (typeof actor === "string")) ) {
      throw new Error("The Actor to remove must be an Actor document or string ID.")
    }
    if ( actor === this.parent ) throw new Error("You cannot remove your own group!");

    // Prepare operation data
    const toLeave = new Map();
    if ( typeof actor === "string" ) toLeave.set(actor, {actorId: actor, quantity});
    else if ( actor?.type === "group" ) {
      for ( const m of actor.system._source.members ) toLeave.set(m.actorId, m);
    }
    else toLeave.set(actor.id, {actorId: actor.id, quantity});

    // Remove group members
    const members = this.toObject().members.reduce((arr, m) => {
      const l = toLeave.get(m.actorId);
      if ( l ) {
        m.quantity = Math.max(m.quantity - l.quantity, 0);
        if ( m.quantity === 0 ) return arr;
      }
      arr.push(m);
      return arr;
    }, [])

    // Commit the update
    await this.parent.update({"system.members": members});
    return this.parent;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Provide the Gamemaster with a Dialog to award milestone points to the group.
   * @returns {Promise<void>}
   */
  async awardMilestoneDialog() {
    if ( !game.user.isGM ) throw new Error("You must be a Gamemaster user to award milestones.");

    // Prepare form data
    const heroes = this.members.reduce((obj, {actor}) => {
      if ( actor?.type === "hero" ) obj[actor.id] = actor.name;
      return obj;
    }, {});

    // Render form HTML
    const {SetField, StringField, NumberField} = foundry.data.fields;
    const quantity = new NumberField({
      integer: true,
      initial: 1,
      label: "ACTOR.GROUP.FIELDS.advancement.milestones.label",
      hint: "ACTOR.GROUP.FIELDS.advancement.milestones.hint"
    });
    const quantityHTML = quantity.toFormGroup({classes: ["slim"], localize: true}, {name: "quantity"});
    const recipients = new SetField(new StringField({required: true, blank: false, choices: heroes}), {
      label: "Milestone Recipients",
      hint: "Select one or more heroes to receive the milestone."
    });
    const recipientsHTML = recipients.toFormGroup({stacked: true}, {
      name: "recipients",
      type: "checkboxes",
      value: Object.keys(heroes),
      sort: true
    });

    // Create confirmation dialog
    const response = await foundry.applications.api.DialogV2.input({
      window: {title: game.i18n.localize("ADVANCEMENT.MilestoneAward"), icon: "fa-solid fa-arrow-up"},
      ok: {label: "Award", icon: "fa-solid fa-star"},
      content: `${quantityHTML.outerHTML}${recipientsHTML.outerHTML}`
    });
    if ( !response ) return;

    // Process award
    const updates = response.recipients.reduce((arr, id) => {
      const actor = game.actors.get(id);
      if ( !actor ) return arr;
      const starting = actor.system._source.advancement.milestones;
      const milestones = Math.max(starting + response.quantity, 0);
      arr.push({_id: id, "system.advancement.milestones": milestones});
      return arr;
    }, []);
    const groupMilestones = Math.max(this._source.advancement.milestones + response.quantity, 0);
    updates.push({_id: this.parent.id, "system.advancement.milestones": groupMilestones});
    await Actor.updateDocuments(updates);
  }

  /* -------------------------------------------- */

  /**
   * Prepare tags displayed about this group Actor.
   * @returns {Record<string, string>}
   */
  getTags() {
    const tags = {};
    const plurals = new Intl.PluralRules(game.i18n.lang);

    // Member Count
    const membersLabel = `ACTOR.GROUP.FIELDS.members.${plurals.select(this.members.length)}`;
    tags.members = `${this.members.length} ${game.i18n.localize(membersLabel)}`;

    // Median Level
    if ( this.members.length ) {
      tags.level = `${game.i18n.localize("ACTOR.GROUP.LABELS.medianLevel")} ${this.medianLevel}`;
    }
    return tags;
  }
  /* -------------------------------------------- */

  /**
   * @typedef CrucibleGroupTooltipResult
   * @property {StandardCheck} [roll]
   * @property {boolean} [success]
   */

  /**
   * Create a group check tooltip.
   * @param {function(group: CrucibleActor, member: CrucibleActor): CrucibleGroupTooltipResult|null} check
   * @param {object} options
   * @param {string} [options.title]
   * @returns {Promise<string>}
   */
  async renderGroupCheckTooltip(check, {title}={}) {

    // Prepare check results
    const results = [];
    for ( const member of this.members ) {
      if ( !member.actor ) continue;
      const r = check(this.parent, member.actor);
      if ( r === null ) continue;
      const {roll, success} = r;
      const result = {actor: member.actor, name: member.actor.name, tags: member.actor.getTags()};

      // Roll-based results
      if ( roll ) Object.assign(result, {
        total: roll.total,
        dc: roll.data.dc,
        isSuccess: roll.isSuccess,
        isFailure: roll.isFailure,
        isCriticalSuccess: roll.isCriticalSuccess,
        isCriticalFailure: roll.isCriticalFailure,
        icon: roll.isSuccess ? "fa-light fa-hexagon-check" : "fa-light fa-hexagon-xmark",
        hasValue: true,
      });

      // Binary checks
      else if ( typeof success === "boolean" ) Object.assign(result, {
        isSuccess: success,
        isFailure: !success,
        icon: success ? "fa-light fa-hexagon-check" : "fa-light fa-hexagon-xmark",
        hasValue: false
      });
      else throw new Error("A CrucibleGroupTooltipResult must either provide a roll or a binary success");

      // Common rules
      result.cssClass = [
        result.isSuccess ? "success" : "",
        result.isFailure ? "failure" : "",
        result.isCriticalSuccess ? "critical-success": "",
        result.isCriticalFailure ? "critical-failure" : ""
      ].filterJoin(" ");
      results.push(result);
    }

    // Render
    return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_CHECK_TEMPLATE, {title, results});
  }
}
