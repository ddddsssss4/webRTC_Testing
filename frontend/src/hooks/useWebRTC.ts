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
  const negotiatingRef = useRef<{[key: string]: boolean}>({});

  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ],
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER);
    setupSocketListeners();

    return () => cleanup();
  }, []);

  const getOrCreatePeerConnection = (peerId: string): RTCPeerConnection => {
    if (pcsRef.current[peerId]) {
      return pcsRef.current[peerId];
    }

    const pc = new RTCPeerConnection(rtcConfig);
    
    pc.onnegotiationneeded = async () => {
      try {
        if (negotiatingRef.current[peerId]) return;
        negotiatingRef.current[peerId] = true;
        
        await createOffer(peerId);
      } catch (err) {
        console.error('Error during negotiation:', err);
      } finally {
        negotiatingRef.current[peerId] = false;
      }
    };

    pc.ontrack = (event) => {
      console.log(`Remote track received from ${peerId}:`, event.streams[0].getTracks());
      
      const stream = event.streams[0];
      
      setRemoteStreams((prevStreams) => {
        console.log('Current remote streams:', prevStreams);
        if (prevStreams.some((rs) => rs.id === peerId)) {
          return prevStreams;
        }
        return [...prevStreams, { id: peerId, stream }];
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate for ${peerId}`);
        socketRef.current?.emit("ice-candidate", { userId: peerId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state changed for ${peerId}:`, pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state changed for ${peerId}:`, pc.iceConnectionState);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });
    }

    pcsRef.current[peerId] = pc;
    return pc;
  };

  const setupSocketListeners = () => {
    if (!socketRef.current) return;

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server");
      setConnectionStatus('connected');
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from signaling server");
      setConnectionStatus('disconnected');
    });

    socketRef.current.on("user-connected", (peerId: string) => {
      console.log("User connected:", peerId);
      getOrCreatePeerConnection(peerId);
    });

    socketRef.current.on("users-in-room", (users: string[]) => {
      console.log("Users in room:", users);
      users.forEach(createOffer);
    });

    socketRef.current.on("offer", async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        console.log(`Offer received from ${data.userId}`);
        const pc = getOrCreatePeerConnection(data.userId);
        
        if (pc.signalingState !== "stable") {
          console.log("Signaling state not stable, waiting...");
          await Promise.all([
            pc.setLocalDescription({ type: "rollback" }),
            pc.setRemoteDescription(new RTCSessionDescription(data.offer))
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        }
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit("answer", { userId: data.userId, answer });
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    });

    socketRef.current.on("answer", async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
      try {
        const pc = pcsRef.current[data.userId];
        if (!pc) return;
        
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    });

    socketRef.current.on("ice-candidate", async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
      try {
        const pc = pcsRef.current[data.userId];
        if (!pc) return;
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

    socketRef.current.on("room-created", (roomId: string) => {
      console.log("Room created:", roomId);
      setConnectionStatus('connected');
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
  };

  const createOffer = async (peerId: string) => {
    const pc = getOrCreatePeerConnection(peerId);
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(`Sending offer to ${peerId}`);
      socketRef.current?.emit("offer", { userId: peerId, offer });
    } catch (error) {
      console.error("Error creating offer:", error);
      negotiatingRef.current[peerId] = false;
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