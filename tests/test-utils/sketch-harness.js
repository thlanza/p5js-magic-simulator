import { vi } from "vitest";
import { makeFakeP } from "./p5-mocks.js";

/**
 * Test harness for js/sketch.js.
 *
 * sketch.js runs `new p5(mySketch)` when imported, so we:
 *  - provide a fake global p5 that hands our fake `p` to the sketch;
 *  - replace MyWebsocket, to simulate server messages and capture what the sketch sends;
 *  - replace UI, to see what the sketch asked to draw (without testing drawing itself).
 *
 * vi.doMock (not vi.mock), as in tests/server/helpers.js: it applies to the
 * dynamic import done by loadSketch(). Paths are relative to THIS file.
 */

const socket = { handlers: {}, sent: [] };
let uiInstance = null;

vi.doMock("../../js/Websocket/MyWebsocket.js", () => ({
  MyWebsocket: class {
    constructor(url) {
      this.url = url;
    }
    on(method, callback) {
      (socket.handlers[method] ??= []).push(callback);
    }
    send(message) {
      socket.sent.push(message);
    }
  },
}));

vi.doMock("../../js/UI/ui.js", () => ({
  UI: class {
    constructor(p) {
      this.p = p;
      this.drawBoxes = vi.fn();
      this.drawLife = vi.fn();
      this.drawTurnBanner = vi.fn();
      this.drawEndTurnButton = vi.fn();
      uiInstance = this;
    }
  },
}));

function makeSketchP() {
  return {
    ...makeFakeP(),
    loadImage: vi.fn((path) => ({ path })),
    createCanvas: vi.fn(),
    resizeCanvas: vi.fn(),
    background: vi.fn(),
    windowWidth: 1280,
    windowHeight: 720,
    width: 1280,
    height: 720,
    mouseX: 0,
    mouseY: 0,
    key: "",
  };
}

/**
 * Loads a fresh copy of sketch.js and runs preload() + setup().
 * Returns:
 *  - p:       the fake p5 instance (call p.draw(), p.mouseClicked(), ...)
 *  - ui:      the fake UI (inspect drawTurnBanner calls, ...)
 *  - receive: simulates a message from the server
 *  - sent:    messages the sketch sent to the server
 */
export async function loadSketch() {
  vi.resetModules();
  socket.handlers = {};
  socket.sent = [];
  uiInstance = null;

  const p = makeSketchP();
  vi.stubGlobal("p5", class {
    constructor(sketch) {
      sketch(p);
    }
  });
  vi.stubGlobal("location", { protocol: "http:", host: "localhost:5500" });

  await import("../../js/sketch.js");
  p.preload();
  p.setup();

  return {
    p,
    ui: uiInstance,
    receive(method, payload = {}) {
      for (const handler of socket.handlers[method] ?? []) {
        handler({ method, ...payload });
      }
    },
    sent: socket.sent,
  };
}