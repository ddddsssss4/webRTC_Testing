import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface VideoPlayerProps {
  stream: MediaStream;
  isMirrored?: boolean;
  label?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, isMirrored = false, label }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gray-100 rounded-lg relative border border-gray-800 "
    >
      <video
        ref={videoRef}
        autoPlay
       
        playsInline
        muted={true}
        className={`w-full h-full object-cover rounded- ${
          isMirrored ? 'transform scale-x-[-1]' : ''
        }`}
      />
      {label && (
        <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-3 py-1 rounded-lg">
          {label}
        </div>
      )}
    </motion.div>
  );
};