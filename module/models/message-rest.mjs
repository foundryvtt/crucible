/**
 * The system data of a group rest ChatMessage, which stages a pending rest until a Gamemaster confirms it.
 */
export default class CrucibleRestMessage extends foundry.abstract.TypeDataModel {

  /**
   * The lifecycle states of a group rest.
   * @type {Readonly<Record<string, {label: string, icon: string}>>}
   */
  static STATUSES = Object.freeze({
    planning: {label: "ACTOR.GROUP.REST.STATUSES.Planning", icon: "fa-solid fa-hexagon-exclamation"},
    rolling: {label: "ACTOR.GROUP.REST.STATUSES.Rolling", icon: "fa-solid fa-hexagon-exclamation"},
    complete: {label: "ACTOR.GROUP.REST.STATUSES.Complete", icon: "fa-solid fa-hexagon-check"},
    interrupted: {label: "ACTOR.GROUP.REST.STATUSES.Interrupted", icon: "fa-solid fa-hexagon-xmark"},
    cancelled: {label: "ACTOR.GROUP.REST.STATUSES.Cancelled", icon: "fa-solid fa-hexagon-minus"}
  });

  /**
   * The displayed state of a rolling rest which every designated rest action has resolved.
   * @type {Readonly<{label: string, icon: string}>}
   */
  static READY = Object.freeze({label: "ACTOR.GROUP.REST.STATUSES.Ready", icon: "fa-solid fa-hexagon-check"});

  /**
   * The Handlebars template which renders the rest card content.
   * @type {string}
   */
  static TEMPLATE = "systems/crucible/templates/chat/rest-card.hbs";

  /**
   * Serialize participant updates so that concurrent designations are applied in sequence.
   * @type {foundry.utils.Semaphore}
   */
  static #UPDATE_SEMAPHORE = new foundry.utils.Semaphore(1);

  /**
   * Whether each row's rest action results are shown on this client, keyed by message id and actor UUID.
   * @type {Map<string, boolean>}
   */
  static #resultVisibility = new Map();

