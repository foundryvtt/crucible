import StandardCheck from "../dice/standard-check.mjs";


export default class CrucibleChatMessage extends ChatMessage {

  /** @inheritDoc */
  async renderHTML(options) {
    const html = await super.renderHTML(options);
    if ( this.flags.crucible?.isInitiativeReport ) return html;
    if ( (this.rolls[0] instanceof StandardCheck) && !html.querySelector(".dice-rolls") ) {
      let rollHTML = [];
      for ( const roll of this.rolls ) {
        rollHTML.push(await roll.render({isPrivate: !this.isContentVisible, message: this}));
      }
      const rolls = `<section class="dice-rolls">${rollHTML.join("")}</section>`;
      html.querySelector(".message-content").insertAdjacentHTML("beforeend", rolls);
    }
    return html;
  }
}
