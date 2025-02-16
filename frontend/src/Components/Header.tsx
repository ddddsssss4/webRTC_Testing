import React from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  roomId: string;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  onExit: () => void;
}

export const HeaderComponent = ({ roomId, connectionStatus, onExit }: HeaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 p-4 flex justify-between items-center border-b border-gray-800"
    >
      <div className="text-white flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onExit}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Exit
        </motion.button>
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-indigo-400" />
          <span>Room: {roomId}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`flex items-center gap-2 ${
            connectionStatus === "connected" ? "text-green-400" : "text-yellow-400"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected" ? "bg-green-400" : "bg-yellow-400"
            }`}
          ></div>
          {connectionStatus === "connected" ? "Connected" : "Connecting..."}
        </span>
      </div>
    </motion.div>
  );
};
