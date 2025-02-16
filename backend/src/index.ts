import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { Kafka } from "kafkajs";
import Redis from "ioredis";
import 'newrelic';
require('newrelic');

const app = express();
const server = createServer(app);
console.log("server created");

// Redis Setup
const redis = new Redis({
  host: "redis",
  port: 6379,
});

// WebSockets Setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://web-rtc-five-iota.vercel.app",
      "https://web-rtc-testing-seven.vercel.app",
      "*"
    ],
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

app.use(cors());
app.use(express.json());

// Kafka Setup
const kafka = new Kafka({
  clientId: "webrtc-server",
  brokers: ["kafka:9092"],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "webrtc-group" });

(async () => {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: "chat-messages", fromBeginning: true });

  consumer.run({
    eachMessage: async ({ message }) => {
      if (message.value) {
        const chatMessage = JSON.parse(message.value.toString());
        await redis.lpush(`chat:${chatMessage.roomId}`, JSON.stringify(chatMessage));
        await redis.ltrim(`chat:${chatMessage.roomId}`, 0, 49);
        io.to(chatMessage.roomId).emit("receiveMessage", chatMessage);
      }
    },
  });
})();

// Room Management with Redis
const ROOM_SET_KEY = "active-rooms";
const ROOM_USERS_PREFIX = "room:users:";

io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);

  // Create Room
  socket.on("create-room", async (roomId: string) => {
    const exists = await redis.sismember(ROOM_SET_KEY, roomId);
    if (!exists) {
      await redis.sadd(ROOM_SET_KEY, roomId);
      await redis.hset(`room:${roomId}`, "createdAt", new Date().toISOString());
      socket.join(roomId);
      socket.emit("room-created", roomId);
      console.log(`Room created: ${roomId}`);
    } else {
      socket.emit("room-exists", roomId);
    }
  });

  // Join Room
  socket.on("join-room", async (roomId: string) => {
    const exists = await redis.sismember(ROOM_SET_KEY, roomId);
    if (exists) {
      socket.join(roomId);
      
      // Track user in room
      await redis.zadd(`${ROOM_USERS_PREFIX}${roomId}`, Date.now(), socket.id);
      
      // Notify others in the room
      socket.to(roomId).emit("user-connected", socket.id);
      
      // Get all users in room (excluding current)
      const users = await redis.zrange(`${ROOM_USERS_PREFIX}${roomId}`, 0, -1);
      const otherUsers = users.filter(id => id !== socket.id);
      socket.emit("users-in-room", otherUsers);

      // Fetch chat history
      const chatHistory = await redis.lrange(`chat:${roomId}`, 0, 49);
      socket.emit("chat-history", chatHistory.map(msg => JSON.parse(msg)));

      // WebRTC Signaling
      socket.on("offer", (data) => {
        socket.to(data.userId).emit("offer", { userId: socket.id, offer: data.offer });
      });

      socket.on("answer", (data) => {
        socket.to(data.userId).emit("answer", { userId: socket.id, answer: data.answer });
      });

      socket.on("ice-candidate", (data) => {
        socket.to(data.userId).emit("ice-candidate", { userId: socket.id, candidate: data.candidate });
      });

      // Leave Room
      socket.on("leave-room", async () => {
        await redis.zrem(`${ROOM_USERS_PREFIX}${roomId}`, socket.id);
        socket.leave(roomId);
        socket.to(roomId).emit("user-disconnected", socket.id);

        // Cleanup if room is empty
        const userCount = await redis.zcard(`${ROOM_USERS_PREFIX}${roomId}`);
        if (userCount === 0) {
          await redis.srem(ROOM_SET_KEY, roomId);
          await redis.del(`room:${roomId}`);
          io.emit("room-deleted", roomId);
          console.log(`Room ${roomId} deleted.`);
        }
      });

      // Chat Message Handling
      socket.on("sendMessage", async ({ roomId, sender, message }) => {
        const chatMessage = { roomId, sender, message, timestamp: new Date().toISOString() };
        await producer.send({
          topic: "chat-messages",
          messages: [{ value: JSON.stringify(chatMessage) }],
        });
        console.log("Message sent to Kafka:", chatMessage);
      });

    } else {
      socket.emit("room-not-found", roomId);
    }
  });

  // Handle Disconnect
  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    
    // Remove user from all rooms
    const rooms = await redis.smembers(ROOM_SET_KEY);
    for (const roomId of rooms) {
      await redis.zrem(`${ROOM_USERS_PREFIX}${roomId}`, socket.id);
      const userCount = await redis.zcard(`${ROOM_USERS_PREFIX}${roomId}`);
      if (userCount === 0) {
        await redis.srem(ROOM_SET_KEY, roomId);
        await redis.del(`room:${roomId}`);
        io.emit("room-deleted", roomId);
      }
    }
  });
});

// API Endpoints
app.get("/rooms", async (req, res) => {
  const activeRooms = await redis.smembers(ROOM_SET_KEY);
  res.json({ activeRooms });
});

app.get("/", (req, res) => {
  res.json({ message: "Welcome to WebRTC Server" });
});

// Start Server
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});