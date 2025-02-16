import { VideoPlayer } from './VideoPlayer';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: { id: string; stream: MediaStream }[];
}

export const VideoGrid = ({ localStream, remoteStreams }: VideoGridProps) => {
  return (
    <div
      className="grid gap-4 w-full h-full"
      style={{
        gridTemplateColumns: "repeat(2, 1fr)",
        gridTemplateRows: "repeat(2, 1fr)",
        width: "100%",
        height: "calc(100vh - HEIGHT_OF_DIV_ABOVE)",
        overflow: "hidden",
      }}
    >
      {localStream && <VideoPlayer key="local" stream={localStream} isMirrored={true} label="You" />}
      {remoteStreams.slice(0, 3).map((remote) => (
        <VideoPlayer key={remote.id} stream={remote.stream} isMirrored={true} label={`Participant ${remote.id}`} />
      ))}
      {Array(Math.max(0, 4 - (1 + remoteStreams.length))).fill(
        <div className="bg-gray-800 flex items-center justify-center text-white text-xl">Waiting...</div>
      )}
    </div>
  );
};