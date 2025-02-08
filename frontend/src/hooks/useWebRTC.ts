import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_SERVER = "https://webrtc-1-hc8e.onrender.com";

interface PeerConnections {
  [peerId: string]: RTCPeerConnection;
}

export interface RemoteStream {
  id: string;
  stream: MediaStream;
}

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string>('');

  const socketRef = useRef<Socket|null>(null);
  const pcsRef = useRef<PeerConnections>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER);
    setupSocketListeners();

    return () => cleanup();
  });

  const setupSocketListeners = () => {
    if (!socketRef.current) return;

    // Critical fix: Removed duplicate user-connected handler
    socketRef.current.on("user-connected", (peerId: string) => {
      console.log("User connected:", peerId);
      createOffer(peerId);
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server");
      setConnectionStatus('connected');
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from signaling server");
      setConnectionStatus('disconnected');
    });

    socketRef.current.on("room-created", (roomId: string) => {
      console.log("Room created:", roomId);
      setConnectionStatus('connected');
      // Critical fix: Join room after creation
      socketRef.current?.emit("join-room", roomId);
    });

    socketRef.current.on("room-exists", () => {
      setError("Room already exists");
      setConnectionStatus('disconnected');
    });

    socketRef.current.on("room-not-found", () => {
      setError("Room not found");
      setConnectionStatus('disconnected');
    });

    socketRef.current.on("users-in-room", (users: string[]) => {
      console.log("Users in room:", users);
      users.forEach(createOffer);
    });

   // Updated offer handler

  socketRef.current.on("offer", async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
    console.log(`Offer received from ${data.userId}`);
    
    // Get (or create) the peer connection for this user.
    let pc = pcsRef.current[data.userId];
    if (!pc) {
      pc = getOrCreatePeerConnection(data.userId);
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
      socketRef.current?.emit("answer", { userId: data.userId, answer });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  });


// Updated answer handler
socketRef.current.on("answer", async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
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

    socketRef.current.on("ice-candidate", async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcsRef.current[data.userId];
      if (!pc) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    socketRef.current.on("user-disconnected", (peerId: string) => {
      if (pcsRef.current[peerId]) {
        pcsRef.current[peerId].close();
        delete pcsRef.current[peerId];
      }
      setRemoteStreams(prev => prev.filter(rs => rs.id !== peerId));
    });
  };

  const getOrCreatePeerConnection = (peerId: string): RTCPeerConnection => {
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
        socketRef.current?.emit("ice-candidate", { userId: peerId, candidate: event.candidate });
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

  const createOffer = async (peerId: string) => {
    // Create or retrieve an existing connection for this peer.
    const pc = pcsRef.current[peerId] || getOrCreatePeerConnection(peerId);

    // Check if the connection is in a stable state before creating an offer.
    if (pc.signalingState !== "stable") {
      console.warn(`Skipping offer creation for ${peerId} because signaling state is ${pc.signalingState}`);
      return;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(`Sending offer to ${peerId}`);
      socketRef.current?.emit("offer", { userId: peerId, offer });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };


  const setupLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Media access error:", error);
      setError("Camera/microphone access required");
      throw error;
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      setConnectionStatus('connecting');
      await setupLocalMedia();
      socketRef.current?.emit("join-room", roomId);
    } catch (error) {
      setConnectionStatus('disconnected');
      setError("Failed to join room");
      throw error;
    }
  };

  const createRoom = async (roomId: string) => {
    try {
      setConnectionStatus('connecting');
      await setupLocalMedia();
      socketRef.current?.emit("create-room", roomId);
    } catch (error) {
      setConnectionStatus('disconnected');
      setError("Failed to create room");
      throw error;
    }
  };

  const cleanup = () => {
    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current = {};
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    socketRef.current?.disconnect();
    setRemoteStreams([]);
    setLocalStream(null);
    setConnectionStatus('disconnected');
  };

  return {
    localStream,
    remoteStreams,
    connectionStatus,
    error,
    joinRoom,
    createRoom,
    cleanup
  };
};