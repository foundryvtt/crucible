

export function addChatMessageContextOptions(html, options)  {
  options.push(
    {
      name: game.i18n.localize("DICE.SetDifficulty"),
      icon: '<i class="fas fa-bullseye"></i>',
      condition: li => {
        if ( !game.user.isGM ) return false;
        const message = game.messages.get(li.data("messageId"));
        return message.isRoll;
      },
      callback: li => {
        const message = game.messages.get(li.data("messageId"));
        Dialog.prompt({
          title: game.i18n.localize("DICE.SetDifficulty"),
          content: `<form><div class="form-group"><label>DC Target</label><input type="text" name="dc" value="15" data-dtype="Number"/></div></form>`,
          callback: html => {
            const roll = message.roll;
            roll.data.dc = parseInt(html[0].querySelector('input').value);
            message.update({roll: JSON.stringify(roll)});
          },
          options: {
            width: 260
          }
        })
      }
    }
  );
  return options;
}
