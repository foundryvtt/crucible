import {SYSTEM} from "../../config/system.js";

/**
 * Add common functionalities to every Crucible Sheet application which alters their visual style.
 * @param {typeof Application} Base     The base Application class being extended
 * @returns {typeof Application}        The extended CrucibleSheet class
 */
export default function CrucibleSheetMixin(Base) {
  return class CrucibleSheet extends Base {

    /**
     * Declare the document type managed by this CrucibleSheet.
     * @type {string}
     */
    static documentType = "";

    /** @inheritDoc */
    static get defaultOptions() {
      return Object.assign(super.defaultOptions, {
        classes: ["crucible-new", "sheet", this.documentType],
        template: `systems/${SYSTEM.id}/templates/sheets/${this.documentType}.hbs`,
        closeOnSubmit: true,
        height: "auto",
        resizable: false,
        submitOnChange: false,
        width: 480
      });
    }

    /** @override */
    get title() {
      const {documentName, type, name} = this.object;
      const typeLabel = game.i18n.localize(CONFIG[documentName].typeLabels[type]);
      return `[${typeLabel}] ${name}`;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _getHeaderButtons() {
      const buttons = super._getHeaderButtons();
      for ( const button of buttons ) {
        button.tooltip = button.label;
        button.label = "";
      }
      return buttons;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _renderOuter() {
      const html = await super._renderOuter();
      const overlaySrc = "systems/crucible/ui/journal/overlay.png"; // TODO convert
      const overlay = `<img class="background-overlay" src="${overlaySrc}">`
      html.prepend(overlay);
      return html;
    }
  }
}
