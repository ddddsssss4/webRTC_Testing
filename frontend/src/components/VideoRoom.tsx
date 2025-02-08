import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Phone, Users, MessageSquare, ArrowLeft, Send, X } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { VideoPlayer } from './VideoPlayer';
import { useLocation } from 'react-router-dom';

const VideoRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const location = useLocation();
  const action = location.state?.action; // 'create' or 'join'
  
  const {
    localStream,
    remoteStreams,
    connectionStatus,
    error,
    createRoom,
    joinRoom,
  
    cleanup
  } = useWebRTC();

  
  console.log(error);
  // Dummy messages for demonstration
  const [messages] = useState([
    { id: 1, sender: 'John Doe', text: 'Hey everyone! 👋', time: '10:30 AM' },
    { id: 2, sender: 'You', text: 'Hi John! How are you?', time: '10:31 AM' },
    { id: 3, sender: 'Sarah Smith', text: 'The presentation looks great!', time: '10:32 AM' },
    { id: 4, sender: 'You', text: 'Thanks Sarah! Glad you like it', time: '10:33 AM' },
  ]);

  // useEffect(() => {
  //   if (roomId) {
  //     joinRoom(roomId);
  //   }
  //   return () => cleanup();
  // }, [roomId]);

  useEffect(() => {
    if (roomId) {
      if (action === 'create') {
        createRoom(roomId);
      } else {
        joinRoom(roomId);
      }
    }
    return () => cleanup();
  }, [roomId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      // Add message handling logic here
      setMessage('');
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 p-4 flex justify-between items-center border-b border-gray-800"
        >
          <div className="text-white flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
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
            <span className={`flex items-center gap-2 ${
              connectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 'bg-yellow-400'
              }`}></div>
              {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 p-4 relative">
          <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
            {localStream && (
              <VideoPlayer
                stream={localStream}
                isMirrored={true}
                label="You"
              />
            )}
            {remoteStreams.map((remote) => (
              <VideoPlayer
                key={remote.id}
                stream={remote.stream}
                label={`Participant ${remote.id}`}
              />
            ))}
          </div>

          {/* Chat Sidebar */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 20 }}
                className="absolute top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-800 shadow-xl flex flex-col"
              >
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Chat
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsChatOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender === 'You' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] ${
                          msg.sender === 'You'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-800 text-gray-100'
                        } rounded-lg px-4 py-2`}
                      >
                        {msg.sender !== 'You' && (
                          <div className="text-xs text-gray-400 mb-1">{msg.sender}</div>
                        )}
                        <p>{msg.text}</p>
                      </div>
                      <span className="text-xs text-gray-500 mt-1">{msg.time}</span>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
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
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 p-4 flex justify-center items-center gap-4 border-t border-gray-800"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            className={`p-4 rounded-full transition-colors border ${
              isMuted
                ? 'bg-red-600 text-white hover:bg-red-700 border-red-500'
                : 'bg-gray-800 text-white hover:bg-gray-700 border-gray-700'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors border ${
              isVideoOff
                ? 'bg-red-600 text-white hover:bg-red-700 border-red-500'
                : 'bg-gray-800 text-white hover:bg-gray-700 border-gray-700'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <Phone className="w-6 h-6" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsChatOpen(true)}
            className={`p-4 rounded-full transition-colors border ${
              isChatOpen
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-500'
                : 'bg-gray-800 text-white hover:bg-gray-700 border-gray-700'
            }`}
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default VideoRoom;