import { describe, it, expect, vi, afterEach } from "vitest";
import { loadSketch } from "./test-utils/sketch-harness.js";
import { CONSTANTS } from "../js/CONSTANTS.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const DELAY = CONSTANTS.SPELL_RESOLVE_DELAY_MS;
const BOLT = "assets/lightning_bolt.jpg";
const MOUNTAIN = "assets/mountain.jpg";
const CARD_BACK = "assets/card-back.jpg";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Draws one frame. Returns the asset path of every image drawn
// and how many cards were drawn rotated (tapped).
function drawFrame(sketch) {
  const { p } = sketch;
  p.image.mockClear();
  p.rotate.mockClear();
  p.draw();
  return {
    images: p.image.mock.calls.map(([image]) => image?.path),
    tappedCards: p.rotate.mock.calls.length,
  };
}

function count(list, value) {
  return list.filter((item) => item === value).length;
}

// Last message of a given method that the sketch sent to the server.
function lastSent(sketch, method) {
  return sketch.sent.filter((message) => message.method === method).at(-1);
}

// Position of a card in Player1's hand (same formula as sketch.js, until C4).
function player1HandSlot(p, index) {
  const cardW = p.width * 0.06;
  const spacing = cardW * 0.3;
  return { x: p.width * 0.07 + index * (cardW + spacing), y: p.height * 0.86 };
}

function clickAt(sketch, { x, y }) {
  sketch.p.mouseX = x;
  sketch.p.mouseY = y;
  sketch.p.mouseClicked();
}

// I am Player2 (deck: forest + grizzly_bear, so no bolts or mountains in my hand);
// the opponent has 7 hidden cards.
async function startAsPlayer2() {
  const sketch = await loadSketch();
  sketch.receive("connect", { playerId: "uuid-2", order: "2" });
  sketch.receive("numPlayers", { number: 2 });
  sketch.receive("opponentHandCount", { owner: "Player1", count: 7 });
  return sketch;
}

// I am Player1 with a predictable hand: [mountain, bolt, bolt, bolt, bolt, bolt, bolt].
// The game is ready and it is my turn.
async function startAsPlayer1() {
  const sketch = await loadSketch();
  vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValue(0.9);
  sketch.receive("connect", { playerId: "uuid-1", order: "1" });
  sketch.receive("numPlayers", { number: 2 });
  sketch.receive("turn", { activePlayer: "1" });
  return sketch;
}

// Same as above, then plays the mountain and casts a bolt paid with it.
async function startAsPlayer1AndCastABolt() {
  const sketch = await startAsPlayer1();
  clickAt(sketch, player1HandSlot(sketch.p, 0)); // mountain -> battlefield
  clickAt(sketch, player1HandSlot(sketch.p, 1)); // bolt, paid with the mountain
  return sketch;
}

// ---------------------------------------------------------------------------
// Turn banner (B2)
// ---------------------------------------------------------------------------

describe("sketch: what the turn banner is told", () => {
  it("tells the banner the room is full when the server rejects the connection", async () => {
    const sketch = await loadSketch();

    sketch.receive("roomFull");
    sketch.p.draw();

    expect(sketch.ui.drawTurnBanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ roomFull: true })
    );
  });

  it("tells the banner the game is not ready while waiting for an opponent", async () => {
    const sketch = await loadSketch();

    sketch.receive("connect", { playerId: "uuid-1", order: "1" });
    sketch.receive("numPlayers", { number: 1 });
    sketch.p.draw();

    expect(sketch.ui.drawTurnBanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: "1", gameReadyToStart: false })
    );
  });

  it("tells the banner the game is ready when both players are connected", async () => {
    const sketch = await loadSketch();

    sketch.receive("connect", { playerId: "uuid-1", order: "1" });
    sketch.receive("numPlayers", { number: 2 });
    sketch.p.draw();

    expect(sketch.ui.drawTurnBanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ gameReadyToStart: true })
    );
  });

  it("goes back to 'not ready' when the opponent leaves", async () => {
    const sketch = await loadSketch();

    sketch.receive("connect", { playerId: "uuid-1", order: "1" });
    sketch.receive("numPlayers", { number: 2 });
    sketch.receive("numPlayers", { number: 1 });
    sketch.p.draw();

    expect(sketch.ui.drawTurnBanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ gameReadyToStart: false })
    );
  });
});

