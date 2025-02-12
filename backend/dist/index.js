"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
console.log("server created");
const io = new socket_io_1.Server(server, {
    cors: {
        origin: ["http://localhost:5173", "https://web-rtc-five-iota.vercel.app ", "https://web-rtc-testing-seven.vercel.app"],
        methods: ["GET", "POST"],
    },
});
app.use((0, cors_1.default)({
    origin: ["http://localhost:5173", "https://web-rtc-five-iota.vercel.app", "https://web-rtc-testing-seven.vercel.app"], // Allow multiple origins
    methods: ["GET", "POST"], // Specify allowed HTTP methods
    credentials: true, // If using cookies/sessions
}));
app.use(express_1.default.json());
// Store room data
const rooms = {};
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    // Create a room
    socket.on("create-room", (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = []; // Initialize the room
            socket.join(roomId);
            socket.emit("room-created", roomId);
            console.log(`Room created: ${roomId}`);
        }
        else {
            socket.emit("room-exists", roomId); // Notify if room already exists
        }
    });
    // Join a room
    socket.on("join-room", (roomId) => {
        if (rooms[roomId]) {
            socket.join(roomId);
            rooms[roomId].push(socket.id);
            // Notify other users in the room
            socket.to(roomId).emit("user-connected", socket.id);
            // Send list of users in the room to the new user
            socket.emit("users-in-room", rooms[roomId].filter((id) => id !== socket.id));
            // Handle WebRTC signaling
            socket.on("offer", (data) => {
                console.log(`Offer received from ${socket.id} to ${data.userId} in room ${roomId}`);
                socket.to(data.userId).emit("offer", { userId: socket.id, offer: data.offer });
            });
            socket.on("answer", (data) => {
                console.log(`Answer received from ${socket.id} to ${data.userId} in room ${roomId}`);
                socket.to(data.userId).emit("answer", { userId: socket.id, answer: data.answer });
            });
            socket.on("ice-candidate", (data) => {
                console.log(`ICE candidate received from ${socket.id} to ${data.userId} in room ${roomId}`);
                socket.to(data.userId).emit("ice-candidate", { userId: socket.id, candidate: data.candidate });
            });
            // Handle user disconnect
            socket.on("disconnect", () => {
                console.log("User disconnected:", socket.id);
                rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
                socket.to(roomId).emit("user-disconnected", socket.id);
            });
        }
        else {
            socket.emit("room-not-found", roomId); // Notify if room doesn't exist
        }
    });
});
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
