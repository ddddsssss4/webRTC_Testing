// import React, { useEffect, useRef, useState } from "react";
// import io from "socket.io-client";

// const socket = io("http://localhost:5000"); // Replace with your backend URL

// const VideoCall: React.FC = () => {
//   const localVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteVideoRef = useRef<HTMLVideoElement>(null);
//   const peerConnection = useRef<RTCPeerConnection | null>(null);
//   const [isConnected, setIsConnected] = useState(false);

//   useEffect(() => {
//     const constraints = { video: true, audio: true };
//     navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
//       if (localVideoRef.current) {
//         localVideoRef.current.srcObject = stream;
//       }
//       peerConnection.current = new RTCPeerConnection();
//       stream.getTracks().forEach((track) => peerConnection.current?.addTrack(track, stream));
//     });
//   }, []);

//   useEffect(() => {
//     socket.on("offer", async (offer) => {
//       if (peerConnection.current) {
//         await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
//         const answer = await peerConnection.current.createAnswer();
//         await peerConnection.current.setLocalDescription(answer);
//         socket.emit("answer", answer);
//       }
//     });

//     socket.on("answer", async (answer) => {
//       if (peerConnection.current) {
//         await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
//       }
//     });

//     socket.on("ice-candidate", async (candidate) => {
//       if (peerConnection.current) {
//         await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
//       }
//     });

//     return () => {
//       socket.off("offer");
//       socket.off("answer");
//       socket.off("ice-candidate");
//     };
//   }, []);

//   const startCall = async () => {
//     if (!peerConnection.current) return;
//     const offer = await peerConnection.current.createOffer();
//     await peerConnection.current.setLocalDescription(offer);
//     socket.emit("offer", offer);
//     setIsConnected(true);
//   };

//   return (
//     <div className="flex flex-col items-center p-6">
//       <h1 className="text-2xl font-bold">WebRTC Video Call</h1>
//       <div className="flex gap-4 mt-4">
//         <video ref={localVideoRef} autoPlay playsInline className="border rounded w-1/2" />
//         <video ref={remoteVideoRef} autoPlay playsInline className="border rounded w-1/2" />
//       </div>
//       {!isConnected && (
//         <button className="mt-4 px-6 py-2 bg-blue-500 text-white rounded" onClick={startCall}>
//           Start Call
//         </button>
//       )}
//     </div>
//   );
// };

// export default VideoCall;


import type React from "react"
import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import io, { type Socket } from "socket.io-client"

interface VideoCallProps {
  roomId: string
}

const VideoCall: React.FC<VideoCallProps> = ({ roomId }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    console.log("VideoCall component mounted")
    socketRef.current = io("http://localhost:5000")
    const socket = socketRef.current

    socket.on("connect", () => {
      console.log("Connected to server with socket ID:", socket.id)
    })

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log("Got local media stream")
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        socket.emit("join", roomId)
        console.log("Joined room:", roomId)

        const peerConnection = new RTCPeerConnection()
        peerConnectionRef.current = peerConnection

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream)
        })

        peerConnection.ontrack = (event) => {
          console.log("Received remote track")
          setRemoteStream(event.streams[0])
        }

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("Sending ICE candidate")
            socket.emit("ice-candidate", event.candidate, roomId)
          }
        }

        socket.on("offer", async (offer) => {
          console.log("Received offer")
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
          const answer = await peerConnection.createAnswer()
          await peerConnection.setLocalDescription(answer)
          console.log("Sending answer")
          socket.emit("answer", answer, roomId)
        })

        socket.on("answer", (answer) => {
          console.log("Received answer")
          peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        })

        socket.on("ice-candidate", (candidate) => {
          console.log("Received ICE candidate")
          peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        })

        peerConnection
          .createOffer()
          .then((offer) => peerConnection.setLocalDescription(offer))
          .then(() => {
            console.log("Sending offer")
            socket.emit("offer", peerConnection.localDescription, roomId)
          })
      })
      .catch((error) => console.error("Error accessing media devices:", error))

    return () => {
      console.log("VideoCall component unmounting")
      socket.disconnect()
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [roomId, localStream]) // Added localStream to dependencies

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log("Setting remote video stream")
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex justify-center space-x-4 mb-4"
    >
      <div className="flex gap-4 mt-4">
        <video ref={localVideoRef} autoPlay playsInline className="border rounded w-1/2" />
        <video ref={remoteVideoRef} autoPlay playsInline className="border rounded w-1/2" />
      </div>
    </motion.div>
  )
}

export default VideoCall


