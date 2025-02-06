import type React from "react"
import { motion } from "framer-motion"

interface CallNotificationProps {
  roomId: string
  onAccept: () => void
  onDecline: () => void
}

const CallNotification: React.FC<CallNotificationProps> = ({ roomId, onAccept, onDecline }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg"
    >
      <h3 className="text-lg font-semibold mb-2">Incoming Call</h3>
      <p className="mb-4">Room ID: {roomId}</p>
      <div className="flex justify-end space-x-2">
        <button onClick={onAccept} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
          Accept
        </button>
        <button onClick={onDecline} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
          Decline
        </button>
      </div>
    </motion.div>
  )
}

export default CallNotification

