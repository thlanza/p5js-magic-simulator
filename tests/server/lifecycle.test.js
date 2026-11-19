import { describe, it, expect, vi, afterEach } from "vitest";
import {
  importFreshServerModule,
  createFakeWsConnection,
  createFakeWsRequest,
  getHttpServerMock,
} from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("server lifecycle", () => {
  it("does not start listening just by being imported", async () => {
    await importFreshServerModule();
    const httpServer = await getHttpServerMock();

    expect(httpServer.listen).not.toHaveBeenCalled();
  });

  it("start() makes the HTTP server listen exactly once", async () => {
    const { serverModule } = await importFreshServerModule();
    const httpServer = await getHttpServerMock();

    serverModule.start();

    expect(httpServer.listen).toHaveBeenCalledTimes(1);
  });

  it("stop() shuts down the WebSocket server and closes the HTTP server", async () => {
    const { serverModule, wsServerInstance } = await importFreshServerModule();
    const httpServer = await getHttpServerMock();

    serverModule.stop();

    expect(wsServerInstance.shutDown).toHaveBeenCalledTimes(1);
    expect(httpServer.close).toHaveBeenCalledTimes(1);
  });

  it("accepts /livereload sockets and sends them reload messages on file changes", async () => {
    const { requestHandler, watcherHandlers } = await importFreshServerModule();

    const livereloadConnection = createFakeWsConnection();
    requestHandler(createFakeWsRequest({ pathname: "/livereload", connection: livereloadConnection }));

    // chokidar registered add/change/unlink listeners
    expect(typeof watcherHandlers.add).toBe("function");
    expect(typeof watcherHandlers.change).toBe("function");
    expect(typeof watcherHandlers.unlink).toBe("function");

    // A file change sends a reload message to the livereload client
    watcherHandlers.change("/some/file.js");

    expect(livereloadConnection.sendUTF).toHaveBeenCalledTimes(1);
    const sentPayload = JSON.parse(livereloadConnection.sendUTF.mock.calls[0][0]);
    expect(sentPayload).toEqual({ type: "reload", file: "/some/file.js" });
  });
});