  /* -------------------------------------------- */

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      group: new fields.DocumentUUIDField({type: "Actor", nullable: false}),
      participants: new fields.ArrayField(new fields.SchemaField({
        actor: new fields.DocumentUUIDField({type: "Actor", nullable: false}),
        designation: new fields.StringField({required: true, blank: true, nullable: true, initial: null}),
        actions: new fields.ArrayField(new fields.ObjectField())
      })),
      duration: new fields.NumberField({required: true, nullable: false, positive: true}),
      allowInterruption: new fields.BooleanField({initial: true}),
      allowRestActions: new fields.BooleanField({initial: true}),
      status: new fields.StringField({required: true, choices: this.STATUSES, initial: "planning"})
    };
  }

  /* -------------------------------------------- */

  /**
   * Is this rest rolling with every designated rest action resolved?
   * @type {boolean}
   */
  get ready() {
    if ( this.status !== "rolling" ) return false;
    return this.participants.every(p => !p.designation || p.actions.some(a => a.action.id === p.designation));
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    // Immediately show results which arrive live
    const visibility = CrucibleRestMessage.#resultVisibility;
    for ( const {actor, designation, actions} of this.participants ) {
      const key = `${this.parent.id}.${actor}`;
      const performed = designation && actions.some(a => a.action.id === designation);
      if ( !performed ) visibility.delete(key);
      else if ( !visibility.has(key) ) visibility.set(key, true);
    }
  }

  /* -------------------------------------------- */
  /*  Rest Workflow                               */
  /* -------------------------------------------- */

  /**
   * Confirm a rolling rest, resolving interruption before the participants rest and time advances.
   * @fires {preGroupRest}
   * @fires {groupRest}
   * @returns {Promise<void>}
   */
  async confirm() {
    if ( !game.user.isGM || (this.status !== "rolling") ) return;
    const group = fromUuidSync(this.group);
    if ( !group ) return;
    const entries = this.participants.map(p => [p, fromUuidSync(p.actor)]).filter(([, actor]) => actor);
    const participants = entries.map(([, actor]) => actor);
    const prior = group.getFlag("crucible", "rest") ?? null;
    const restConfig = {
      duration: this.duration,
      allowInterruption: this.allowInterruption,
      promises: [],
      prior,
      interrupted: null
    };

    // Allow modules to modify, interrupt, or prevent the rest
    const cancelled = Hooks.call("crucible.preGroupRest", group.system, restConfig) === false;
    if ( cancelled && restConfig.allowInterruption ) return this.#setStatus("cancelled");
    try {
      await Promise.all(restConfig.promises);
    } catch(err) {
      if ( !restConfig.allowInterruption ) {
        console.warn(`Group rest hook throw an Error, but this Rest cannot be interrupted: ${err.message}`);
      }
      else if ( restConfig.interrupted ) {
        await this.#recordInterruption(group, prior, restConfig.interrupted);
        return this.#setStatus("interrupted");
      }
      else {
        console.warn(`Group rest cancelled: ${err.message}`);
        return this.#setStatus("cancelled");
      }
    }

    // Successful completion - clear continuation state, then participants rest while time advances
    if ( prior ) await group.unsetFlag("crucible", "rest");
    const [results] = await Promise.all([
      Promise.allSettled(participants.map(actor => this.#restParticipant(actor))),
      game.time.advance(restConfig.duration)
    ]);
    for ( const {status, reason} of results ) {
      if ( status === "rejected" ) console.error(reason);
    }

    // Designated rest actions apply in sequence after every participant has rested
    const participantData = [];
    for ( const [i, [p]] of entries.entries() ) {
      const designated = await this.#confirmDesignation(p);
      participantData.push({...p, actions: [...(results[i].value ?? []), ...(designated ? [designated] : [])]});
    }
    await this.parent.update({system: {status: "complete", participants: participantData}});

    // Announce completion only once time has advanced, so listeners which timestamp the rest record its end
    Hooks.callAll("crucible.groupRest", group.system, restConfig, participants);
  }

  /* -------------------------------------------- */

  /**
   * Designate the rest action a participant will attempt during the planning phase.
   * @param {CrucibleActor} actor                 The designating participant
   * @param {string|null} designation             A rest action id, a blank string to abstain, or null if undecided
   * @returns {Promise<boolean>}                  Whether the designation was recorded
   */
  async designateAction(actor, designation) {
    if ( !game.user.isGM ) {
      const gm = this.#getActiveGM();
      return gm ? gm.query("designateRestAction", {messageId: this.parent.id, actorUuid: actor.uuid, designation})
        : false;
    }
    return this.#updateParticipant(actor.uuid, system => {
      if ( (system.status !== "planning") || !system.allowRestActions ) return false;
      const valid = !designation || this.constructor.getRestActions(actor).some(a => a.id === designation);
      return valid ? {changes: {designation}} : false;
    });
  }

  /* -------------------------------------------- */

  /**
   * Reconstitute the last action a participant performed during this completed rest.
   * @param {CrucibleActor} actor
   * @returns {CrucibleAction|null}
   */
  getAction(actor) {
    const data = this.participants.find(p => p.actor === actor.uuid)?.actions.at(-1);
    return data ? crucible.api.models.CrucibleAction.fromData(data, this.parent) : null;
  }

  /* -------------------------------------------- */

  /**
   * Use a participant's designated rest action on this client and submit its usage to the card.
   * @param {CrucibleActor} actor
   * @returns {Promise<boolean>}    Whether the usage was recorded
   */
  async performAction(actor) {
    const designation = this.participants.find(p => p.actor === actor.uuid)?.designation;
    if ( (this.status !== "rolling") || !designation ) return false;
    const gm = game.user.isGM ? null : this.#getActiveGM();
    if ( !game.user.isGM && !gm ) return false;
    const action = await actor.useAction(designation, {message: this.parent});
    if ( !action ) return false;
    const {data, rolls} = action.serializeUsage();
    const usage = {data, rolls: rolls.map(r => JSON.stringify(r.toJSON()))};
    if ( !gm ) return this.recordAction(actor, usage);
    return gm.query("submitRestAction", {messageId: this.parent.id, actorUuid: actor.uuid, ...usage});
  }

  /* -------------------------------------------- */

  /**
   * Record the usage of a participant's designated rest action, appending its rolls to the card.
   * @param {CrucibleActor} actor
   * @param {object} usage
   * @param {object} usage.data         Serialized usage data of the action
   * @param {string[]} usage.rolls      Serialized rolls which the usage data indexes into
   * @returns {Promise<boolean>}        Whether the usage was recorded
   */
  async recordAction(actor, {data, rolls}) {
    if ( !game.user.isGM ) return false;
    return this.#updateParticipant(actor.uuid, (system, participant) => {
      if ( (system.status !== "rolling") || !participant.designation ) return false;
      if ( (data.action.id !== participant.designation) || participant.actions.length ) return false;
      data = foundry.utils.deepClone(data);
      const offset = this.parent.rolls.length;
      for ( const event of data.events ) {
        if ( event.rollIndex != null ) event.rollIndex += offset;
      }
      return {changes: {actions: [data]}, rolls};
    });
  }

  /* -------------------------------------------- */

  /**
   * Lock planned designations and begin the rolling phase.
   * @returns {Promise<void>}
   */
  async startRolling() {
    if ( !game.user.isGM || (this.status !== "planning") ) return;
    await this.#setStatus("rolling");
  }

  /* -------------------------------------------- */

  /**
   * Return a rolling rest to the planning phase, discarding any resolved rest actions.
   * @returns {Promise<void>}
   */
  async returnToPlanning() {
    if ( !game.user.isGM || (this.status !== "rolling") ) return;
    const participants = this.participants.map(p => ({...p, actions: []}));
    await this.parent.update({rolls: [], system: {status: "planning", participants}});
  }

  /* -------------------------------------------- */

  /**
   * Confirm a participant's resolved designated rest action.
   * @param {object} participant      The participant entry
   * @returns {Promise<object|null>}  Serialized usage data of the confirmed action, or null if none was confirmed
   */
  async #confirmDesignation(participant) {
    const data = participant.designation && participant.actions.find(a => a.action.id === participant.designation);
    if ( !data ) return null;
    try {
      const action = crucible.api.models.CrucibleAction.fromData(data, this.parent);
      if ( (await action.confirm()) === false ) return null;
      return data;
    } catch(err) {
      console.error(err);
      return null;
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the active Gamemaster who records changes to this card, warning if none is connected.
   * @returns {User|null}
   */
  #getActiveGM() {
    const gm = game.users.activeGM;
    if ( !gm ) ui.notifications.warn("ACTOR.GROUP.REST.WARNINGS.NoGM", {localize: true});
    return gm;
  }

  /* -------------------------------------------- */

  /**
   * Persist continuation state after a rest is interrupted, folding listener-supplied extras into the flag.
   * @param {CrucibleActor} group                                         The resting group.
   * @param {{hoursCompleted: number, hoursRequired: number}|null} prior   Prior continuation state.
   * @param {{hoursElapsed: number}} interrupted                           Listener-supplied interruption descriptor.
   * @returns {Promise<void>}
   */
  async #recordInterruption(group, prior, interrupted) {
    const baseHours = SYSTEM.TIME.restSeconds / 3600;
    const {hoursElapsed, ...extras} = interrupted;
    const flag = {
      hoursCompleted: (prior?.hoursCompleted ?? 0) + hoursElapsed,
      hoursRequired: prior?.hoursRequired ?? baseHours,
      ...extras
    };
    await group.setFlag("crucible", "rest", _replace(flag));
    await game.time.advance(hoursElapsed * 3600);
    ui.notifications.warn(_loc("ACTOR.GROUP.REST.Interrupted", {hours: hoursElapsed}));
  }

  /* -------------------------------------------- */

  /**
   * Perform and confirm a participant's Rest action, recorded within this message.
   * @param {CrucibleActor} actor
   * @returns {Promise<object[]>}   Serialized usage data of the performed actions
   */
  async #restParticipant(actor) {
    const action = await actor.useAction("rest", {dialog: false, message: this.parent});
    if ( !action ) return [];
    const {data} = action.serializeUsage();
    await action.confirm();
    return [data];
  }

  /* -------------------------------------------- */

  /**
   * Record the outcome of the rest on its message.
   * @param {string} status
   * @returns {Promise<void>}
   */
  async #setStatus(status) {
    await this.parent.update({"system.status": status});
  }

  /* -------------------------------------------- */

  /**
   * Apply changes to one participant against the latest message state, in sequence with other participant updates.
   * @param {string} uuid             The participant actor UUID
   * @param {(system: CrucibleRestMessage, participant: object) => {changes: object, rolls?: string[]}|false} mutator
   *   Returns participant changes and serialized rolls to append, or false to skip
   * @returns {Promise<boolean>}      Whether an update was applied
   */
  async #updateParticipant(uuid, mutator) {
    return CrucibleRestMessage.#UPDATE_SEMAPHORE.add(async () => {
      const message = this.parent;
      const system = message.system;
      const index = system.participants.findIndex(p => p.actor === uuid);
      if ( index < 0 ) return false;
      const result = mutator(system, system.participants[index]);
      if ( !result ) return false;
      const participants = system.toObject().participants;
      Object.assign(participants[index], result.changes);
      const update = {"system.participants": participants};
      if ( result.rolls?.length ) {
        update.rolls = [...message.rolls.map(r => JSON.stringify(r.toJSON())), ...result.rolls];
      }
      await message.update(update);
      return true;
    });
  }

  /* -------------------------------------------- */

  /**
   * List the rest actions an actor may designate.
   * @param {CrucibleActor} actor
   * @returns {CrucibleAction[]}
   */
  static getRestActions(actor) {
    return Object.values(actor.actions).filter(a => a.tags.has("rest"));
  }

  /* -------------------------------------------- */

  /**
   * Find an actor's participant entry within the most recent group rest which is rolling.
   * @param {CrucibleActor} actor
   * @returns {object|null}
   */
  static getRollingParticipant(actor) {
    for ( const message of game.messages.contents.toReversed() ) {
      if ( (message.type !== "rest") || (message.system.status !== "rolling") ) continue;
      const participant = message.system.participants.find(p => p.actor === actor.uuid);
      if ( participant ) return participant;
    }
    return null;
  }

  /* -------------------------------------------- */

  /**
   * Pre-designate the recovery rest action for whichever of an actor's Wounds or Madness is greater.
   * @param {CrucibleActor} actor
   * @returns {string}              A rest action id, or a blank string to abstain
   */
  static #getDefaultDesignation(actor) {
    const {wounds, madness} = actor.system.resources;
    const w = wounds?.value ?? 0;
    const m = madness?.value ?? 0;
    if ( !(w || m) ) return "";
    const id = (w >= m) ? "convalesce" : "meditate";
    return (id in actor.actions) ? id : "";
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Attach result toggles, designation controls, and Gamemaster controls to the rendered rest card.
   * @param {HTMLElement} html
   */
  activateListeners(html) {
    // Row result visibility, collapsed unless the result arrived live
    const visibility = CrucibleRestMessage.#resultVisibility;
    for ( const button of html.querySelectorAll("button[data-rest-results]") ) {
      const row = button.closest("[data-actor-uuid]");
      const key = `${this.parent.id}.${row.dataset.actorUuid}`;
      const display = shown => {
        row.classList.toggle("results-shown", shown);
        button.ariaPressed = String(shown);
        button.ariaLabel = _loc(`ACTOR.GROUP.REST.${shown ? "HideResult" : "ShowResult"}`);
      };
      if ( !visibility.has(key) ) visibility.set(key, false);
      display(visibility.get(key));
      button.addEventListener("click", () => {
        const shown = !visibility.get(key);
        visibility.set(key, shown);
        display(shown);
      });
    }
    if ( !["planning", "rolling"].includes(this.status) ) return;

    // Row controls
    const rowHandlers = {
      designate: actor => this.#promptDesignation(actor),
      perform: actor => this.performAction(actor)
    };
    for ( const button of html.querySelectorAll("button[data-rest-control]") ) {
      const actor = fromUuidSync(button.closest("[data-actor-uuid]").dataset.actorUuid);
      const handler = rowHandlers[button.dataset.restControl];
      button.addEventListener("click", () => {
        button.disabled = true;
        handler(actor).finally(() => button.disabled = false);
      });
    }
    if ( !game.user.isGM ) return;

    // Gamemaster phase controls
    const controls = document.createElement("div");
    controls.className = "rest-controls flexrow";
    if ( this.status === "planning" ) {
      controls.append(this.#createButton("ACTOR.GROUP.REST.Confirm", "fa-solid fa-campground", () => this.startRolling()));
    }
    else {
      controls.append(
        this.#createButton("ACTOR.GROUP.REST.ReturnToPlanning", "fa-solid fa-rotate-left",
          () => this.returnToPlanning(), {iconOnly: true}),
        this.#createButton("ACTOR.GROUP.REST.ConfirmRest", "fa-solid fa-campground", () => this.confirm())
      );
    }
    html.append(controls);
  }

  /* -------------------------------------------- */

  /**
   * Render the HTML content of the rest card.
   * @returns {Promise<string>}
   */
  async renderCard() {
    const status = this.ready ? this.constructor.READY : this.constructor.STATUSES[this.status];
    const allActions = this.participants.flatMap(p => p.actions);
    const rolling = this.allowRestActions && (this.status === "rolling");
    const participants = [];
    for ( const {actor: uuid, designation, actions} of this.participants ) {
      const actor = fromUuidSync(uuid);
      if ( !actor ) continue;
      const action = actor.actions[(this.allowRestActions && designation) || "rest"];
      const performed = designation ? actions.find(a => a.action.id === designation) : null;
      participants.push({uuid, name: actor.name, img: action?.img ?? actor.img, actionId: action?.id,
        designation: this.#getDesignationLabel(actor, designation),
        performed: performed?.action.name,
        rolls: performed ? this.#prepareRolls(performed) : [],
        resolved: rolling && designation && !!performed,
        canDesignate: this.allowRestActions && (this.status === "planning") && actor.isOwner,
        canPerform: rolling && designation && !performed && actor.isOwner,
        ...this.#prepareSummary(uuid, allActions)});
    }
    return foundry.applications.handlebars.renderTemplate(this.constructor.TEMPLATE, {
      complete: this.status === "complete",
      noChanges: _loc("ACTOR.GROUP.REST.NoChanges"),
      status: this.ready ? "ready" : this.status,
      statusLabel: _loc(status.label),
      statusIcon: status.icon,
      title: _loc("ACTOR.GROUP.REST.CardTitle", {name: fromUuidSync(this.group)?.name, hours: this.duration / 3600}),
      participants
    });
  }

  /* -------------------------------------------- */

  /**
   * Create a Gamemaster control button which disables itself while its callback runs.
   * @param {string} label            The localization key of the button label
   * @param {string} iconClass        The Font Awesome icon classes
   * @param {function} callback       The asynchronous click handler
   * @param {object} [options]
   * @param {boolean} [options.iconOnly=false]  Render the label as a tooltip rather than as text
   * @returns {HTMLButtonElement}
   */
  #createButton(label, iconClass, callback, {iconOnly=false}={}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "frame-brown";
    let icon = button;
    if ( iconOnly ) {
      button.classList.add("icon", ...iconClass.split(" "));
      button.ariaLabel = _loc(label);
      button.dataset.tooltip = "";
    }
    else {
      icon = document.createElement("i");
      icon.className = iconClass;
      button.append(icon, _loc(label));
    }
    button.addEventListener("click", () => {
      button.disabled = true;
      icon.classList.remove(...iconClass.split(" "));
      icon.classList.add("fa-solid", "fa-spinner", "fa-spin");
      callback();
    });
    return button;
  }

  /* -------------------------------------------- */

  /**
   * Label a participant's designated rest action.
   * @param {CrucibleActor} actor             The participant
   * @param {string|null} designation         The designated rest action id, blank to abstain, or null if undecided
   * @returns {string|null}                   The label, or null if rest actions are not displayed
   */
  #getDesignationLabel(actor, designation) {
    if ( !this.allowRestActions || (this.status === "complete") ) return null;
    if ( designation === null ) return _loc("ACTOR.GROUP.REST.Undecided");
    if ( designation === "" ) return _loc("ACTOR.GROUP.REST.Abstain");
    return this.constructor.getRestActions(actor).find(a => a.id === designation)?.name ?? designation;
  }

  /* -------------------------------------------- */

  /**
   * Prompt for the rest action a participant will attempt, then designate it.
   * @param {CrucibleActor} actor             The participant
   * @returns {Promise<void>}
   */
  async #promptDesignation(actor) {
    const current = this.participants.find(p => p.actor === actor.uuid)?.designation ?? null;
    const choices = Object.fromEntries(this.constructor.getRestActions(actor).map(a => [a.id, a.name]));
    const field = new foundry.data.fields.StringField({required: true, blank: true, choices,
      label: _loc("ACTOR.GROUP.REST.FIELDS.designation.label"), hint: _loc("ACTOR.GROUP.REST.FIELDS.designation.hint")});
    const input = {name: "designation", value: current ?? "", blank: _loc("ACTOR.GROUP.REST.Abstain")};
    const designation = await foundry.applications.api.DialogV2.prompt({
      window: {title: _loc("ACTOR.GROUP.REST.DesignateTitle", {name: actor.name}), icon: "fa-solid fa-campground"},
      content: field.toFormGroup({}, input).outerHTML,
      ok: {label: _loc("ACTOR.GROUP.REST.Designate"), callback: (event, button) => button.form.elements.designation.value},
      rejectClose: false
    });
    if ( designation !== null ) await this.designateAction(actor, designation);
  }

  /* -------------------------------------------- */

  /**
   * Prepare compact dice result contexts for the rolls of a performed rest action, labeled by target.
   * @param {object} data           Serialized usage data of the action
   * @returns {object[]}
   */
  #prepareRolls(data) {
    const rolls = [];
    for ( const event of data.events ) {
      const roll = (event.rollIndex != null) ? this.parent.rolls[event.rollIndex] : null;
      if ( !roll || event.negated ) continue;
      rolls.push({name: fromUuidSync(event.target)?.name, ...roll.prepareDiceResultContext()});
    }
    return rolls;
  }

  /* -------------------------------------------- */

  /**
   * Summarize the net reserve resource changes a participant received from the actions recorded during the rest.
   * @param {string} uuid           The participant actor UUID
   * @param {object[]} actions      Serialized usage data of every participant's actions
   * @returns {{resources: object[], pipColors: Set<string>}}
   */
  #prepareSummary(uuid, actions) {
    const deltas = {};
    for ( const event of actions.flatMap(a => a.events) ) {
      if ( (event.target !== uuid) || event.negated ) continue;
      for ( const {resource, delta} of event.resources ) deltas[resource] = (deltas[resource] ?? 0) + delta;
    }
    const resources = [];
    const pipColors = new Set();
    for ( const [resource, delta] of Object.entries(deltas) ) {
      const cfg = SYSTEM.RESOURCES[resource];
      if ( (cfg?.type !== "reserve") || !delta ) continue; // Pools which always refill to maximum are not reported
      let color = cfg.color;
      if ( foundry.utils.isPlainObject(color) ) {
        pipColors.add(color.high.css);
        color = ((delta > 0) === (cfg.type === "active")) ? color.heal : color.high;
      }
      else pipColors.add(color.css);
      resources.push({label: cfg.label, amount: delta.signedString(), colorStyle: color.toRGBA(0.25)});
    }
    return {resources, pipColors};
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers               */
  /* -------------------------------------------- */

  /**
   * Handle a designation dispatched by a participant owner via user.query("designateRestAction").
   * @param {object} params
   * @param {string} params.messageId             The rest ChatMessage id
   * @param {string} params.actorUuid             The designating participant UUID
   * @param {string|null} params.designation      The designated rest action id, blank to abstain, or null
   * @param {{user: User}} context                The query context
   * @returns {Promise<boolean>}                  Whether the designation was recorded
   */
  static async handleDesignation({messageId, actorUuid, designation}, {user}) {
    const message = game.messages.get(messageId);
    const actor = fromUuidSync(actorUuid);
    if ( (message?.type !== "rest") || !actor?.testUserPermission(user, "OWNER") ) return false;
    return message.system.designateAction(actor, designation);
  }

  /* -------------------------------------------- */

  /**
   * Handle a designated rest action usage submitted by a participant owner via user.query("submitRestAction").
   * @param {object} params
   * @param {string} params.messageId             The rest ChatMessage id
   * @param {string} params.actorUuid             The performing participant UUID
   * @param {object} params.data                  Serialized usage data of the action
   * @param {string[]} params.rolls               Serialized rolls which the usage data indexes into
   * @param {{user: User}} context                The query context
   * @returns {Promise<boolean>}                  Whether the usage was recorded
   */
  static async handleSubmission({messageId, actorUuid, data, rolls}, {user}) {
    const message = game.messages.get(messageId);
    const actor = fromUuidSync(actorUuid);
    if ( (message?.type !== "rest") || !actor?.testUserPermission(user, "OWNER") ) return false;
    return message.system.recordAction(actor, {data, rolls});
  }

  /* -------------------------------------------- */
  /*  Factories                                   */
  /* -------------------------------------------- */

  /**
   * Create a planning rest ChatMessage for a group.
   * @param {CrucibleActor} group                      The resting group.
   * @param {object} config
   * @param {Iterable<CrucibleActor>} config.participants   The members who rest.
   * @param {number} config.duration                        Rest duration in seconds.
   * @param {boolean} config.allowInterruption              Whether the rest may be interrupted.
   * @param {boolean} config.allowRestActions               Whether participants may designate rest actions.
   * @returns {Promise<CrucibleChatMessage>}
   */
  static async createMessage(group, {participants, duration, allowInterruption, allowRestActions}) {
    const cls = ChatMessage.implementation;
    return cls.create({
      type: "rest",
      speaker: cls.getSpeaker({actor: group}),
      system: {
        group: group.uuid,
        participants: Array.from(participants, a => {
          return {actor: a.uuid, designation: allowRestActions ? this.#getDefaultDesignation(a) : null};
        }),
        duration,
        allowInterruption,
        allowRestActions,
        status: allowRestActions ? "planning" : "rolling"
      }
    });
  }
}
