(function () {
    const proto = location.protocol === 'https:' ? 'wss': 'ws';
    const url = `${proto}://${location.host}/livereload`;

    let ws;
    function connect() {
        ws = new WebSocket(url);

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg.type === 'reload') {
                    console.log("[livereload] change detected: ", msg.file);
                    location.reload();
                }
            } catch {}
        };

        ws.onclose = () => {
            setTimeout(connect, 1000);
        }
    }

    connect();
})();