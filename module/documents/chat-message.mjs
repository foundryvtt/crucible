import MetaRoll from "../dice/meta-roll.mjs";


export default class CrucibleChatMessage extends ChatMessage {

  /** @inheritdoc */
  async _renderRollContent(messageData) {
    const data = messageData.message;
    const roll = this.roll;

    // Handle MetaRoll injection
    if ( roll instanceof MetaRoll ) {
      const isPrivate = !this.isContentVisible;
      const rollContent = await roll.render({isPrivate});
      if ( isPrivate ) {
        data.flavor = game.i18n.format("CHAT.PrivateRollContent", {user: this.user.name});
        messageData.isWhisper = false;
        messageData.alias = this.user.name;
      }
      data.content = data.content.replace('<section class="dice-rolls"></section>', rollContent);
      return;
    }

    // Standard Roll types
    return super._renderRollContent(messageData);
  }
}