// ---------------------------------------------------------------------------
// Spells (B6)
// ---------------------------------------------------------------------------

describe("sketch: spells stay on the battlefield for a while, then leave", () => {
  it("an opponent's spell is shown on the battlefield, then leaves after the delay", async () => {
    vi.useFakeTimers();
    const sketch = await startAsPlayer2();

    sketch.receive("cardPlayed", { owner: "Player1", name: "lightning_bolt" });

    const frame = drawFrame(sketch);
    expect(count(frame.images, CARD_BACK)).toBe(6); // it left the opponent's hand
    expect(count(frame.images, BOLT)).toBe(1);      // and is visible on the battlefield

    vi.advanceTimersByTime(DELAY - 1);
    expect(count(drawFrame(sketch).images, BOLT)).toBe(1); // still visible

    vi.advanceTimersByTime(1);
    expect(count(drawFrame(sketch).images, BOLT)).toBe(0); // gone
  });

  it("an opponent's land stays on the battlefield", async () => {
    vi.useFakeTimers();
    const sketch = await startAsPlayer2();

    sketch.receive("cardPlayed", { owner: "Player1", name: "mountain" });
    vi.advanceTimersByTime(DELAY);

    const frame = drawFrame(sketch);
    expect(count(frame.images, CARD_BACK)).toBe(6);
    expect(count(frame.images, MOUNTAIN)).toBe(1);
  });

  it("my spell is cast, shown on the battlefield, then leaves after the delay", async () => {
    vi.useFakeTimers();
    const sketch = await startAsPlayer1AndCastABolt();

    expect(sketch.sent).toContainEqual({ method: "playCard", owner: "Player1", name: "lightning_bolt" });
    expect(count(drawFrame(sketch).images, BOLT)).toBe(6); // 5 in hand + 1 on the battlefield

    vi.advanceTimersByTime(DELAY);
    expect(count(drawFrame(sketch).images, BOLT)).toBe(5); // only the 5 in hand
  });

  it("a spell on the battlefield cannot be clicked (it cannot be tapped)", async () => {
    vi.useFakeTimers();
    const sketch = await startAsPlayer1AndCastABolt();

    // The bolt went up 46px from hand slot 1 to the battlefield
    const slot = player1HandSlot(sketch.p, 1);
    clickAt(sketch, { x: slot.x, y: slot.y - 46 });

    // Only the mountain (tapped to pay for the bolt) is drawn rotated
    expect(drawFrame(sketch).tappedCards).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Hand count (B7)
// ---------------------------------------------------------------------------

describe("sketch: the hand count reported to the server", () => {
  it("is updated every time I play a card from my hand", async () => {
    const sketch = await startAsPlayer1();

    clickAt(sketch, player1HandSlot(sketch.p, 0)); // mountain
    expect(lastSent(sketch, "handCount")).toEqual({ method: "handCount", owner: "Player1", count: 6 });

    clickAt(sketch, player1HandSlot(sketch.p, 1)); // bolt
    expect(lastSent(sketch, "handCount")).toEqual({ method: "handCount", owner: "Player1", count: 5 });
  });

  it("reflects the cards actually in my hand when the opponent (re)joins", async () => {
    const sketch = await startAsPlayer1();
    clickAt(sketch, player1HandSlot(sketch.p, 0)); // mountain: 6 cards left in hand

    // Opponent leaves and joins again: the sketch reports its hand once more
    sketch.receive("numPlayers", { number: 1 });
    sketch.receive("numPlayers", { number: 2 });

    expect(lastSent(sketch, "handCount")).toEqual({ method: "handCount", owner: "Player1", count: 6 });
  });
});