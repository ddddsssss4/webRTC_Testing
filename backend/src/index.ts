import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { Kafka } from "kafkajs";

const app = express();
const server = createServer(app);
console.log("server created");

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://web-rtc-five-iota.vercel.app",
      "https://web-rtc-testing-seven.vercel.app"
    ],
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://web-rtc-five-iota.vercel.app",
      "https://web-rtc-testing-seven.vercel.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

// Kafka Setup
const kafka = new Kafka({
  clientId: "webrtc-server",
  brokers: ["kafka:9092"], // Update with your Kafka broker address
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
        io.to(chatMessage.roomId).except(chatMessage.sender).emit("receiveMessage", chatMessage);
      }
    },
  });
})();

// Store room data
const rooms: Record<string, string[]> = {};

io.on("connection", (socket: Socket) => {
  console.log("A user connected:", socket.id);

  // Create a room
  socket.on("create-room", (roomId: string) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
      socket.join(roomId);
      socket.emit("room-created", roomId);
      console.log(`Room created: ${roomId}`);
    } else {
      socket.emit("room-exists", roomId);
    }
  });

  // Join a room
  socket.on("join-room", (roomId: string) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      rooms[roomId].push(socket.id);

      socket.to(roomId).emit("user-connected", socket.id);
      socket.emit("users-in-room", rooms[roomId].filter((id) => id !== socket.id));

      // WebRTC signaling
      socket.on("offer", (data) => {
        console.log(`Offer from ${socket.id} to ${data.userId} in ${roomId}`);
        socket.to(data.userId).emit("offer", { userId: socket.id, offer: data.offer });
      });

      socket.on("answer", (data) => {
        console.log(`Answer from ${socket.id} to ${data.userId} in ${roomId}`);
        socket.to(data.userId).emit("answer", { userId: socket.id, answer: data.answer });
      });

      socket.on("ice-candidate", (data) => {
        console.log(`ICE candidate from ${socket.id} to ${data.userId} in ${roomId}`);
        socket.to(data.userId).emit("ice-candidate", { userId: socket.id, candidate: data.candidate });
      });

      // Send messages using Kafka
      socket.on("sendMessage", async ({ roomId, sender, message }) => {
        const chatMessage = { roomId, sender, message, timestamp: new Date().toISOString() };
        await producer.send({
          topic: "chat-messages",
          messages: [{ value: JSON.stringify(chatMessage) }],
        });
        console.log("Message sent to Kafka:", chatMessage);
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
        socket.to(roomId).emit("user-disconnected", socket.id);
      });
    } else {
      socket.emit("room-not-found", roomId);
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
