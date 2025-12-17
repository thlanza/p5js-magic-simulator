import { CONSTANTS } from "./CONSTANTS.js";
import { Card } from "./Models/Card.js";
import { Game } from "./Models/Game.js";
import { UI } from "./UI/ui.js";
import { MyWebsocket } from "./Websocket/MyWebsocket.js";

let rules;

const mySketch = (p) => {
  let handP1 = [];
  let handP2 = [];
  let cards1 = []; 
  let cards2 = []; 
  let ui;
  let order = null;
  let activePlayer = null;
  let socket;
  let gameReadyToStart = false;
  let box1, box2;

  let imgForest, imgBear, imgMountain, imgBolt, imgBack;
  let cardsMap;

  const endTurnBtn = { x: CONSTANTS.BUTTON_MEASUREMENTS.x, 
    y: CONSTANTS.BUTTON_MEASUREMENTS.y, 
    w: CONSTANTS.BUTTON_MEASUREMENTS.w, 
    h: CONSTANTS.BUTTON_MEASUREMENTS.h 
  };

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
    rules = new Game();
    p.createCanvas(p.windowWidth, p.windowHeight);
    ui = new UI(p);

    cardsMap = {
      forest: imgForest,
      grizzly_bear: imgBear,
      mountain: imgMountain,
      lightning_bolt: imgBolt,
    };

    socket = new MyWebsocket(getWsURL());

    socket.on('connect', (res) => {
      order = res.order;

      if (iAmPlayer1()) {
        dealCardsOnce(handP1, ['mountain', 'lightning_bolt']);
        socket.send({ method: 'handCount', owner: 'Player1', count: handP1.length });
      }
      if (iAmPlayer2()) {
        dealCardsOnce(handP2, ['forest', 'grizzly_bear']);
        socket.send({ method: 'handCount', owner: 'Player2', count: handP2.length });
      }

      buildHands();
    });

    socket.on('numPlayers', (res) => {
      gameReadyToStart = (res.number === 2);
      if (gameReadyToStart) {
        const owner = iAmPlayer1() ? 'Player1': 'Player2';
        const count = iAmPlayer1() ? handP1.length : handP2.length;
        socket.send({ method: 'handCount', owner, count });
      }
    });

    socket.on('disconnect', () => { gameReadyToStart = false });
    socket.on('turn', (res) => { 
      activePlayer = res.activePlayer;
      rules.setActivePlayerOrder(activePlayer); 
    });

    socket.on('cardPlayed', ({ owner, name }) => {
      const cardW = p.width * 0.06;
      const cardH = p.height * 0.16;
      const spacing = cardW * 0.3;

      const target = owner === 'Player1' ? cards1 : cards2;
      const idx = target.filter(card => card.enteredBattlefield && card.owner === owner).length;
      const x = (p.width * 0.07) + idx * (cardW + spacing);
      const y = owner === 'Player1' ? (p.height * 0.86 - 46) : (p.height * 0.14 + 46);

      const handIndex = target.findIndex(card => !card.enteredBattlefield && card.owner === owner);
      if (handIndex !== -1) target.splice(handIndex, 1);

      target.push(new Card(x, y, cardW, cardH, name, owner, cardsMap[name], false, { p, imgBack }));
      target[target.length - 1].enteredBattlefield = true;
    });

    socket.on('opponentHandCount', ({ owner, count}) => {
      const cardW = p.width * 0.06;
      const cardH = p.height * 0.16;
      const spacing = cardW * 0.3;

      const target = owner === 'Player1' ? cards1 : cards2;
      const isMine = (owner === 'Player1' && iAmPlayer1()) || (owner === 'Player2' && iAmPlayer2());
      if (isMine) return;

      for (let i = target.length -1; i >= 0; i--) {
        if (!target[i].enteredBattlefield && target[i].owner === owner) {
          target.splice(i, 1);
        }
      }

      for (let i = 0; i < count; i++) {
        const x = (p.width * 0.07) + i * (cardW + spacing);
        const y = owner === 'Player1' ? p.height * 0.86 : p.height * 0.14;
        target.push(new Card(x, y, cardW, cardH, 'unknown', owner, null, true, { p, imgBack }))
      }
    })

    initBoxes();
  };


  function initBoxes() {
    box1 = { 
      x: p.width* CONSTANTS.COEFICIENTE_BOXES.box1.x, 
      y: p.height* CONSTANTS.COEFICIENTE_BOXES.box1.y, 
      w: p.width* CONSTANTS.COEFICIENTE_BOXES.box1.w,  
      h: p.height* CONSTANTS.COEFICIENTE_BOXES.box1.h 
    };
    box2 = { 
      x: p.width* CONSTANTS.COEFICIENTE_BOXES.box2.x, 
      y: p.height* CONSTANTS.COEFICIENTE_BOXES.box2.y, 
      w: p.width* CONSTANTS.COEFICIENTE_BOXES.box2.w,  
      h: p.height* CONSTANTS.COEFICIENTE_BOXES.box2.h
    };
  }

  p.draw = function () {
    p.background(220);
    ui.drawBoxes(box1, box2);
    ui.drawTurnBanner({
      activePlayer,
      order,
      isActive: iAmActive()
    });
    ui.drawEndTurnButton({
      btn: endTurnBtn,
      isEnabled: iAmActive() && gameReadyToStart,
      mouseX: p.mouseX,
      mouseY: p.mouseY
    })

    if (!order) return;

    for (const c of [...cards1, ...cards2]) {
      c.hover(p.mouseX, p.mouseY);
      c.display(); 
    }
  };

  p.keyPressed = function () {
    if (p.key === 't' || p.key === 'T') {
      sendEndTurn();
    }
  };

  p.mouseClicked = function () {
    const isEnabled = iAmActive() && gameReadyToStart;
    if (
      isEnabled &&
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
    if (!iAmActive() || !gameReadyToStart) return;
    socket.send({ method: 'endTurn' });
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
    const spacing = cardW * 0.3;

    cards1 = [];
    cards2 = [];

    const getBattlefieldCardsForOwner = (owner) => {
      const targetArray = owner === "Player1" ? cards1 : cards2;
      return targetArray.filter((cardInstance) => cardInstance.enteredBattlefield && cardInstance.owner === owner);
    };

    const make = (x, y, name, owner, hidden) =>
        new Card(x, y, cardW, cardH, name, owner, cardsMap[name], hidden, {
          p,
          imgBack,
          canPlay: ({ owner: playOwner, name: playName }) => {
            const battlefieldCardsForOwner = getBattlefieldCardsForOwner(playOwner);

            const decision = rules.canPlayCard({
              order,
              activePlayerOrder: activePlayer,
              gameReadyToStart,
              owner: playOwner,
              cardName: playName,
              battlefieldCardsForOwner,
            });

            if (decision.ok) {
              rules.applyEffects(decision.effects); 
            } else {
              console.log("Play blocked:", decision.reason);
            }

            return decision;
          },
          onPlay: ({ owner: playOwner, name: playName }) =>
            socket.send({ method: 'playCard', owner: playOwner, name: playName })
    });
  
    for (let i = 0; i < handP1.length; i++) {
      const x = (p.width * 0.07) + i * (cardW + spacing);
      const y = p.height * 0.86;
      const hidden = !iAmPlayer1();
      cards1.push(make(x, y, handP1[i], 'Player1', hidden));
    }

    for (let i = 0; i < handP2.length; i++) {
      const x = (p.width * 0.07) + i * (cardW + spacing);
      const y = p.height * 0.14;
      const hidden = !iAmPlayer2();
      cards2.push(make(x, y, handP2[i], 'Player2', hidden));
    }    
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



new p5(mySketch);
