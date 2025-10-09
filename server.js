const http = require('http');
const express = require("express");
const uuid = require('uuid').v4
const { server: WebSocketServer } = require('websocket');

const app = express();
app.use("/js", express.static(__dirname + '/js'));
app.use('/assets', express.static(__dirname + '/assets'));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

const PORT = process.env.PORT || 5500;
const httpServer = http.createServer(app);
httpServer.listen(PORT, () => console.log(`HTTP escutando na porta ${PORT}`));

const wsServer = new WebSocketServer({ httpServer });

let players = [];
let activePlayer = '1';

function broadcast(payload) {
    const json = JSON.stringify(payload);
    for (const player of players) {
        try { 
            player.connection.send(json);
        }
        catch (e) { 
            console.log('Broadcast error', e); 
        }
    }
}

function getPlayerByConnection(connection) {
    return players.find(p => p.connection === connection);
}


wsServer.on("request", request => {
    const connection = request.accept(null, request.origin);

    console.log("request accepted");

    if (players.length >= 2) {
        connection.send(JSON.stringify({ method: "roomFull" }));
        connection.close();
        return;
    }

    const playerId = uuid();
    const order = players.length === 0 ? "1" : "2";
    let playerInfo = { playerId, order, connection };
    players.push(playerInfo);

    connection.send(JSON.stringify({
        method: "connect",
        playerId,
        order
    }));

    if (players.length === 2 && (activePlayer !== '1' && activePlayer !== '2')) {
        activePlayer = '1';
    }

    broadcast({ method: "numPlayers", number: players.length });
    broadcast({ method: "turn", activePlayer});

    connection.on('message', message => {
        let result;
        try {
            result = JSON.parse(message.utf8Data);
        } catch(error) {
            console.log("JSON inválido vindo do cliente", error);
            return;
        }

        if (result.method === "firstHand") {
            const me = getPlayerByConnection(connection);
            const otherPlayers = players.filter(p => p.playerId !== playerId);
            for (const other of otherPlayers) {
                const payload = {
                    method: 'currentPlayers',
                    player: me.playerId
                };
                try {
                    other.connection.send(JSON.stringify(payload));
                } catch(error) {
                    console.log("Erro no onMessage do servidor", error);
                }
            }
        }

        if (result.method === "endTurn") {
            const me = getPlayerByConnection(connection);
            if (!me) return;

            if (players.length < 2) return;

            if (me.order !== activePlayer) return;

            activePlayer = (activePlayer === '1') ? '2': '1';
            broadcast({ method: 'turn', activePlayer});
        }

        if (result.method === "playCard") {
            const me = getPlayerByConnection(connection);
            if (!me) return;
            const other = players.filter(p => p.playerId !== me.playerId);
            const payload = JSON.stringify({
                method: "cardPlayed",
                owner: result.owner,
                name: result.name
            });
            try {
                other[0].connection.send(payload);
            } catch(error) {
                console.log("Erro no cardPlayed no servidor", error);
            }
        }
    })

    connection.on('close', () => {
        const leaving = getPlayerByConnection(connection);
        if (leaving) {
            players - players.filter(p => p.playerId !== leaving.playerId);
        }

        // If active player left, give turn to whoever remains (default '1')
    if (players.length === 1) {
      activePlayer = players[0].order; // whoever is left
    }
    if (players.length === 0) {
      activePlayer = '1'; // reset room for next game
    }
        broadcast({ method: "disconnect", playerId: leaving?.playerId });
        broadcast({ method: "numPlayers", number: players.length });
        broadcast({ method: "turn", activePlayer });
    })   
});



