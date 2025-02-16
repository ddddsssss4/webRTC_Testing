import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

interface RemoteStream {
  id: string;
  stream: MediaStream;
}

interface PeerConnections {
  [peerId: string]: RTCPeerConnection;
}

export const useWebRTC = () => {
  const { roomId } = useParams();
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<PeerConnections>({});

  const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  // Set up local media (camera and microphone)
  const setupLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
    } catch (error) {
      console.error('Error accessing local media:', error);
    }
  };

  // Create a new RTCPeerConnection for a given peerId
  const createPeerConnection = (peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(rtcConfig);

    // Handle remote track event
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams((prevStreams) => {
        if (prevStreams.find((rs) => rs.id === peerId)) return prevStreams;
        return [...prevStreams, { id: peerId, stream: remoteStream }];
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { userId: peerId, candidate: event.candidate });
      }
    };

    // Add local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pcsRef.current[peerId] = pc;
    return pc;
  };

  // Create an offer for a remote peer
  const createOffer = async (peerId: string) => {
    const pc = pcsRef.current[peerId] || createPeerConnection(peerId);
    if (pc.signalingState !== 'stable') return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { userId: peerId, offer });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // Handle incoming offers
  const handleOffer = async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
    const pc = pcsRef.current[data.userId] || createPeerConnection(data.userId);
    if (pc.remoteDescription && pc.remoteDescription.type === 'offer') return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { userId: data.userId, answer });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  // Handle incoming answers
  const handleAnswer = async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
    const pc = pcsRef.current[data.userId];
    if (!pc || pc.signalingState !== 'have-local-offer') return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  };

  // Handle incoming ICE candidates
  const handleIceCandidate = async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
    const pc = pcsRef.current[data.userId];
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  // Handle user disconnection
  const handleUserDisconnected = (peerId: string) => {
    const pc = pcsRef.current[peerId];
    if (pc) {
      pc.close();
      delete pcsRef.current[peerId];
    }
    setRemoteStreams((prevStreams) => prevStreams.filter((rs) => rs.id !== peerId));
  };

  // Initialize WebRTC logic
  useEffect(() => {
    setupLocalMedia();

    socket.on('users-in-room', (users: string[]) => {
      users.forEach((peerId) => createOffer(peerId));
    });

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-disconnected', handleUserDisconnected);

    return () => {
      socket.off('users-in-room');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-disconnected');
    };
  }, []);

  return { localStreamRef, remoteStreams };
};