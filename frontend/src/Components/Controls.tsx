import React from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

interface ControlsBarProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isChatOpen: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onToggleChat: () => void;
}

export const ControlsBar = ({
  isMuted,
  isVideoOff,
  isChatOpen,
  onToggleMute,
  onToggleVideo,
  onLeave,
  onToggleChat,
}: ControlsBarProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-4 opacity-90 transform -translate-x-1/2 p-4 flex w-full justify-center items-center gap-4 border-gray-800 rounded-lg shadow-lg"
    >
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggleMute}
        className={`p-4 rounded-full transition-colors border ${
          isMuted
            ? "bg-red-600 text-white hover:bg-red-700 border-red-500"
            : "bg-gray-800 text-white hover:bg-gray-700 border-gray-700"
        }`}
      >
        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggleVideo}
        className={`p-4 rounded-full transition-colors border ${
          isVideoOff
            ? "bg-red-600 text-white hover:bg-red-700 border-red-500"
            : "bg-gray-800 text-white hover:bg-gray-700 border-gray-700"
        }`}
      >
        {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onLeave}
        className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
      >
        <Phone className="w-6 h-6" />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggleChat}
        className={`p-4 rounded-full transition-colors border ${
          isChatOpen
            ? "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-500"
            : "bg-gray-800 text-white hover:bg-gray-700 border-gray-700"
        }`}
      >
        <MessageSquare className="w-6 h-6" />
      </motion.button>
    </motion.div>
  );
};