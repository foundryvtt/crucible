/**
 * @typedef CrucibleGroupMilestoneAward
 * @property {number} number
 * @property {string} [reason]
 */

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
      milestones: new fields.TypedObjectField(new fields.SchemaField({
        number: new fields.NumberField({required: true, integer: true, min: 1}),
        reason: new fields.StringField()
      }))
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

  /**
   * The distinct Actors which belong to this group.
   * @type {Set<CrucibleActor>}
   */
  actors = new Set();

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

    // Expected party level
    const a = this.advancement;
    a.totalMilestones = Object.values(a.milestones).reduce((t, a) => t + a.number, 0);
    const l = Object.values(SYSTEM.ACTOR.LEVELS).find(l => l.milestones.next > a.totalMilestones);
    a.expectedLevel = l?.level ?? 0;

    // Prepare members
    this.actors.clear();
    this.memberIds.clear();
    for ( const m of this.members ) {
      m.actor = game.actors.get(m.actorId);
      if ( !m.actor ) continue;
      m.actor._groups.add(this.parent);
      for ( let i=0; i<m.quantity; i++ ) levels.push(m.actor.level);
      this.memberIds.add(m.actorId);
      this.actors.add(m.actor);
    }

    // Median member level
    const nl = levels.length;
    levels.sort();
    let medianLevel = levels[Math.floor((nl-1) / 2)];
    if ( levels.length % 2 !== 0 ) medianLevel = (medianLevel + levels[Math.ceil((nl-1) / 2)]) / 2;
    a.medianLevel = medianLevel;

    // Member IDs
    Object.defineProperty(this.members, "ids", {value: this.memberIds, enumerable: false, configurable: true});
    Object.defineProperty(this.members, "actors", {value: this.actors, enumerable: false, configurable: true});

    // Movement pace
    const m = this.movement;
    const pace = SYSTEM.ACTOR.TRAVEL_PACES[m.pace];
    for ( const [k, v] of Object.entries(m) ) {
      if ( k === "pace" ) continue;
      m[k] = (v * pace.speedMultiplier).toNearest(0.5);
    }
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
   * Award a milestone to the members of this group.
   * @param {string} identifier                       A unique string identifier for this milestone. Ideally a slug
   * @param {number} number                           The number of milestone points attached to this award
   * @param {object} options                          Options which modify how the milestone is awarded
   * @param {boolean} [options.createMessage=true]      Create a ChatMessage logging the award?
   * @param {string} [options.reason]                   An optional plain-text reason which describes the event
   * @param {string[]} [options.recipientIds]           Customize the set of Actors who should receive the award
   * @returns {Promise<void>}
   */
  async awardMilestone(identifier, number, {createMessage=true, reason="", recipientIds}={}) {
    const actorUpdates = [];
    const recipientHTML = [];

    // Verify inputs
    if ( !Number.isInteger(number) || (number < 1) ) throw new Error("The number of milestones awarded must be a " +
      "positive integer");
    const milestones = foundry.utils.deepClone(this._source.advancement.milestones);
    if ( identifier in milestones ) throw new Error(`A milestone with identifier "${identifier}" has already 
    been awarded to group "${this.parent.name}"`);

    // Configure group award
    milestones[identifier] = {number, reason};
    actorUpdates.push({_id: this.parent.id, system: {advancement: {milestones}}});

    // Prepare ChatMessage
    const plurals = new Intl.PluralRules(game.i18n.lang);
    const label = game.i18n.localize("AWARD.MILESTONE." + plurals.select(number));
    const groupText = game.i18n.format("AWARD.MILESTONE.GroupAward", {number, label, name: this.parent.name});
    recipientHTML.push(`
    <div class="hex labeled-hex">
      <span class="value large">${number}</span>
      <h4 class="label footer">${label}</h4>
    </div>
    <p>${groupText}</p>
    <ul class="plain">`);

    // Configure member awards
    recipientIds ||= Array.from(this.memberIds);
    for ( const id of recipientIds ) {
      const actor = game.actors.get(id);
      if ( !actor || (actor.type !== "hero") ) throw new Error(`Actor ID "${id}" cannot be awarded a milestone`);
      recipientHTML.push(`<li>${actor.name}</li>`);
      const actorMilestones = actor.system._source.advancement.milestones + number;
      actorUpdates.push({_id: id, system: {advancement: {milestones: actorMilestones}}});
    }

    // Perform Actor updates
    await Actor.updateDocuments(actorUpdates);

    // Create ChatMessage
    if ( !createMessage ) return;
    recipientHTML.push("</ul>");
    if ( reason ) recipientHTML.push(`<blockquote class="milestone-reason">${reason}</blockquote>`);
    await ChatMessage.implementation.create({
      content: `<section class="milestone-award">${recipientHTML.filterJoin("")}</section>`,
      speaker: ChatMessage.implementation.getSpeaker({actor: this.parent}),
      flags: {crucible: {isAwardSummary: true}}
    });
  }

  /* -------------------------------------------- */

  /**
   * Revoke a milestone to the members of this group.
   * @param {string} identifier                       The string identifier for a previous milestone award
   * @param {object} options                          Options which modify how the milestone is revoked
   * @param {boolean} [options.createMessage=true]      Create a ChatMessage logging the award?
   * @param {string[]} [options.recipientIds]           Customize the set of Actors who should receive the award
   * @returns {Promise<void>}
   */
  async revokeMilestone(identifier, {createMessage=false, recipientIds}={}) {
    const actorUpdates = [];
    const recipientHTML = [];

    // Configure group award
    const milestones = foundry.utils.deepClone(this._source.advancement.milestones);
    if ( !(identifier in milestones) ) throw new Error(`There is no milestone award with identifier 
    "${identifier}" on group "${this.parent.name}"`);
    const number = milestones[identifier].number;
    delete milestones[identifier];
    actorUpdates.push({_id: this.parent.id, system: {advancement: {"==milestones": milestones}}}); // ForcedDeletion

    // Prepare ChatMessage
    const plurals = new Intl.PluralRules(game.i18n.lang);
    const label = game.i18n.localize("AWARD.MILESTONE." + plurals.select(number));
    const groupText = game.i18n.format("AWARD.MILESTONE.GroupRevoke", {number, label, name: this.parent.name});
    recipientHTML.push(`<p>${groupText}</p>`, `<ul class="plain">`);

    // Configure member awards
    recipientIds ||= Array.from(this.memberIds);
    for ( const id of recipientIds ) {
      const actor = game.actors.get(id);
      if ( !actor || (actor.type !== "hero") ) throw new Error(`Actor ID "${id}" have a milestone revoked`);
      recipientHTML.push(`<li>${actor.name}</li>`);
      const actorMilestones = Math.max(actor.system._source.advancement.milestones - number, 0);
      actorUpdates.push({_id: id, system: {advancement: {milestones: actorMilestones}}});
    }

    // Perform Actor updates
    await Actor.updateDocuments(actorUpdates);

    // Create ChatMessage
    if ( !createMessage ) return;
    recipientHTML.push("</ul>");
    await ChatMessage.implementation.create({
      content: `<section class="crucible">${recipientHTML.join("")}</section>`,
      speaker: ChatMessage.implementation.getSpeaker({actor: this.parent}),
      flags: {crucible: {isAwardSummary: true}}
    });
  }

  /* -------------------------------------------- */

  /**
   * Provide the Gamemaster with a Dialog to award milestone points to the group.
   * @param {object} [options]
   * @param {boolean} [options.createMessage=true]  Whether to create a chat message summarizing the award
   * @param {boolean} [options.number=1]            A number of milestones as the default option
   * @returns {Promise<void>}
   */
  async awardMilestoneDialog(options={}) {
    if ( !game.user.isGM ) throw new Error("You must be a Gamemaster user to award milestones.");

    // Prepare form data
    const heroes = this.members.reduce((obj, {actor}) => {
      if ( actor?.type === "hero" ) obj[actor.id] = actor.name;
      return obj;
    }, {});

    // Render form HTML
    const {SetField, StringField} = foundry.data.fields;
    const content = document.createElement("div");
    const identifier = new StringField({
      label: game.i18n.localize("AWARD.MILESTONE.Identifier"),
      hint: game.i18n.localize("AWARD.MILESTONE.IdentifierHint")
    });
    const number = this.schema.getField("advancement.milestones.element.number");
    const reason = this.schema.getField("advancement.milestones.element.reason");
    const recipients = new SetField(new StringField({required: true, blank: false, choices: heroes}), {
      label: game.i18n.localize("AWARD.MILESTONE.Recipients"),
      hint: game.i18n.localize("AWARD.MILESTONE.RecipientsHint")
    });
    const identifierPlaceholder = `milestone${Object.keys(this.advancement.milestones).length+1}`;
    content.append(
      identifier.toFormGroup({}, {name: "identifier", placeholder: identifierPlaceholder}),
      number.toFormGroup({classes: ["slim"]}, {name: "number", value: options.number || 1, placeholder: "1"}),
      
      // TODO: Can remove this manual localization in v14
      reason.toFormGroup({stacked: true}, {name: "reason", placeholder: game.i18n.localize("ACTOR.GROUP.FIELDS.advancement.milestones.element.reason.placeholder")}),
      recipients.toFormGroup({stacked: true}, {name: "recipients", type: "checkboxes", value: Object.keys(heroes),
        sort: true})
    );

    // Create confirmation dialog
    const response = await foundry.applications.api.DialogV2.input({
      window: {title: game.i18n.localize("AWARD.MILESTONE.Award"), icon: "fa-solid fa-star"},
      ok: {label: game.i18n.localize("AWARD.LABELS.Award"), icon: "fa-solid fa-arrow-up"},
      content
    });
    if ( !response ) return;
    response.identifier ||= identifierPlaceholder;
    response.number ||= 1;

    // Perform the award
    await this.awardMilestone(response.identifier, response.number, {
      ...options,
      recipientIds: response.recipients,
      reason: response.reason
    });
  }

  /* -------------------------------------------- */


  /**
   * Provide the Gamemaster with a Dialog to revoke milestone points from the group.
   * @returns {Promise<void>}
   */
  async revokeMilestoneDialog() {
    if ( !game.user.isGM ) throw new Error("You must be a Gamemaster user to revoke milestones.");

    // Prepare form data
    const heroes = this.members.reduce((obj, {actor}) => {
      if ( actor?.type === "hero" ) obj[actor.id] = actor.name;
      return obj;
    }, {});
    const identifiers = Object.entries(this.advancement.milestones).reduce((obj, [identifier, {reason, number}]) => {
      obj[identifier] = `(+${number}) ${reason || identifier}`;
      return obj;
    }, {});

    // Render form HTML
    const {SetField, StringField} = foundry.data.fields;
    const content = document.createElement("div");
    const identifier = new StringField({
      label: game.i18n.localize("AWARD.MILESTONE.Identifier"),
      hint: game.i18n.localize("AWARD.MILESTONE.IdentifierHint"),
      choices: identifiers,
      blank: true
    });
    const recipients = new SetField(new StringField({required: true, blank: false, choices: heroes}), {
      label: game.i18n.localize("AWARD.MILESTONE.Recipients"),
      hint: game.i18n.localize("AWARD.MILESTONE.RecipientsHint")
    });
    content.append(
      identifier.toFormGroup({}, {name: "identifier"}),
      recipients.toFormGroup({stacked: true}, {name: "recipients", type: "checkboxes", value: Object.keys(heroes),
        sort: true})
    );

    // Create confirmation dialog
    const response = await foundry.applications.api.DialogV2.input({
      window: {title: game.i18n.localize("AWARD.MILESTONE.Revoke"), icon: "fa-solid fa-star"},
      ok: {label: game.i18n.localize("AWARD.LABELS.Revoke"), icon: "fa-solid fa-arrow-down"},
      content
    });
    if ( !response?.identifier ) return;

    // Perform the revocation
    await this.revokeMilestone(response.identifier, {recipientIds: response.recipients});
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
      tags.level = `${game.i18n.localize("ACTOR.GROUP.LABELS.medianLevel")} ${this.advancement.medianLevel}`;
    }
    return tags;
  }
  /* -------------------------------------------- */

  /**
   * Perform a group recovery where every member of the group uses the Recovery action and time advances.
   * @fires {preGroupRecover}
   * @returns {Promise<void>}
   */
  async recover() {
    if ( Hooks.call("crucible.preGroupRecover", this) === false ) return;
    const promises = [];
    for ( const actor of this.actors ) {
      promises.push(actor.useAction("recover", {dialog: false}));
    }
    promises.push(game.time.advance(SYSTEM.TIME.recoverSeconds));
    await Promise.allSettled(promises);
  }

  /* -------------------------------------------- */

  /**
   * Perform a group rest where every member of the group uses the Rest action and time advances.
   * @fires {preGroupRest}
   * @returns {Promise<void>}
   */
  async rest() {
    if ( Hooks.call("crucible.preGroupRest", this) === false ) return;
    const promises = [];
    for ( const actor of this.actors ) {
      promises.push(actor.useAction("rest", {dialog: false}));
    }
    promises.push(game.time.advance(SYSTEM.TIME.restSeconds));
    await Promise.allSettled(promises);
  }

  /* -------------------------------------------- */

  /**
   * @callback CrucibleGroupCheckCriteria
   * @param {CrucibleActor} group
   * @param {CrucibleActor} member
   * @returns {Promise<{[roll]: StandardCheck, [success]: boolean}|null>}
   */

  /**
   * Create a group check tooltip.
   * @param {CrucibleGroupCheckCriteria} check
   * @param {object} options
   * @param {string} [options.title]
   * @returns {Promise<string>}
   */
  async renderGroupCheckTooltip(check, {title}={}) {

    // Prepare check results
    const results = [];
    for ( const member of this.members ) {
      if ( !member.actor ) continue;
      const r = await check(this.parent, member.actor);
      if ( r === null ) continue;
      const {roll, success, passive} = r;
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

      // Static checks
      else {
        if ( typeof success === "boolean" ) Object.assign(result, {
          isSuccess: success,
          isFailure: !success,
          icon: success ? "fa-light fa-hexagon-check" : "fa-light fa-hexagon-xmark",
          hasValue: false
        });
        if ( Number.isNumeric(passive) ) Object.assign(result, {
          total: passive,
          hasValue: true
        });
      }
      if ( result.isSuccess === undefined ) {
        throw new Error("A group check result must either provide a roll or a binary success");
      }

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

  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(data) {
    if ( typeof data.advancement?.milestones === "number" ) data.advancement.milestones = {};
    return super.migrateData(data);
  }
}
