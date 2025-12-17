export class MyWebsocket {
    constructor(url) {
        this.ws = new WebSocket(url);
        this.handlers = {};
        this.pending = {};

        this.ws.onmessage = (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch {
                console.log("Erro no parsing dos dados no onMessage do Websocket");
                return;
            }

            const method = data?.method;

            const list = this.handlers[method];

            if (!list || list.length === 0) {
                if (!this.pending[method]) this.pending[method] = [];
                this.pending[method].push(data);
                return;
            }

            this.emit(method, data);
        }
    }

    on(method, cb) {
        if (!this.handlers[method]) this.handlers[method] = [];
        this.handlers[method].push(cb);

        const queued = this.pending[method];
        if (queued && queued.length > 0) {
            for (const payload of queued) cb(payload);
            delete this.pending[method];
        }
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