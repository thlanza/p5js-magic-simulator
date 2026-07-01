import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MyWebsocket } from "../js/Websocket/MyWebsocket.js";

/**
 * A minimal fake WebSocket implementation for unit tests.
 * We control:
 * - readyState
 * - onmessage callback
 * - addEventListener('open', ...)
 * - send calls
 * - firing "open" events
 */
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;

    this.send = vi.fn();
    this.onmessage = null;

    this._listeners = {
      open: [],
    };

    this.addEventListener = vi.fn((eventName, handler, options) => {
      if (!this._listeners[eventName]) this._listeners[eventName] = [];
      this._listeners[eventName].push({ handler, options });
    });
  }

  __fireOpen() {
    this.readyState = FakeWebSocket.OPEN;

    const listeners = this._listeners.open ?? [];
    // emulate browser behavior: { once: true } removes listener after one call
    this._listeners.open = listeners.filter((entry) => {
      entry.handler();
      return entry.options?.once !== true;
    });
  }

  __fireMessage(dataString) {
    if (typeof this.onmessage === "function") {
      this.onmessage({ data: dataString });
    }
  }
}

describe("MyWebsocket (client)", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    // Provide a browser-like WebSocket global
    globalThis.WebSocket = FakeWebSocket;

    // Match the OPEN constant used by MyWebsocket.send
    globalThis.WebSocket.OPEN = FakeWebSocket.OPEN;

    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("creates a WebSocket with the provided url", () => {
    const instance = new MyWebsocket("ws://localhost:1234");
    expect(instance.ws).toBeTruthy();
    expect(instance.ws.url).toBe("ws://localhost:1234");
  });

  it("ignores invalid JSON in onmessage and logs an error", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    fakeSocket.__fireMessage("not-json");

    expect(console.log).toHaveBeenCalledWith(
      "Erro no parsing dos dados no onMessage do Websocket"
    );
  });

  it("dispatches valid messages to handlers based on method", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    const handler = vi.fn();
    instance.on("turn", handler);

    fakeSocket.__fireMessage(JSON.stringify({ method: "turn", activePlayer: "2" }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ method: "turn", activePlayer: "2" });
  });

  it("supports multiple handlers for the same method", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    instance.on("life", handler1);
    instance.on("life", handler2);

    fakeSocket.__fireMessage(JSON.stringify({ method: "life", lifeTotals: { Player1: 20, Player2: 19 } }));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("queues messages if no handlers exist yet, then flushes them when on(method) is registered", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    // Message arrives before we register a handler
    fakeSocket.__fireMessage(JSON.stringify({ method: "numPlayers", number: 2 }));
    fakeSocket.__fireMessage(JSON.stringify({ method: "numPlayers", number: 1 }));

    const handler = vi.fn();
    instance.on("numPlayers", handler);

    // Handler should be called immediately for queued items (in order)
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0]).toEqual({ method: "numPlayers", number: 2 });
    expect(handler.mock.calls[1][0]).toEqual({ method: "numPlayers", number: 1 });
  });

  it("does NOT queue messages for a method once a handler exists; it emits directly", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    const handler = vi.fn();
    instance.on("turn", handler);

    fakeSocket.__fireMessage(JSON.stringify({ method: "turn", activePlayer: "1" }));
    fakeSocket.__fireMessage(JSON.stringify({ method: "turn", activePlayer: "2" }));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("emit(method, payload) calls registered handlers for that method", () => {
    const instance = new MyWebsocket("ws://example");

    const handler = vi.fn();
    instance.on("custom", handler);

    instance.emit("custom", { method: "custom", value: 123 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ method: "custom", value: 123 });
  });

  it("send(obj) sends immediately if ws.readyState is OPEN", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    fakeSocket.readyState = FakeWebSocket.OPEN;

    instance.send({ method: "ping", hello: true });

    expect(fakeSocket.send).toHaveBeenCalledTimes(1);
    expect(fakeSocket.send).toHaveBeenCalledWith(JSON.stringify({ method: "ping", hello: true }));
    expect(fakeSocket.addEventListener).not.toHaveBeenCalled();
  });

  it("send(obj) waits for open event if ws is not OPEN and uses { once: true }", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    // CONNECTING by default
    expect(fakeSocket.readyState).toBe(FakeWebSocket.CONNECTING);

    instance.send({ method: "hello" });

    // It should register an open listener with once:true
    expect(fakeSocket.addEventListener).toHaveBeenCalledTimes(1);
    const [eventName, handlerFn, options] = fakeSocket.addEventListener.mock.calls[0];
    expect(eventName).toBe("open");
    expect(typeof handlerFn).toBe("function");
    expect(options).toEqual({ once: true });

    // No send yet, because not open
    expect(fakeSocket.send).not.toHaveBeenCalled();

    // Fire open -> should send once
    fakeSocket.__fireOpen();
    expect(fakeSocket.send).toHaveBeenCalledTimes(1);
    expect(fakeSocket.send).toHaveBeenCalledWith(JSON.stringify({ method: "hello" }));

    // Fire open again -> should not send again (once:true behavior)
    fakeSocket.__fireOpen();
    expect(fakeSocket.send).toHaveBeenCalledTimes(1);
  });

  it("queues messages per-method and only flushes that method when handler is registered", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    fakeSocket.__fireMessage(JSON.stringify({ method: "A", value: 1 }));
    fakeSocket.__fireMessage(JSON.stringify({ method: "B", value: 2 }));
    fakeSocket.__fireMessage(JSON.stringify({ method: "A", value: 3 }));

    const handlerA = vi.fn();
    instance.on("A", handlerA);

    expect(handlerA).toHaveBeenCalledTimes(2);
    expect(handlerA.mock.calls[0][0]).toEqual({ method: "A", value: 1 });
    expect(handlerA.mock.calls[1][0]).toEqual({ method: "A", value: 3 });

    const handlerB = vi.fn();
    instance.on("B", handlerB);

    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledWith({ method: "B", value: 2 });
  });

  it("if a message has no method, it will be queued under 'undefined' and flushed if someone subscribes to undefined", () => {
    const instance = new MyWebsocket("ws://example");
    const fakeSocket = instance.ws;

    fakeSocket.__fireMessage(JSON.stringify({ hello: "world" }));

    const handler = vi.fn();
    instance.on(undefined, handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ hello: "world" });
  });
});