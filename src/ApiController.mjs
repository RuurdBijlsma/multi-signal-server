import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";
import https from "https";
import http from "http";
import socketIo from "socket.io";

class ApiController {
    constructor() {
        this.printDebug = true;

        this.app = express();
        this.app.use(cors());
        this.app.use(bodyParser.json());
        this.socketRooms = {};

        this.app.get('/rooms', (req, res) => {
            res.send(this.getAllRoomsInfo());
        })
    }

    setSocketRoutes() {
        this.io.on('connection', socket => {
            socket.emit('socketId', socket.id);
            socket.on('disconnect', () => {
                this.onDisconnect(socket);
                this.log(`${socket.id} disconnected`);
            });
            socket.on('roomCount', room => {
                let roomCount = this.getRoomCount(room);
                this.log(`${socket.id} requested roomCount ${roomCount}`);
                socket.emit('roomCount', roomCount);
            });
            socket.on('join', room => {
                for (let room in this.getRooms(socket))
                    socket.leave(room);
                this.log(`${socket.id} joined room ${room}`);
                socket.join(room);
                this.socketRooms[socket.id] = room;
                this.socketBroadcast(socket, 'initialize', socket.id);
                this.io.in(room).emit('roomCount', this.getRoomCount(room));
            });
            socket.on('leave', room => {
                this.log(`${socket.id} left room ${room}`);
                this.onDisconnect(socket);
                socket.leave(room);
            });
            socket.on('broadcast', ([event, message]) => {
                this.socketBroadcast(socket, event, message);
            });
            socket.on('message', ([socketId, event, message]) => {
                this.log(`${socket.id} send message to ${socketId}:this.io.to(socketId).emit('signal', 'test2');`);
                this.io.to(`${socketId}`).emit(event, [socket.id, message]);
                // this.io.to(`${socketId}`).emit('hey', 'I just met you');
            });
            this.log(`${socket.id} connected`);
        });
    }

    getAllRoomsInfo() {
        let rooms = Object.keys(this.io.sockets.adapter.rooms).filter(room => !(room in this.io.sockets.adapter.sids));
        return rooms.map(room => {
            return {
                name: room,
                userCount: this.getRoomCount(room)
            }
        });
    }

    getRoomCount(room) {
        let roomClients = this.io.sockets.adapter.rooms[room];
        if (roomClients && roomClients.length)
            return roomClients.length;
        return 0;
    }

    onDisconnect(socket) {
        let room = this.socketRooms[socket.id];
        if (room) {
            this.io.in(room).emit('roomCount', this.getRoomCount(room));
            socket.to(room).emit('destroy', socket.id);
        }
        delete this.socketRooms[socket.id];
    }

    getRooms(socket) {
        let allRooms = Object.keys(this.io.sockets.adapter.sids[socket.id]);
        this.log(allRooms);
        return allRooms.filter(r => r !== socket.id);
    }

    socketBroadcast(socket, event, message) {
        this.log(`${socket.id} broadcast: ${event}-${message}`);
        let rooms = this.getRooms(socket);
        for (let room of rooms)
            socket.to(room).emit(event, message);
    }

    static getHttpsCredentials(key, cert) {
        try {
            return {
                key: fs.readFileSync(key),
                cert: fs.readFileSync(cert),
            }
        } catch (e) {
            if (key && cert)
                console.log("HTTPS error", e.message);
            else
                console.log("No HTTPS key and cert given");
            return false;
        }
    }

    log(...msg) {
        if (this.printDebug)
            console.log(...msg);
    }

    start(port = 3000, key, cert) {
        let credentials = ApiController.getHttpsCredentials(key, cert);
        let server;
        if (credentials) {
            console.log("[HTTPS]");
            server = https.createServer(credentials, this.app);
        } else {
            console.log("[HTTP]");
            server = http.createServer(this.app);
        }
        this.io = socketIo(server);
        this.setSocketRoutes();
        server.listen(port, () => console.log(`Signal server listening on port ${port}!`));
    }
}

export default new ApiController();
