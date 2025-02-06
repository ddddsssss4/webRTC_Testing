import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

// Connect to the signaling server
const socket = io("http://localhost:5000");

interface PeerConnections {
  [peerId: string]: RTCPeerConnection;
}

interface RemoteStream {
  id: string;
  stream: MediaStream;
}

const App: React.FC = () => {
  // Local media refs and state
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [roomId, setRoomId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

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
    if (!roomId) return;
    socket.emit("create-room", roomId);
    setMessage(`Creating room: ${roomId}`);
    await setupLocalMedia();
    socket.emit("join-room", roomId);
  };

  // Join an existing room
  const joinRoom = async () => {
    if (!roomId) return;
    await setupLocalMedia();
    socket.emit("join-room", roomId);
  };

  useEffect(() => {
    // --- Socket event handlers ---

    socket.on("room-created", (roomId: string) => {
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

    // **Remove the "user-connected" event handler to avoid duplicate offers**
    // socket.on("user-connected", (peerId: string) => {
    //   console.log(`User connected: ${peerId}`);
    //   // Do not call createOffer here. Let the new joiner handle offer creation.
    // });

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
      const pc = pcsRef.current[data.userId];
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

  return (
    <div style={{ textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      <h1>WebRTC Multi-Peer Video Call</h1>
      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        style={{ padding: "8px", marginBottom: "10px" }}
      />
      <br />
      <button onClick={createRoom} style={{ marginRight: "10px", padding: "10px" }}>
        Create Room
      </button>
      <button onClick={joinRoom} style={{ padding: "10px" }}>
        Join Room
      </button>
      <p>{message}</p>
      <div>
        <h2>Local Video</h2>
        <video ref={localVideoRef} autoPlay muted style={{ width: "50%", transform: "scaleX(-1)" }} />
      </div>
      <div>
        <h2>Remote Videos</h2>
        {remoteStreams.map((remote) => (
          <div key={remote.id}>
            <p>Peer: {remote.id}</p>
            <video
              autoPlay
              playsInline
              ref={(video) => {
                if (video) video.srcObject = remote.stream;
              }}
              style={{ width: "50%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
