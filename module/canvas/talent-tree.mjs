import CrucibleTalentNode from "../config/talent-tree.mjs";
import CrucibleTalentTreeNode from "./talent-node.mjs";

export default class CrucibleTalentTree extends InteractionLayer {

  /** @override */
  async _draw() {
    this.bg = this.addChild(new PIXI.Graphics());

    this.connections = this.addChild(new PIXI.Graphics());
    this.connections.lineStyle({color: 0x000000, width: 10});

    this.nodes = this.addChild(new PIXI.Container());
    this.#drawBackground();

    const origin = CrucibleTalentNode.nodes.get("origin");
    this.#drawNodes(origin.connected, new Set([origin]));
  }

  _activate() {
    this.visible = true;
  }

  _deactivate() {
    this.visible = false;
  }

  #drawBackground() {

    // Compute dimensions
    const r = canvas.dimensions.rect;
    const {width, height} = HexagonalGrid.computeDimensions({columns: true, even: true, size: 12000});
    const center = r.center;
    const ox = (r.width  - width) / 2;
    const oy = (r.height - height) / 2;
    const points = HexagonalGrid.FLAT_HEX_BORDERS["1"].map(d => [(width * d[0]) + ox, (height * d[1]) + oy]);

    // Sectors
    const colors = Object.values(CrucibleTalentNode.ABILITY_COLORS);
    for ( let i=0; i<points.length; i++ ) {
      const shape = new PIXI.Polygon([center.x, center.y, ...points.at(i-1), ...points.at(i)]);
      this.bg.beginFill(colors[i].multiply(0.4), 1.0).drawShape(shape).endFill();
    }

    // Center Hex
    const cd = HexagonalGrid.computeDimensions({columns: true, even: true, size: 800});
    const ocx = center.x - (cd.width / 2);
    const ocy = center.y - (cd.height / 2);
    const cp = HexagonalGrid.FLAT_HEX_BORDERS["1"].flatMap(d => [ocx + (cd.width * d[0]), ocy + (cd.height * d[1])]);
    this.bg.beginFill(0x111111, 1.0).drawPolygon(cp).endFill();
  }

  #drawNodes(nodes, seen=new Set()) {
    const next = [];
    for ( const node of nodes ) {
      if ( seen.has(node) ) continue;
      this.#drawNode(node);
      this.#drawEdges(node, seen);
      seen.add(node);
      next.push(...node.connected);
    }
    if ( next.length ) this.#drawNodes(next, seen);
  }

  #drawNode(node) {
    const g = new CrucibleTalentTreeNode(node);
    g.draw();
    this.nodes.addChild(g);
  }

  #drawEdges(node, seen) {
    for ( const c of node.connected ) {
      if ( seen.has(c) ) continue;
      this.connections.moveTo(node.point.x, node.point.y);
      this.connections.lineTo(c.point.x, c.point.y);
    }
  }
}
