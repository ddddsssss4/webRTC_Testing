import React from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { motion } from 'framer-motion';

interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
}

interface ChatPanelProps {
  messages: Message[];
  currentUserName: string;
  chatMessage: string;
  onMessageChange: (message: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onClose: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatPanel = ({
  messages,
  currentUserName,
  chatMessage,
  onMessageChange,
  onSendMessage,
  onClose,
  messagesEndRef,
}: ChatPanelProps) => {
  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 20 }}
      className="absolute top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-800 shadow-xl flex flex-col z-60"
    >
      <div className="p-4 border-b border-gray-800 flex justify-between items-center">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Chat
        </h3>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isCurrentUser = msg.sender === currentUserName;
          const senderName = isCurrentUser ? "You" : msg.sender;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] ${
                  isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-100'
                } rounded-lg px-4 py-2`}
              >
                {!isCurrentUser && (
                  <div className="text-xs text-gray-400 mb-1">{senderName}</div>
                )}
                <p>{msg.text}</p>
              </div>
              <span className="text-xs text-gray-500 mt-1">{msg.time}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={onSendMessage} className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-700"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
};