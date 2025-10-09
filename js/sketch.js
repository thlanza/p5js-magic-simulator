

const mySketch = (p) => {
  let handP1 = [];
  let handP2 = [];
  let cards1 = []; 
  let cards2 = []; 
  let order = null;
  let activePlayer = null;
  let websocket;
  let gameReadyToStart = false;

  let imgForest, imgBear, imgMountain, imgBolt, imgBack;
  let cardsMap;

  const endTurnBtn = { x: 320, y: 10, w: 160, h: 60 };

  const iAmPlayer1 = () => order === '1';
  const iAmPlayer2 = () => order === '2';
  const iAmActive  = () => order != null && activePlayer === order;

  p.preload = function () {
    imgForest = p.loadImage('assets/forest.jpg');
    imgBear   = p.loadImage('assets/grizzly_bear.jpg');
    imgMountain = p.loadImage('assets/mountain.jpg');
    imgBolt   = p.loadImage('assets/lightning_bolt.jpg');
    imgBack   = p.loadImage('assets/card-back.jpg');
  };

  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight);

    cardsMap = {
      forest: imgForest,
      grizzly_bear: imgBear,
      mountain: imgMountain,
      lightning_bolt: imgBolt,
    };

    websocket = new WebSocket(getWsURL());

    websocket.onmessage = (message) => {
      const response = JSON.parse(message.data);

      if (response.method === 'connect') {
        order = response.order;

        if (iAmPlayer1()) {
          dealCardsOnce(handP1, ['mountain', 'lightning_bolt']);
          websocket.send(JSON.stringify({ method: 'handCount', owner: 'Player1', count: handP1.length }));
        }
        if (iAmPlayer2()) {
          dealCardsOnce(handP2, ['forest', 'grizzly_bear']);
          websocket.send(JSON.stringify({ method: 'handCount', owner: 'Player2', count: handP2.length }));
        }

        buildHands();
      }

      if (response.method === 'numPlayers') {
        gameReadyToStart = (response.number === 2);
        if (gameReadyToStart) {
          const owner = iAmPlayer1() ? 'Player1' : 'Player2';
          const count = iAmPlayer1() ? handP1.length : handP2.length;
          websocket.send(JSON.stringify({ method: 'handCount', owner, count }));
        }
      }

      if (response.method === 'disconnect') {
        gameReadyToStart = false;
      }

      if (response.method === 'turn') {
        activePlayer = response.activePlayer;
      }

      if (response.method === 'cardPlayed') {
        const { owner, name } = response;

        const cardW = p.width * 0.06;
        const cardH = p.height * 0.16;
        const spacing = cardW * 0.3;

        const targetArray = owner === 'Player1' ? cards1 : cards2;
        const idx = targetArray.filter(c => c.enteredBattlefield && c.owner === owner).length;
        const x = (p.width * 0.07) + idx * (cardW + spacing);
        const y = owner === 'Player1' ? (p.height * 0.86 - 46) : (p.height * 0.14 + 46);

        const handIndex = targetArray.findIndex(card => !card.enteredBattlefield && card.owner === owner);
        if (handIndex !== -1) targetArray.splice(handIndex, 1);

        targetArray.push(new Card(x, y, cardW, cardH, name, owner, cardsMap[name], false));
        targetArray[targetArray.length - 1].enteredBattlefield = true;
      }

      if (response.method === 'opponentHandCount') {
        const { owner, count } = response;

        const cardW = p.width * 0.06;
        const cardH = p.height * 0.16;
        const spacing = cardW * 0.3;

        const targetArray = owner === 'Player1' ? cards1 : cards2;
        const isMyPerspective =
          (owner === 'Player1' && iAmPlayer1()) ||
          (owner === 'Player2' && iAmPlayer2());

        if (isMyPerspective) return;

        for (let i = targetArray.length - 1; i >= 0; i--) {
          if (!targetArray[i].enteredBattlefield && targetArray[i].owner === owner) {
            targetArray.splice(i, 1);
          }
        }

        for (let i = 0; i < count; i++) {
          const x = (p.width * 0.07) + i * (cardW + spacing);
          const y = owner === 'Player1' ? p.height * 0.86 : p.height * 0.14;
          targetArray.push(new Card(x, y, cardW, cardH, 'unknown', owner, null, true));
        }
      }
    };

    initBoxes();
  };

  p.draw = function () {
    p.background(220);
    drawBoxes();

    if (!order) return;

    for (const c of [...cards1, ...cards2]) {
      c.hover(p.mouseX, p.mouseY);
      c.display(); 
    }

    drawTurnBanner();
    drawEndTurnButton();
  };

  p.keyPressed = function () {
    if (p.key === 't' || p.key === 'T') {
      sendEndTurn();
    }
  };

  p.mouseClicked = function () {
    if (
      p.mouseX >= endTurnBtn.x && p.mouseX <= endTurnBtn.x + endTurnBtn.w &&
      p.mouseY >= endTurnBtn.y && p.mouseY <= endTurnBtn.y + endTurnBtn.h
    ) {
      sendEndTurn();
      return;
    }

    if (!iAmActive()) return;
    const mine = iAmPlayer1() ? cards1 : cards2;

    for (const card of mine) {
      if (card.contains(p.mouseX, p.mouseY)) {
        card.moveUp();
        break;
      }
    }
  };

  function sendEndTurn() {
    if (!iAmActive()) return;
    if (!gameReadyToStart) return;
    websocket.send(JSON.stringify({ method: 'endTurn' }));
  }

  function dealCardsOnce(targetHand, deckNames) {
    for (let i = 0; i < 7; i++) {
      const pick = deckNames[Math.floor(Math.random() * deckNames.length)];
      targetHand.push(pick);
    }
  }

  function buildHands() {
    const cardW = p.width * 0.06;
    const cardH = p.height * 0.16;

    cards1 = [];
    cards2 = [];

    const spacing = cardW * 0.3;

    for (let i = 0; i < handP1.length; i++) {
      const x = (p.width * 0.07) + i * (cardW + spacing);
      const y = p.height * 0.86;
      const name = handP1[i];

      const hidden = !iAmPlayer1();
      cards1.push(new Card(x, y, cardW, cardH, name, 'Player1', cardsMap[name], hidden));
    }

    for (let i = 0; i < handP2.length; i++) {
      const x = (p.width * 0.07) + i * (cardW + spacing);
      const y = p.height * 0.14;
      const name = handP2[i];

      const hidden = !iAmPlayer2();
      cards2.push(new Card(x, y, cardW, cardH, name, 'Player2', cardsMap[name], hidden));
    }
  }


  class Card {
    constructor(x, y, widthPx, heightPx, name, owner, faceImage, hidden) {
      this.x = x; this.y = y; this.w = widthPx; this.h = heightPx;
      this.name = name; this.owner = owner;
      this.faceImage = faceImage;
      this.hidden = hidden;
      this.enteredBattlefield = false;
      this.hovered = false;
      this.rotated = false;
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

        websocket?.send(JSON.stringify({
          method: 'playCard',
          owner: this.owner,
          name: this.name
        }));
      } else {
        this.rotated = !this.rotated;
      }
    }

    hover(mx, my) {
      this.hovered = this.contains(mx, my);
    }

    display() {
      p.push();
      p.imageMode(p.CENTER);
      p.translate(this.x, this.y);
      if (this.rotated) p.rotate(p.HALF_PI);
      if (this.hovered) {
        p.noFill(); p.stroke(0); p.strokeWeight(2);
        p.rectMode(p.CENTER); p.rect(0, 0, this.w + 6, this.h + 6, 10);
      }
      p.image(this.hidden ? imgBack : this.faceImage, 0, 0, this.w, this.h);
      p.pop();
    }
  }

  // ---------- UI drawing ----------

  let box1, box2;
  function initBoxes() {
    box1 = { x: p.width*0.05, y: p.height*0.08, w: p.width*0.9,  h: p.height*0.42 };
    box2 = { x: p.width*0.05, y: p.height*0.50, w: p.width*0.9,  h: p.height*0.42 };
  }
  function drawBoxes() {
    p.fill(130, 139, 20); p.stroke(0); p.rect(box1.x, box1.y, box1.w, box1.h, 10);
    p.fill(170, 160, 150); p.stroke(0); p.rect(box2.x, box2.y, box2.w, box2.h, 10);
  }

  function drawTurnBanner() {
    const label = activePlayer ? `Turno: Hora do ${activePlayer}` : 'Turno: Espere sua vez.';
    const mine  = order ? `Você é o jogador ${order}${iAmActive() ? ' (ACTIVE)' : ''}` : 'Você é? ?';

    p.noStroke();
    p.fill(0, 0, 0, 160);
    p.rect(10, 10, 290, 60, 8);

    p.fill(255);
    p.textSize(16);
    p.textAlign(p.LEFT, p.TOP);
    p.text(label, 20, 18);
    p.text(mine, 20, 42);
  }

  function drawEndTurnButton() {
    const isEnabled = iAmActive() && gameReadyToStart;
    const isHover =
      p.mouseX >= endTurnBtn.x && p.mouseX <= endTurnBtn.x + endTurnBtn.w &&
      p.mouseY >= endTurnBtn.y && p.mouseY <= endTurnBtn.y + endTurnBtn.h;

    p.push();
    p.noStroke();
    p.fill(isEnabled ? (isHover ? 30 : 50) : 90, 140, 40, isEnabled ? 230 : 120);
    p.rect(endTurnBtn.x, endTurnBtn.y, endTurnBtn.w, endTurnBtn.h, 8);

    p.fill(255);
    p.textSize(14);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(isEnabled ? 'End Turn (T)' : 'Waiting...', endTurnBtn.x + endTurnBtn.w/2, endTurnBtn.y + endTurnBtn.h/2);
    p.pop();
  }

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    initBoxes();
    if (order) buildHands();
  };

  function getWsURL() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}`;
  }
};

// boot it
new p5(mySketch);
