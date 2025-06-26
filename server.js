const http = require('http');
const app = require('express')();
const express = require("express");
const uuid = require('uuid').v4

app.use("/js", express.static(__dirname + '/js'));
app.use('/assets', express.static(__dirname + '/assets'));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

const CLIENT_PORT = process.env.CLIENT_PORT || 5500;
app.listen(CLIENT_PORT, () => console.log(`Client Port, escutando na porta ${CLIENT_PORT}`));

const websocketServer = require("websocket").server;
const httpServer = http.createServer();

const SERVER_PORT = process.env.SERVER_PORT || 9090;
httpServer.listen(SERVER_PORT, () => console.log(`Server Port, escutando na porta ${SERVER_PORT}`));


let players = [];
let playerInfo = {};

const wsServer = new websocketServer({
    "httpServer": httpServer
})

wsServer.on("request", request => {
    const connection = request.accept(null, request.origin);

    connection.on("close", () => {
        players.forEach(player => {
            if (player.playerId !== playerId) {
                const payload = {
                    "method": "disconnect",
                    "playerId": playerId
                }
                player.connection.send(JSON.stringify(payload));
            }
        })
        players = players.filter(player => player.playerId !== playerId);
    });

    const playerId = randomPlayerId();

    playerInfo = {
        "connection": connection,
        "playerId": playerId,
    }

    players.push(playerInfo);

    if (players.length > 2) {
        console.log("Sala cheia. Espere um pouco.");
        return;
    }

    // connection.on("message", message => {
    //     const result = JSON.parse(message.utf8Data);

    //     if (result.method === "currentPlayers") {
    //         players.forEach(player => {
    //             if (player.playerId !== playerId) {
    //                 const payload = {
    //                     "method": "currentPlayers",
    //                     "playerId": player.playerId,
    //                 }
    //                 connection.send(JSON.stringify(payload));
    //             }
    //         })
    //     }
    // })

   

    const payload = {
        "method": "connect",
        "playerId": playerId,
    };

    connection.send(JSON.stringify(payload));

    players.forEach(player => {
        const payload = {
            "method": "numPlayers",
            "number": players.length
        };
        player.connection.send(JSON.stringify(payload));
    })



   
});

function randomPlayerId() {
    return uuid();
}


