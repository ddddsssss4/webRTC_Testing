import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import io from "socket.io-client";
import { HeaderComponent } from '../Components/Header';
import { ControlsBar } from '../Components/Controls';
import { ChatPanel } from '../Components/Chat'
import { VideoPlayer } from '../Components/VideoPlayer';

const socket = io("http://localhost", {
  transports: ["websocket"],
});

interface PeerConnections {
  [peerId: string]: RTCPeerConnection;
}

interface RemoteStream {
  id: string;
  stream: MediaStream;
}

const VideoRoomClone = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState('');
  interface Message {
    id: number;
    sender: string;
    text: string;
    time: string;
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const location = useLocation();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const { action, name } = location.state; // 'create' or 'join'
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Store peer connections keyed by peerId
  const pcsRef = useRef<PeerConnections>({});

  // STUN server configuration
  const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

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
    console.log("Yahan aaye kya");
    setConnectionStatus('connecting');
    if (!roomId) return;
    socket.emit("create-room", roomId);
    await setupLocalMedia();
    socket.emit("join-room", roomId);
  };

  // Join an existing room
  const joinRoom = async () => {
    setConnectionStatus('connecting');
    if (!roomId) return;
    await setupLocalMedia();
    socket.emit("join-room", roomId);
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit("leave-room", roomId);
    };
  
    window.addEventListener("beforeunload", handleBeforeUnload);
  
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      socket.emit("leave-room", roomId);
    };
  }, [roomId]);

  // Socket event handlers
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to signaling server");
      setConnectionStatus('connected');
    });

    socket.on("room-created", () => {
      setConnectionStatus('connected');
    });

    socket.on("users-in-room", (users: string[]) => {
      console.log("Users in room:", users);
      users.forEach((peerId) => {
        createOffer(peerId);
      });
    });

    socket.on("chat-history", (chatHistory) => {
      setMessages((prevMessages) => {
        const startingId = prevMessages.length + 1;
        const formattedMessages = chatHistory.map((data : { sender: string; message: string; timestamp: string }, index: number) => ({
          id: startingId + index,
          sender: data.sender,
          text: data.message,
          time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        return [...prevMessages, ...formattedMessages];
      });
    });

    socket.on("offer", async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
      console.log(`Offer received from ${data.userId}`);
      let pc = pcsRef.current[data.userId];
      if (!pc) {
        pc = createPeerConnection(data.userId);
      }

      if (pc.remoteDescription && pc.remoteDescription.type === "offer") {
        console.warn(`PC ${data.userId} already has a remote offer, ignoring duplicate offer.`);
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        if (pc.signalingState !== "have-remote-offer") {
          console.warn(`PC ${data.userId} is in state "${pc.signalingState}" after setting remote offer. Aborting answer creation.`);
          return;
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { userId: data.userId, answer });
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    });

    socket.on("answer", async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
      console.log(`Answer received from ${data.userId}`);
      const pc = pcsRef.current[data.userId];
      if (!pc) {
        console.error(`PeerConnection not found for ${data.userId}`);
        return;
      }

      if (pc.signalingState !== "have-local-offer") {
        console.warn(
          `Ignoring answer from ${data.userId} because signaling state is "${pc.signalingState}" (expected "have-local-offer")`
        );
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (error) {
        console.error("Error setting remote description:", error);
      }
    });

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

    return () => {
      socket.off("connect");
      socket.off("room-created");
      socket.off("users-in-room");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-disconnected");
      socket.off("chat-history");
    };
  }, []);

  // Create offer when initiating connection
  const createOffer = async (peerId: string) => {
    const pc = pcsRef.current[peerId] || createPeerConnection(peerId);

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

  // Join room on component mount
  useEffect(() => {
    if (roomId) {
      if (action === 'create') {
        createRoom();
      } else {
        joinRoom();
      }
    }
  }, [roomId]);

  // Handle received messages
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
    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [messages.length]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle sending messages
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessages.trim()) {
      socket.emit("sendMessage", { roomId, sender: name, message: chatMessages.trim() });
      setChatMessages('');
    }
  };

  // Toggle audio/video
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="min-h-screen flex flex-col">
        <HeaderComponent 
          roomId={roomId!}
          connectionStatus={connectionStatus}
          onExit={() => {
            if (localStreamRef.current) {
              localStreamRef.current.getVideoTracks().forEach((track) => track.stop());
            }
            setConnectionStatus("disconnected");
            socket.emit("leave-room", roomId);
            navigate("/");
          }}
        />

        <div className="flex-1 p-4 relative flex justify-center items-center overflow-hidden">
          <div 
            className="grid gap-4 w-full h-full"
            style={{ 
              gridTemplateColumns: "repeat(2, 1fr)",
              gridTemplateRows: "repeat(2, 1fr)",
              width: "100%",
              height: "calc(100vh - HEIGHT_OF_DIV_ABOVE)",
              overflow: "hidden"
            }}
          >
            {[
              ...(localStreamRef.current ? [<VideoPlayer key="local" stream={localStreamRef.current} isMirrored={true} label="You" />] : []),
              ...remoteStreams.slice(0, 3).map((remote) => (
                <VideoPlayer key={remote.id} stream={remote.stream} isMirrored={true} label={`Participant ${remote.id}`} />
              )),
              ...Array(Math.max(0, 4 - (1 + remoteStreams.length))).fill(
                <div className="bg-gray-800 flex items-center justify-center text-white text-xl">Waiting...</div>
              )
            ]}
          </div>

          <AnimatePresence>
            {isChatOpen && (
              <ChatPanel
                messages={messages}
                currentUserName={name}
                chatMessage={chatMessages}
                onMessageChange={(message) => setChatMessages(message)}
                onSendMessage={handleSendMessage}
                onClose={() => setIsChatOpen(false)}
                messagesEndRef={messagesEndRef}
              />
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          <ControlsBar
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isChatOpen={isChatOpen}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onLeave={() => navigate("/")}
            onToggleChat={() => setIsChatOpen(true)}
          />
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VideoRoomClone;