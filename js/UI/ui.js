import { CONSTANTS } from "../CONSTANTS.js";



export class UI {
    constructor(p) {
      this.p = p;
    }

    drawBoxes(box1, box2) {
        const p = this.p;
        p.fill(CONSTANTS.COLORS.box1.r, CONSTANTS.COLORS.box1.g, CONSTANTS.COLORS.box2.b); 
        p.stroke(0); 
        p.rect(box1.x, box1.y, box1.w, box1.h, 10);
        p.fill(CONSTANTS.COLORS.box2.r, CONSTANTS.COLORS.box2.g, CONSTANTS.COLORS.box2.b); 
        p.stroke(0); 
        p.rect(box2.x, box2.y, box2.w, box2.h, 10);
    }

    drawTurnBanner({ activePlayer, order, isActive }) {
        const p = this.p;
        const label = activePlayer ? `Turno: Hora do Jogador ${activePlayer}` : 'Turno: Espere sua vez.';
        const mine  = order ? `Você é o jogador ${order}${isActive ? ' (ACTIVE)' : ''}` : 'Você é? ?';

        p.noStroke();
        p.fill(0, 0, 0, 160);
        p.rect(10, 10, 290, 60, 8);

        p.fill(255);
        p.textSize(16);
        p.textAlign(p.LEFT, p.TOP);
        p.text(label, 20, 18);
        p.text(mine, 20, 42);
    }

    drawEndTurnButton({ btn, isEnabled, mouseX, mouseY }) {
        const p = this.p;
        const isHover =
            mouseX >= btn.x && mouseX <= btn.x + btn.w &&
            mouseY >= btn.y && mouseY <= btn.y + btn.h;

        p.push();
        p.noStroke();
        p.fill(isEnabled ? (isHover ? 30 : 50) : 90, 140, 40, isEnabled ? 230 : 120);
        p.rect(btn.x, btn.y, btn.w, btn.h, 8);

        p.fill(255);
        p.textSize(14);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(isEnabled ? 'Finalizar Turno (T)' : 'Esperando...', btn.x + btn.w/2, btn.y + btn.h/2);
        p.pop();
    }

    drawLife({ lifeTotals }) {
        const p = this.p;
        p.push();
        p.noStroke();
        p.fill(0, 0, 0, 160);
        p.rect(p.width - 180, 10, 170, 60, 8);

        p.fill(255);
        p.textSize(14);
        p.textAlign(p.LEFT, p.TOP);
        p.text(`P1: ${lifeTotals.Player1}`, p.width - 170, 18);
        p.text(`P2: ${lifeTotals.Player2}`, p.width - 170, 40);
        p.pop();
    }
}