import React, { useState, useEffect , useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Phone, Users, MessageSquare, ArrowLeft, Send, X } from 'lucide-react';

import { VideoPlayer } from '../Components/VideoPlayer';
import { useLocation } from 'react-router-dom';
import io from "socket.io-client";

const socket = io("http://localhost:5000");

interface PeerConnections {
  [peerId: string]: RTCPeerConnection;
}

interface RemoteStream {
  id: string;
  stream: MediaStream;
}


const VideoRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const location = useLocation();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const {action , name} = location.state // 'create' or 'join'
  const [isVisible, setIsVisible] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages , setMessages] = useState([
    { id: 1, sender: 'John Doe', text: 'Hey everyone! 👋', time: '10:30 AM' },
    { id: 2, sender: 'You', text: 'Hi John! How are you?', time: '10:31 AM' },
    { id: 3, sender: 'Sarah Smith', text: 'The presentation looks great!', time: '10:32 AM' },
    { id: 4, sender: 'You', text: 'Thanks Sarah! Glad you like it', time: '10:33 AM' },
  ]);
  
    // Store peer connections keyed by peerId
    const pcsRef = useRef<PeerConnections>({});
  
    // STUN server configuration
    const rtcConfig = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
    

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (window.innerHeight - e.clientY < 100) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      };
  
      const handleTouchStart = () => {
        setIsVisible(true);
        setTimeout(() => setIsVisible(false), 3000); // Hide after 3s on mobile
      };
  
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("touchstart", handleTouchStart);
  
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("touchstart", handleTouchStart);
      };
    }, []);
  
  
    // Create a new RTCPeerConnection for a given peerId
    const createPeerConnection = (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(rtcConfig);
  
      // Handle remote track event
      pc.ontrack = (event) => {
        console.log(`Remote track received from ${peerId}`);
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
  
        setRemoteStreams((prevStreams) => {
          if (prevStreams.find((rs) => rs.id === peerId)) return prevStreams;
          return [...prevStreams, { id: peerId, stream: remoteStream }];
        });
      };
  
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`Sending ICE candidate for ${peerId}`);
          socket.emit("ice-candidate", { userId: peerId, candidate: event.candidate });
        }
      };
  
      // Save this connection for later use
      pcsRef.current[peerId] = pc;
  
      // Add local tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }
  
      return pc;
    };
  
    // Set up local media (camera and microphone)
    const setupLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing local media:", error);
      }
    };
  
    // Create a room and join it
    const createRoom = async () => {
      setConnectionStatus('connecting');
      if (!roomId) return;
      socket.emit("create-room", roomId);
      setMessage(`Creating room: ${roomId}`);
      await setupLocalMedia();
      socket.emit("join-room", roomId);
    };
  
    // Join an existing room
    const joinRoom = async () => {
      setConnectionStatus('connecting')
      if (!roomId) return;
      await setupLocalMedia();
      socket.emit("join-room", roomId);
    };
  
    useEffect(() => {
      // --- Socket event handlers ---
      socket.on("connect", () => {
        console.log("Connected to signaling server");
        setConnectionStatus('connected');
      })
      socket.on("room-created", (roomId: string) => {
        setConnectionStatus('connected');
        setMessage(`Room created: ${roomId}`);
      });
  
      socket.on("room-exists", () => {
        setMessage("Room already exists.");
      });
  
      socket.on("room-not-found", () => {
        setMessage("Room not found.");
      });
  
      // When joining, the server sends a list of users already in the room.
      socket.on("users-in-room", (users: string[]) => {
        console.log("Users in room:", users);
        // New joiner: send an offer to each existing peer.
        users.forEach((peerId) => {
          createOffer(peerId);
        });
      });

            //     const newMessage = {
  //       id: messages.length + 1,
  //       sender: data.sender,
  //       text: data.message,
  //       time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  //     };
  socket.on("chat-history", (chatHistory) => {
    console.log("Received chat history:", chatHistory);

    setMessages((prevMessages) => {
        const startingId = prevMessages.length + 1; // Get the next starting ID

        const formattedMessages = chatHistory.map((data, index) => ({
            id: startingId + index, // Ensure ID is sequential
            sender: data.sender,
            text: data.message,
            time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        return [...prevMessages, ...formattedMessages]; // Append to existing messages
    });
});
  
  
      // When an offer is received:
      socket.on("offer", async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
        console.log(`Offer received from ${data.userId}`);
        
        // Get (or create) the peer connection for this user.
        let pc = pcsRef.current[data.userId];
        if (!pc) {
          pc = createPeerConnection(data.userId);
        }
        
        // If we've already set a remote description of type "offer",
        // then this is likely a duplicate offer and we can ignore it.
        if (pc.remoteDescription && pc.remoteDescription.type === "offer") {
          console.warn(`PC ${data.userId} already has a remote offer, ignoring duplicate offer.`);
          return;
        }
        
        console.log(`PC ${data.userId} signaling state before setting remote offer: ${pc.signalingState}`);
        
        try {
          // Set the remote description with the received offer.
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          console.log(`PC ${data.userId} signaling state after setting remote offer: ${pc.signalingState}`);
          
          // Check that we are now in the expected state ("have-remote-offer")
          if (pc.signalingState !== "have-remote-offer") {
            console.warn(`PC ${data.userId} is in state "${pc.signalingState}" after setting remote offer. Aborting answer creation.`);
            return;
          }
          
          // Create an answer and set it as the local description.
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log(`Sending answer to ${data.userId}`);
          socket.emit("answer", { userId: data.userId, answer });
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      });
      
  
      // When an answer is received:
      socket.on("answer", async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
        console.log(`Answer received from ${data.userId}`);
        const pc =  pcsRef.current[data.userId];
        if (!pc) {
          console.error(`PeerConnection not found for ${data.userId}`);
          return;
        }
        console.log(`PC ${data.userId} signaling state before answer: ${pc.signalingState}`);
  
        // Only set the remote description if we are expecting an answer.
        if (pc.signalingState !== "have-local-offer") {
          console.warn(
            `Ignoring answer from ${data.userId} because signaling state is "${pc.signalingState}" (expected "have-local-offer")`
          );
          return;
        }
  
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`PC ${data.userId} signaling state after setting answer: ${pc.signalingState}`);
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      });
  
      // When ICE candidates are received:
      socket.on("ice-candidate", async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
        console.log(`ICE candidate received for ${data.userId}`);
        const pc = pcsRef.current[data.userId];
        if (!pc) {
          console.error(`PeerConnection not found for ${data.userId}`);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      });
  
      // When a user disconnects:
      socket.on("user-disconnected", (peerId: string) => {
        console.log(`User disconnected: ${peerId}`);
        setConnectionStatus('disconnected');
        const pc = pcsRef.current[peerId];
        if (pc) {
          pc.close();
          delete pcsRef.current[peerId];
        }
        setRemoteStreams((prevStreams) => prevStreams.filter((rs) => rs.id !== peerId));
      });
      
  
      // Clean up on unmount.
      return () => {
        socket.off("room-created");
        socket.off("room-exists");
        socket.off("room-not-found");
        socket.off("users-in-room");
        // socket.off("user-connected"); // no longer used
        socket.off("offer");
        socket.off("answer");
        socket.off("ice-candidate");
        socket.off("user-disconnected");
      };
    }, []);
  
    // When initiating a connection to a remote peer, create an offer.
    const createOffer = async (peerId: string) => {
      // Create or retrieve an existing connection for this peer.
      const pc = pcsRef.current[peerId] || createPeerConnection(peerId);
  
      // Check if the connection is in a stable state before creating an offer.
      if (pc.signalingState !== "stable") {
        console.warn(`Skipping offer creation for ${peerId} because signaling state is ${pc.signalingState}`);
        return;
      }
  
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`Sending offer to ${peerId}`);
        socket.emit("offer", { userId: peerId, offer });
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    };

  useEffect(() => {
    if (roomId) {
      if (action === 'create') {
        createRoom();
      } else {
        joinRoom();
      }
    }
   
  }, [roomId]);
   

  useEffect(() => {
    const handleReceiveMessage = (data: { sender: string; message: string; timestamp: string }) => {
      const newMessage = {
        id: messages.length + 1,
        sender: data.sender,
        text: data.message,
        time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    };
  
    socket.on('receiveMessage', handleReceiveMessage);
  
    // Cleanup function
    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [messages.length]); // Add dependencies if needed

  

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessages.trim()) {
    const newMessage = {
      id: messages.length + 1,
      sender: name,
      text: chatMessages.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Append new messages


    socket.emit("sendMessage", { roomId, sender: name, message: chatMessages.trim() });
     console.log(newMessage)
    //setMessages((prevMessages) => [...prevMessages, newMessage]);

      setChatMessages('');
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const toggleMute = () => {
    if (localStreamRef) {
      localStreamRef.current?.getAudioTracks().forEach((track: { enabled: boolean; }) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef) {
      localStreamRef.current?.getVideoTracks().forEach((track: { enabled: boolean; }) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };


  const totalParticipants = 1 + remoteStreams.length; // local + remote streams
  const getGridLayout = () => {
    switch (totalParticipants) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-2';
      case 4:
        return 'grid-cols-2';
      default:
        return 'grid-cols-3';
    }
  };

 
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="min-h-screen flex flex-col">
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
              onClick={() => {
                if (localStreamRef) {
                  localStreamRef.current?.getVideoTracks().forEach((track) => track.stop());
                }
                setConnectionStatus("disconnected");
                socket.emit("leave-room", roomId);
                navigate("/");
              }}
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
          {/* Connection Status */}
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

        {/* Main Content (Updated) */}
        <div className="flex-1 p-4 relative flex justify-center items-center overflow-hidden ">
          <div 
            className="grid gap-4 w-full h-full"
            style={{ 
              gridTemplateColumns: "repeat(2, 1fr)", // Always 2 columns
              gridTemplateRows: "repeat(2, 1fr)", // Always 2 rows
              width: "100%",
              height: "calc(100vh - HEIGHT_OF_DIV_ABOVE)", // Takes remaining height
              overflow: "hidden"
            }}
          >
            {[
              ...(localStreamRef ? [<VideoPlayer key="local" stream={localStreamRef.current!} isMirrored={true} label="You" />] : []),
              ...remoteStreams.slice(0, 3).map((remote) => (
                <VideoPlayer key={remote.id} isMirrored={true} stream={remote.stream} label={`Participant ${remote.id}`} />
              )),
              ...Array(Math.max(0, 4 - (1 + remoteStreams.length))).fill(
                <div className="bg-gray-800 flex items-center justify-center text-white text-xl">Waiting...</div>
              )
            ]}
          </div>
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 20 }}
                className="absolute top-0 right-0 h- w-80 bg-gray-900 border-l border-gray-800 shadow-xl flex flex-col z-60"
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

               
                <div className="flex-1 h-[40px] overflow-hidden p-4 space-y-4">
                  {messages.map((msg) => {
                    const isCurrentUser = msg.sender === name;
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
                  {/* Invisible div to scroll to the latest message */}
                  <div ref={messagesEndRef} />
                  </div>
                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatMessages}
                      onChange={(e) => setChatMessages(e.target.value)}
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
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 opacity-90 transform -translate-x-1/2 p-4 flex w-full  justify-center items-center gap-4 border-gray-800 rounded-lg shadow-lg "
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
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
              onClick={toggleVideo}
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
              onClick={() => navigate("/")}
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
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-500"
                  : "bg-gray-800 text-white hover:bg-gray-700 border-gray-700"
              }`}
            >
              <MessageSquare className="w-6 h-6" />
            </motion.button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VideoRoom;