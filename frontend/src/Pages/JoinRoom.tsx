import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Video, ArrowRight, ArrowLeft } from "lucide-react";

const JoinRoom = () => {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState(""); // Correctly setting up the name state
  const navigate = useNavigate();

  const handleJoinRoom = () => {
    if (roomId.trim() && name.trim()) {
      navigate(`/room/${roomId}`, { state: { action: "join", name } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full mx-4 border border-gray-700 relative"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/")}
          className="absolute left-4 top-4 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </motion.button>

        <div className="flex items-center justify-center mb-8">
          <Video className="w-12 h-12 text-indigo-400" />
        </div>

        <h2 className="text-2xl font-bold text-center mb-6 text-white">
          Join a Meeting
        </h2>

        <div className="space-y-6">
          {/* Room ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room ID
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter the room ID to join"
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name} // Bind name state
              onChange={(e) => setName(e.target.value)} // Correct handler
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
            <p className="mt-2 text-sm text-gray-400">
              Enter the name you want to use in the meeting
            </p>
          </div>

          {/* Join Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleJoinRoom}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            Join Room
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default JoinRoom;
