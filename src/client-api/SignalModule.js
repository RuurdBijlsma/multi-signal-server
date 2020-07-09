import EventEmitter from 'events';
import socketIo from "socket.io-client";

export default class SignalModule extends EventEmitter {
    constructor(appName) {
        super();
        this.socket = null;
        this.rooms = [];
        this.appName = appName;
        this.id = '';
        this.roomCount = 0;
    }

    async getRoomCount(appName, roomId) {
        this.socket.emit('room-count', appName, roomId);
        return await this.waitFor('room-count', 5000);
    }

    create(appName, roomId, password = '', hidden = false) {
        this.socket.emit('create', appName, roomId, password, hidden);
    }

    join(appName, roomId, password = '') {
        this.socket.emit('join', appName, roomId, password);
    }

    leave(appName, roomId) {
        this.socket.emit('leave', appName, roomId);
    }

    broadcast(event, ...message) {
        this.socket.emit('broadcast', event, ...message);
    }

    message(socketId, event, ...message) {
        console.log(`emitting message ${socketId} ${event}`, message);
        this.socket.emit('message', socketId, event, ...message);
    }

    async connect(url, webSocketOnly = false) {
        return new Promise((resolve, reject) => {
            this.url = url;

            let transports = ['websocket'];
            if (!webSocketOnly) {
                transports.push('polling')
            }
            this.socket = socketIo(url, {transports});

            this.socket.on('connect', () => {
                resolve(this.socket);
            });

            this.socket.on('connect_error', e => {
                reject(e)
            });

            this.socket.on('room-count', roomCount => {
                this.roomCount = roomCount;
                this.emit('room-count', roomCount);
            });

            this.socket.on('socket-id', mySocketId => {
                this.emit('socket-id', mySocketId);
                this.id = mySocketId;
            });

            this.socket.on('initialize', (host, socketId) => {
                this.emit('initialize', host, socketId);
            });

            this.socket.on('destroy', socketId => {
                this.emit('destroy', socketId);
            });
            this.socket.on('signal', (socketId, signal) => {
                this.emit('signal', socketId, signal);
            })
        })
    }

    destroy() {
        if (this.socket)
            this.socket.close();
    }

    async waitFor(event, timeout = false) {
        return new Promise((resolve, reject) => {
            let rejectTimeout;
            if (timeout !== false) {
                rejectTimeout = setTimeout(() => {
                    reject('Timeout while waiting for event ' + event + ' to fire (timeout: ' + timeout + 'ms)');
                }, +timeout);
            }
            this.once(event, (...params) => {
                if (timeout !== false) {
                    clearTimeout(rejectTimeout)
                }
                resolve(...params);
            });
        });
    }
}