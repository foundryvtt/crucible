export default class CrucibleToken extends foundry.documents.TokenDocument {

  /** @override */
  static getTrackedAttributes(data, _path=[]) {
    return {
      bar: [
        ["resources", "health"],
        ["resources", "morale"],
        ["resources", "action"],
        ["resources", "focus"]
      ],
      value: []
    }
  }
}
