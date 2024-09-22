/**
 * Override the base TokenHUD class to implement some Crucible-specific presentation.
 * For now this just adjusts for the grid size.
 * Eventually it will add custom resource management, action HUD, etc...
 */
export default class CrucibleTokenHUD extends TokenHUD {

  /** @override */
  setPosition(_position) {
    const {bounds, w: width, h: height} = this.object;
    const position = {width, height, left: bounds.left, top: bounds.top};
    this.element.css(position);
  }
}
