
export class Card {
  constructor(x, y, w, h, name, owner, faceImage, hidden, deps) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.name = name;
    this.owner = owner;
    this.faceImage = faceImage;
    this.hidden = hidden;

    this.enteredBattlefield = false;
    this.hovered = false;
    this.rotated = false;

    this.p = deps.p;
    this.imgBack = deps.imgBack;

    this.canPlay = deps.canPlay;
    this.onPlay = deps.onPlay;
    this.onBattlefieldClick = deps.onBattlefieldClick;
  }

  contains(mx, my) {
    return (
      mx > this.x - this.w / 2 && mx < this.x + this.w / 2 &&
      my > this.y - this.h / 2 && my < this.y + this.h / 2
    );
  }

  moveUp() {
    if (!this.enteredBattlefield) {

      if (this.canPlay) {
        const decision = this.canPlay({ owner: this.owner, name: this.name });
        if (!decision || decision.ok !== true) return; 
      }

      this.y += this.owner === "Player1" ? -46 : 46;
      this.enteredBattlefield = true;
      this.hidden = false;

      if (this.onPlay) this.onPlay({ owner: this.owner, name: this.name });
      return;
    }

    this.rotated = !this.rotated;

    if (this.onBattlefieldClick) {
      this.onBattlefieldClick({
        owner: this.owner,
        name: this.name,
        rotated: this.rotated,
        cardInstance: this
      });
    }
  }

  hover(mx, my) {
    this.hovered = this.contains(mx, my);
  }

  display() {
    const p = this.p;

    const cardAspect = 63 / 88;
    let drawW = p.width / 25;
    let drawH = drawW / cardAspect;

    const maxH = p.height * 0.18;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * cardAspect;
    }

    p.push();
    p.imageMode(p.CENTER);
    p.translate(this.x, this.y);
    if (this.rotated) p.rotate(p.HALF_PI);

    if (this.hovered) {
      p.noFill();
      p.stroke(0);
      p.strokeWeight(2);
      p.rectMode(p.CENTER);
      p.rect(0, 0, drawW + 10, drawH + 10, 10);
    }

    p.image(this.hidden ? this.imgBack : this.faceImage, 0, 0, drawW, drawH);
    p.pop();
  }
}
