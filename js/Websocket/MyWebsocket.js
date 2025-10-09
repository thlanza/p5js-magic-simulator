export class MyWebsocket {
    constructor(url) {
        this.ws = new WebSocket(url);
        this.handlers = {};
        this.ws.onmessage = (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch {
                console.log("Erro no parsing dos dados no onMessage do Websocket");
                return;
            }
            this.emit(data.method, data);
        }
    }

    on(method, cb) {
        if (!this.handlers[method]) this.handlers[method] = [];
        this.handlers[method].push(cb);
    }

    emit(method, payload) {
        const list = this.handlers[method];
        if (!list) return;
        for (const fn of list) fn(payload);
    }

    send(obj) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(obj));
        } else {
            this.ws.addEventListener('open', () => this.ws.send(JSON.stringify(obj)), { once: true })
        }
    }
}