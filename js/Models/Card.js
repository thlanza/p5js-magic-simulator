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
        this.onPlay = deps.onPlay;
    }

    contains(mx, my) {
           return mx > this.x - this.w/2 && mx < this.x + this.w/2 &&
           my > this.y - this.h/2 && my < this.y + this.h/2;
    }

    moveUp() {
        if (!this.enteredBattlefield) {
            this.y += (this.owner === 'Player1') ? -46 : 46;
            this.enteredBattlefield = true;
            this.hidden = false;
            if (this.onPlay) this.onPlay({ owner: this.owner, name: this.name });
        } else {
            this.rotated = !this.rotated;
        }
    }

    hover(mx, my) {
        this.hovered = this.contains(mx, my);
    }

    display() {
        const p = this.p;
        p.push();
        p.imageMode(p.CENTER);
        p.translate(this.x, this.y);
        if (this.rotated) p.rotate(p.HALF_PI);
        if (this.hovered) {
            p.noFill();
            p.stroke(0);
            p.strokeWeight(2);
            p.rectMode(p.CENTER);
            p.rect(0, 0, this.w + 6, this.h + 6, 10);
        }
        p.image(this.hidden ? this.imgBack : this.faceImage, 0, 0, this.w, this.h);
        p.pop();
    }
}