let handP1 = [];
let handP2 = [];
let cards1 = []; // Card instances for P1
let cards2 = []; // Card instances for P2
let order = null;
let activePlayer = null;
let websocket;
let gameReadyToStart = false;

let imgForest, imgBear, imgMountain, imgBolt, imgBack;
let cardsMap;

// End Turn button geometry
let endTurnBtn = { x: 320, y: 10, w: 160, h: 60 };

const iAmPlayer1 = () => order === '1';
const iAmPlayer2 = () => order === '2';
const iAmActive = () => order != null && activePlayer === order;

function preload() {
  imgForest = loadImage('assets/forest.jpg');
  imgBear = loadImage('assets/grizzly_bear.jpg');
  imgMountain = loadImage('assets/mountain.jpg');
  imgBolt = loadImage('assets/lightning_bolt.jpg');
  imgBack = loadImage('assets/card-back.jpg');
}

function setup() {
  createCanvas(windowWidth, windowHeight);

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
      console.log("order", response.order);

      if (iAmPlayer1()) {
        dealCardsOnce(handP1, ['mountain', 'lightning_bolt']);
      }
      if (iAmPlayer2()) {
        dealCardsOnce(handP2, ['forest', 'grizzly_bear']);
      }

      buildHands();
    }

    if (response.method === 'numPlayers') {
      gameReadyToStart = (response.number === 2);
    }

    if (response.method === 'disconnect') {
      gameReadyToStart = false;
    }

    // NEW: server tells everyone whose turn it is
    if (response.method === 'turn') {
      activePlayer = response.activePlayer;
      // console.log('Turn is now for Player', activePlayer);
    }

    if (response.method === 'cardPlayed') {
      const { owner, name } = response;

      const cardW = width * 0.06;
      const cardH = height * 0.16;
      const spacing = cardW * 0.3;

      const targetArray = owner === 'Player1' ? cards1 : cards2;
      const idx = targetArray.filter(c => c.enteredBattlefield && c.owner === owner).length;
      const x = (width * 0.07) + idx * (cardW + spacing);
      const y = owner === 'Player1' ? (height * 0.86 - 46) : (height * 0.14 + 46);

      targetArray.push(
        new Card(x, y, cardW, cardH, name, owner, cardsMap[name], false)
      );
      targetArray[targetArray.length - 1].enteredBattlefield = true;
    }
  };

  initBoxes();
}

function draw() {
  background(220);
  drawBoxes();

  if (!order) return;


  for (const c of [...cards1, ...cards2]) { c.hover(); c.display(); }

  drawTurnBanner();
  drawEndTurnButton();
}

function keyPressed() {
  if (key === 't' || key === 'T') {
    sendEndTurn();
  }
}

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
  const cardW = width * 0.06;
  const cardH = height * 0.16;

  cards1 = [];
  cards2 = [];

  const spacing = cardW * 0.3;

  for (let i = 0; i < handP1.length; i++) {
    const x = (width * 0.07) + i * (cardW + spacing);
    const y = height * 0.86;
    const name = handP1[i];

    const hidden = !iAmPlayer1();
    cards1.push(new Card(x, y, cardW, cardH, name, 'Player1', cardsMap[name], hidden));
  }

  for (let i = 0; i < handP2.length; i++) {
    const x = (width * 0.07) + i * (cardW + spacing);
    const y = height * 0.14;
    const name = handP2[i];

    const hidden = !iAmPlayer2();
    cards2.push(new Card(x, y, cardW, cardH, name, 'Player2', cardsMap[name], hidden));
  }
}

function mouseClicked() {
  // End Turn button click
  if (mouseX >= endTurnBtn.x && mouseX <= endTurnBtn.x + endTurnBtn.w &&
      mouseY >= endTurnBtn.y && mouseY <= endTurnBtn.y + endTurnBtn.h) {
    sendEndTurn();
    return;
  }

  // Play card (only if my turn)
  if (!iAmActive()) return;
  const mine = iAmPlayer1() ? cards1 : cards2;

  for (const card of mine) {
    if (card.contains(mouseX, mouseY)) {
      card.moveUp();
      break;
    }
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

  contains(mouseXPos, mouseYPos) {
    return mouseXPos > this.x - this.w/2 && mouseXPos < this.x + this.w/2 &&
           mouseYPos > this.y - this.h/2 && mouseYPos < this.y + this.h/2;
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
      }))
    } else {
      this.rotated = !this.rotated;
    }
  }

  hover() {
    this.hovered = this.contains(mouseX, mouseY);
  }

  display() {
    push();
    imageMode(CENTER);
    translate(this.x, this.y);
    if (this.rotated) rotate(HALF_PI);
    if (this.hovered) {
      noFill(); stroke(0); strokeWeight(2);
      rectMode(CENTER); rect(0, 0, this.w + 6, this.h + 6, 10);
    }
    image(this.hidden ? imgBack : this.faceImage, 0, 0, this.w, this.h);
    pop();
  }
}

let box1, box2;
function initBoxes() {
  box1 = { x: width*0.05, y: height*0.08, w: width*0.9, h: height*0.42 };
  box2 = { x: width*0.05, y: height*0.50, w: width*0.9, h: height*0.42 };
}
function drawBoxes() {
  fill(130, 139, 20); stroke(0); rect(box1.x, box1.y, box1.w, box1.h, 10);
  fill(170, 160, 150); stroke(0); rect(box2.x, box2.y, box2.w, box2.h, 10);
}

function drawTurnBanner() {
  const label = activePlayer ? `Turn: Player ${activePlayer}` : 'Turn: ?';
  const mine  = order ? `You are Player ${order}${iAmActive() ? ' (ACTIVE)' : ''}` : 'You are ?';

  noStroke();
  fill(0, 0, 0, 160);
  rect(10, 10, 290, 60, 8);

  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text(label, 20, 18);
  text(mine, 20, 42);
}

function drawEndTurnButton() {
  const isEnabled = iAmActive() && gameReadyToStart;
  const isHover =
    mouseX >= endTurnBtn.x && mouseX <= endTurnBtn.x + endTurnBtn.w &&
    mouseY >= endTurnBtn.y && mouseY <= endTurnBtn.y + endTurnBtn.h;

  push();
  noStroke();
  fill(isEnabled ? (isHover ? 30 : 50) : 90, 140, 40, isEnabled ? 230 : 120);
  rect(endTurnBtn.x, endTurnBtn.y, endTurnBtn.w, endTurnBtn.h, 8);

  fill(255);
  textSize(14);
  textAlign(CENTER, CENTER);
  text(isEnabled ? 'End Turn (T)' : 'Waiting...', endTurnBtn.x + endTurnBtn.w/2, endTurnBtn.y + endTurnBtn.h/2);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initBoxes();
  if (order) buildHands();
}

function getWsURL() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}`;
}
