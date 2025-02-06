import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

const App: React.FC = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [roomId, setRoomId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidates = useRef<Record<string, RTCIceCandidate[]>>({});
  const currentPeerId = useRef<string | null>(null);

  // Initialize WebRTC
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "ada82ad76017cfd30f18f4e4",
          credential: "j4o13ETgrUn/cEyO",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "ada82ad76017cfd30f18f4e4",
          credential: "j4o13ETgrUn/cEyO",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "ada82ad76017cfd30f18f4e4",
          credential: "j4o13ETgrUn/cEyO",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "ada82ad76017cfd30f18f4e4",
          credential: "j4o13ETgrUn/cEyO",
        },
    ],
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && currentPeerId.current) {
        const targetUserId = currentPeerId.current;
        if (!pendingIceCandidates.current[targetUserId]) {
          pendingIceCandidates.current[targetUserId] = [];
        }
        
        if (pc.signalingState === "stable") {
          socket.emit("ice-candidate", {
            userId: targetUserId,
            candidate: event.candidate.toJSON(),
            roomId
          });
        } else {
          pendingIceCandidates.current[targetUserId].push(event.candidate);
        }
      }
    };

    return pc;
  };

  const resetConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pcRef.current = createPeerConnection();
    pendingIceCandidates.current = {};
  };

  const sendPendingCandidates = (userId: string) => {
    if (pendingIceCandidates.current[userId]?.length > 0 && pcRef.current) {
      pendingIceCandidates.current[userId].forEach(candidate => {
        socket.emit("ice-candidate", {
          userId,
          candidate: candidate.toJSON(),
          roomId
        });
      });
      pendingIceCandidates.current[userId] = [];
    }
  };

  useEffect(() => {
    resetConnection();
    return () => {
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  const createRoom = () => {
    if (!roomId) return;
    resetConnection();
    socket.emit("create-room", roomId);
  };

  const joinRoom = async () => {
    if (!roomId) return;
    resetConnection();

    try {

      const constraints = {
        video: {
          width: { ideal: 320 },  // Reduce width to 320px
          height: { ideal: 240 }, // Reduce height to 240px
          frameRate: { ideal: 10, max: 15 }, // Lower frame rate to 10-15 FPS
        },
        audio: true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      localStreamRef.current = stream;

      stream.getTracks().forEach(track => {
        pcRef.current?.addTrack(track, stream);
      });

      socket.emit("join-room", roomId);
    } catch (error) {
      console.error("Error accessing media:", error);
    }
  };

  useEffect(() => {
    socket.on("room-created", (roomId: string) => {
      setMessage(`Room created: ${roomId}`);
    });

    socket.on("room-exists", (roomId: string) => {
      setMessage(`Room exists: ${roomId}`);
    });

    socket.on("room-not-found", (roomId: string) => {
      setMessage(`Room not found: ${roomId}`);
    });

    socket.on("users-in-room", (users: string[]) => {
      users.forEach(userId => {
        currentPeerId.current = userId;
        createOffer(userId);
      });
    });

    socket.on("user-connected", (userId: string) => {
      currentPeerId.current = userId;
      createOffer(userId);
    });

    socket.on("user-disconnected", (userId: string) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    socket.on("offer", async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
      if (!pcRef.current) return;

      try {
        // Only process offers in stable state
        if (pcRef.current.signalingState === "stable") {
          currentPeerId.current = data.userId;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socket.emit("answer", { userId: data.userId, answer });
          sendPendingCandidates(data.userId);
        }
      } catch (error) {
        console.error("Offer handling failed:", error);
      }
    });

    socket.on("answer", async (data: { answer: RTCSessionDescriptionInit }) => {
      if (!pcRef.current) return;

      try {
        // Only process answers if we're expecting one
        if (pcRef.current.signalingState === "have-local-offer") {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          sendPendingCandidates(currentPeerId.current!);
        }
      } catch (error) {
        console.error("Answer handling failed:", error);
      }
    });

    socket.on("ice-candidate", (data: { userId: string; candidate: RTCIceCandidateInit }) => {
      if (!pcRef.current) return;

      try {
        const candidate = new RTCIceCandidate(data.candidate);
        if (pcRef.current.remoteDescription) {
          pcRef.current.addIceCandidate(candidate);
        } else {
          if (!pendingIceCandidates.current[data.userId]) {
            pendingIceCandidates.current[data.userId] = [];
          }
          pendingIceCandidates.current[data.userId].push(candidate);
        }
      } catch (error) {
        console.error("ICE candidate error:", error);
      }
    });

  } , []);

  const createOffer = async (userId: string) => {
    if (!pcRef.current) return;

    try {
      // Only create offers in stable state
     
        currentPeerId.current = userId;
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        socket.emit("offer", { userId, offer });
        sendPendingCandidates(userId);
      
    } catch (error) {
      console.error("Offer creation failed:", error);
    }
  };

  return (
    <div>
      <h1>WebRTC Video Call</h1>
      <input
        type="text"
        placeholder="Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={createRoom}>Create</button>
      <button onClick={joinRoom}>Join</button>
      <p>{message}</p>
      <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          style={{ width: "400px", height: "300px", border: "2px solid #333" , }}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          style={{ width: "400px", height: "300px", border: "2px solid #333" }}
        />
      </div>
    </div>
  );
};

export default App;