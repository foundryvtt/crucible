import StandardCheck from "../dice/standard-check.js";


export default class CrucibleChatMessage extends ChatMessage {

  /** @inheritdoc */
  async _renderRollContent(messageData) {
    const data = messageData.message;
    if ( this.rolls[0] instanceof StandardCheck ) {
      const isPrivate = !this.isContentVisible;
      const rollHTML = await this._renderRollHTML(isPrivate);
      if ( isPrivate ) {
        data.flavor = game.i18n.format("CHAT.PrivateRollContent", {user: this.user.name});
        messageData.isWhisper = false;
        messageData.alias = this.user.name;
      }
      data.content += `<section class="dice-rolls">${rollHTML}</section>`;
      return;
    }
    return super._renderRollContent(messageData);
  }
}
