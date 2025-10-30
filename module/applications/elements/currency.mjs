/** @import {FormInputConfig} from "@common/data/_types.mjs"; */

/**
 * A custom HTML element for configuring the price of an Item or an amount of currency owned by an Actor.
 * @extends {AbstractFormInputElement<number>}
 */
export default class HTMLCrucibleCurrencyElement extends foundry.applications.elements.AbstractFormInputElement {

  /** @override */
  static tagName = "crucible-currency";

  /**
   * The named input elements used internally by this element.
   * @type {Record<string, HTMLInputElement>}
   */
  #inputs = {};

  /* -------------------------------------------- */

  /** @override */
  _buildElements() {

    // Initialize existing raw value
    this._value = Number(this.getAttribute("value") || 0);
    this.removeAttribute("value");

    // Create input fields for each denomination
    const elements = [];
    const ds = Object.entries(crucible.CONFIG.currency).toSorted((a, b) => b[1].multiplier - a[1].multiplier);
    for ( const [k, v] of ds ) {

      // Number input
      const i = document.createElement("input");
      if ( this.id ) i.id = `${this.id}-${k}`;
      i.type = "text"; // Use text so we can support delta values like "+12"
      i.placeholder = v.abbreviation;
      i.dataset.denomination = k;
      this.#inputs[k] = i;

      // Icon or string label
      const l = document.createElement("label");
      l.setAttribute("for", i.id);
      if ( v.icon ) {
        const img = document.createElement("img");
        img.src = v.icon;
        img.alt = v.label;
        img.setAttribute("aria-label", v.label);
        img.toggleAttribute("data-tooltip", true);
        l.appendChild(img);
      }
      else l.innerText = v.abbreviation;
      elements.push(l, i);
    }
    return elements;
  }

  /* -------------------------------------------- */

  /** @override */
  _refresh() {
    const isReadonly = this.hasAttribute("readonly");
    const amounts = crucible.api.documents.CrucibleActor.allocateCurrency(this._value);
    for ( const [k, v] of Object.entries(amounts) ) {
      const i = this.#inputs[k];
      i.value = v;
      // Hide zero inputs for readonly elements
      i.toggleAttribute("readonly", isReadonly);
      const isHidden = isReadonly && (v === 0);
      i.classList.toggle("hidden", isHidden);
      i.previousElementSibling.classList.toggle("hidden", isHidden);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _toggleDisabled(disabled) {
    for ( const i of Object.values(this.#inputs) ) i.disabled = disabled;
  }

  /* -------------------------------------------- */

  /** @override */
  _activateListeners() {
    const onChange = this.#onChangeInput.bind(this);
    for ( const i of Object.values(this.#inputs) ) {
      i.addEventListener("change", onChange);
      i.addEventListener("focus", e => e.target.select());
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to a currency input value.
   */
  #onChangeInput(event) {
    const input = event.target;
    const d = input.dataset.denomination;
    const cfg = crucible.CONFIG.currency[d];
    const amounts = crucible.api.documents.CrucibleActor.allocateCurrency(this._value);

    // Support signed delta values like "+12" or "-5"
    let value = Number(input.value);
    let delta;
    if ( input.value[0] === "=" ) value = Number(input.value.substr(1));
    else if ( input.value[0] === "+" ) delta = Number(input.value.substr(1));
    else if ( input.value[0] === "-" ) delta = Number(input.value);

    // Apply delta
    if ( delta ) {
      if ( !Number.isFinite(delta) ) {
        input.value = amounts[d];
        return;
      }
      const d = crucible.api.documents.CrucibleActor.convertCurrency({[input.dataset.denomination]: delta});
      if ( (this._value + d) < 0 ) {
        ui.notifications.warn(`Insufficient currency to deduct ${delta} ${cfg.label}.`);
        input.value = amounts[d];
        return;
      }
      this._value = Math.max(this._value + d, 0);
    }

    // Apply total
    else {
      if ( !Number.isFinite(value) ) {
        input.value = amounts[d];
        return;
      }
      amounts[d] = value;
      this._value = crucible.api.documents.CrucibleActor.convertCurrency(amounts);
    }

    // Dispatch change
    this.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    this._refresh();
  }

  /* -------------------------------------------- */

  /**
   * Create a HTMLCrucibleCurrencyElement using provided configuration data.
   * @param {FormInputConfig<string> & FilePickerInputConfig} config
   */
  static create(config) {
    const picker = document.createElement(this.tagName);
    picker.name = config.name;
    picker.setAttribute("value", config.value || "0");
    foundry.applications.fields.setInputAttributes(picker, config);
    return picker;
  }
}
