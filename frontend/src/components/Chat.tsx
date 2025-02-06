import type React from "react"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import io, { type Socket } from "socket.io-client"

interface ChatProps {
  roomId: string
}

interface Message {
  text: string
  sender: string
}

const Chat: React.FC<ChatProps> = ({ roomId }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const socketRef = useRef<Socket | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    socketRef.current = io("http://localhost:5000")
    const socket = socketRef.current

    socket.emit("join", roomId)

    socket.on("receive-message", (message: Message) => {
      setMessages((prevMessages) => [...prevMessages, message])
    })

    return () => {
      socket.disconnect()
    }
  }, [roomId])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatContainerRef]) // Corrected dependency

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMessage.trim() && socketRef.current) {
      const messageData: Message = {
        text: inputMessage,
        sender: "Me",
      }
      socketRef.current.emit("send-message", messageData, roomId)
      setMessages((prevMessages) => [...prevMessages, messageData])
      setInputMessage("")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-gray-800 rounded-lg p-4 mt-4"
    >
      <h2 className="text-xl font-bold mb-4">Chat</h2>
      <div ref={chatContainerRef} className="h-60 overflow-y-auto mb-4 space-y-2">
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`p-2 rounded-lg ${message.sender === "Me" ? "bg-blue-600 ml-auto" : "bg-gray-700"} max-w-[70%]`}
          >
            <p className="text-sm">{message.text}</p>
            <p className="text-xs text-gray-400">{message.sender}</p>
          </motion.div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          className="flex-grow bg-gray-700 text-white px-3 py-2 rounded-l-md focus:outline-none"
          placeholder="Type a message..."
        />
        <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-md">
          Send
        </button>
      </form>
    </motion.div>
  )
}

export default Chat

