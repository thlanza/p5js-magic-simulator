let cards1 = [];
let cards2 = [];
let flippedCards = [];
let matchedCards = [];
const colNum = 4;
const rowNum = 4;
let selected = [];
let img1, img2, img3, img4, img5, img6, img7, img8;
let timer = -1;
let delay = 60;
let cardsThatEnteredBattlefield = [];
let initialHandPlayer1 = [];
let initialHandPlayer2 = [];
let isPlayer1 = false;
let isPlayer2 = true;

let box1;
let box2;

let gameReadyToStart = false;
let websocket;

function preload() {
  img1 = loadImage('assets/forest.jpg');
  img2 = loadImage('assets/grizzly_bear.jpg');
  img3 = loadImage('assets/island.jpg');
  img4 = loadImage('assets/mountain.jpg');
  img5 = loadImage('assets/plains.jpg');
  img6 = loadImage('assets/rampant_growth.jpg');
  img7 = loadImage('assets/swamp.jpg');
  img8 = loadImage('assets/lightning_bolt.jpg');
}

function setup() {
  let playerId = null;
  websocket = new WebSocket("ws://localhost:9090");
  websocket.onmessage = (message) => {
    const response = JSON.parse(message.data);

    if (response.method === "connect") {
      playerId = response.playerId;
      console.log("Player id configurado ->" + playerId)
    }

    if (response.method === "numPlayers") {
      if (response.number === 1) {
        isPlayer1 = true;
        isPlayer2 = false;
      }
      if (response.number === 2) {
        gameReadyToStart = true;
      }
    }
  }
  createCanvas(windowWidth, windowHeight);
  prepareDeck();

  box1 = {
    x: width * 0.05,
    y: height * 0.08,
    w: width * 0.9,
    h: height * 0.42
  }

  box2 = {
    x: width * 0.05,
    y: height * 0.50,
    w: width * 0.9,
    h: height * 0.42
  }

  const cardWidth = width * 0.06;
  const cardHeight = height * 0.16;
  const spacing = (width - cardWidth * colNum) / (colNum + 1);

  for (let i = 0; i < colNum; i++) {
      const x = spacing + i * (cardWidth + spacing);
      const img1 = selected.pop();
      const img2 = selected.pop();
      initialHandPlayer1.push(new Card(x, height * 0.19, cardWidth, cardHeight, `Player1 ${i + 1}`, 'Player1', img1));
      initialHandPlayer2.push(new Card(x, height * 0.65, cardWidth, cardHeight, `Player2 ${i + 1}`, 'Player2', img2));
  }
}

function draw() {
  background(220);

  //Player1
  fill(130, 139, 20);
  stroke(0);
  rect(box1.x, box1.y, box1.w, box1.h, 10);

  fill(170, 160, 150);
  stroke(0);
  rect(box2.x, box2.y, box2.w, box2.h, 10);

  if (gameReadyToStart) {
        // for (let card of cards1) {
        //   card.hover();
        //   card.display();
        // }
      //  if (isPlayer1) {
      //   console.log("Player 1")
      //   for (let card of initialHandPlayer1) {
      //     card.hover();
      //     card.display();
      //   }
      //  } else {
      //   console.log("Player 2");
      //   for (let card of initialHandPlayer2) {
      //     card.hover();
      //     card.display();
      //   }
      //  }

      dealCards();
       if (isPlayer1) {
        console.log("is Player 1")
       }

       if (isPlayer2) {
        console.log("is Player 2")
       }
  }

  // Handle flip comparison
  if (flippedCards.length === 2 && frameCount - timer > delay) {
    const [c1, c2] = flippedCards;

    if (c1.picked === c2.picked) {
      c1.set = true;
      c2.set = true;
      matchedCards.push(c1, c2);
    } else {
      c1.isFaceUp = false;
      c2.isFaceUp = false;
    }

    flippedCards = [];
    timer = -1;
  }

}

function prepareDeck() {
  const faceImages = [
    img1, img2, img3, img4,
    img5, img6, img7, img8
  ];
  selected = [];

  for (let img of faceImages) {
    selected.push(img);
    selected.push(img); // duplicate each image
  }

  shuffle(selected, true);
}


let redDeck = ["mountain, lightning_bolt"];
let greenDeck = ["forest", "grizzly_bear"];

function dealCards() {
  for (i = 1; i < 8; i++) {
    const OneTwo = Math.floor(Math.random() * 2) + 1;
    console.log("OneTwo", OneTwo);
  }
}

function mouseClicked() {

  for (let i = 0; i < cards1.length; i++) {
    let card = cards1[i];
    if (
      mouseX > card.x - card.w / 2 &&
      mouseX < card.x + card.w / 2 &&
      mouseY > card.y - card.h / 2 &&
      mouseY < card.y + card.h / 2
    ) {
      console.log(`You clicked on Player1 card ${i + 1} ->>>>>>>> ${card.label}`);
      card.moveUp(card.label);
      break;
    }
  }

  for (let i = 0; i < cards2.length; i++) {
    let card = cards2[i];
    if (
      mouseX > card.x - card.w / 2 &&
      mouseX < card.x + card.w / 2 &&
      mouseY > card.y - card.h / 2 &&
      mouseY < card.y + card.h / 2
    ) {
      console.log(`You clicked on Player2 card ${i + 1} ->>>>>>>>> ${card.label}`);
      card.moveUp(card.label);
      break;
    }
  }
}
   

class Card {
  constructor(x, y, w, h, label, player, picked) {
    this.enteredBattlefield = false;
    this.x = x;
    this.y = y; 
    this.w = w;
    this.h = h;
    this.label = label;
    this.player = player;
    this.picked = picked;
    this.isFaceUp = true;
    this.set = false;
    this.hoverBool = false;
    this.rotated = false;
  }

  body() {
    rectMode(CENTER);
    fill(this.set ? color(150, 255, 150) : this.hoverBool ? 160 : 200);
    rect(this.x, this.y, this.w, this.h, 10);
  }

  rotateCard() {
    this.rotated = true;
  }

  moveUp(label) {
    if (this.label === label && this.enteredBattlefield === false) {
      this.player === 'Player1' ? this.y = this.y + 46 : this.y = this.y - 46;
      this.enteredBattlefield = true;
    } else {
      this.rotateCard();
    }
    
  }


  hover() {
    this.hoverBool = (
      mouseX > this.x - this.w / 2 &&
      mouseX < this.x + this.w / 2 &&
      mouseY > this.y - this.h / 2 &&
      mouseY < this.y + this.h / 2
    );
  }

  display() {
    if (this.isFaceUp || this.set) {
    imageMode(CENTER);
    push();
    translate(this.x, this.y);

    if (this.rotated) {
      rotate(HALF_PI); 
    }

    fill(150, 255, 150);

    image(this.picked, 0, 0, this.w, this.h);

    pop();
  }
  }
}
