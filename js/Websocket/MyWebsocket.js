// Chama um handler sem deixar que um erro nele interrompa os demais.
function callSafely(handler, method, payload) {
    try {
        handler(payload);
    } catch (error) {
        console.error(`Erro no handler de '${method}'`, error);
    }
}

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

            // Toda mensagem do protocolo precisa de um 'method'
            if (typeof method !== "string") {
                console.warn("Mensagem sem 'method' ignorada", data);
                return;
            }

            const list = this.handlers[method];

            if (!list || list.length === 0) {
                if (!this.pending[method]) this.pending[method] = [];
                this.pending[method].push(data);
                return;
            }

            this.emit(method, data);
        };
    }

    on(method, cb) {
        if (!this.handlers[method]) this.handlers[method] = [];
        this.handlers[method].push(cb);

        const queued = this.pending[method];
        if (queued && queued.length > 0) {
            for (const payload of queued) callSafely(cb, method, payload);
            delete this.pending[method];
        }
    }

    emit(method, payload) {
        const list = this.handlers[method];
        if (!list) return;
        for (const handler of list) callSafely(handler, method, payload);
    }

    send(obj) {
        const json = JSON.stringify(obj);

        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(json);
            return;
        }

        if (this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.addEventListener('open', () => this.ws.send(json), { once: true });
            return;
        }

        // CLOSING ou CLOSED: o 'open' nunca virá.
        // (Com a reconexão do D1, aqui a mensagem passará a esperar a reconexão.)
        console.warn("Conexão fechada; mensagem não enviada", obj);
    }
}