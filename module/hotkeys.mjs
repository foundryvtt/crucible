import {onKeyboardConfirmAction} from "./chat.mjs";
import {openGroupCheckQuickSelection} from "./applications/tools/group-check-quick-selection.mjs";

/**
 * Register system keybindings.
 */
export function registerKeybindings() {
  game.keybindings.register("crucible", "confirm", {
    name: "KEYBINDINGS.ConfirmAction",
    hint: "KEYBINDINGS.ConfirmActionHint",
    editable: [{key: "KeyX"}],
    restricted: true,
    onDown: onKeyboardConfirmAction
  });

  game.keybindings.register("crucible", "groupCheckQuickSelection", {
    name: "KEYBINDINGS.GroupCheckQuickSelection",
    hint: "KEYBINDINGS.GroupCheckQuickSelectionHint",
    editable: [{key: "KeyG"}],
    restricted: true,
    onDown: openGroupCheckQuickSelection
  });
}
