
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Video, Users, Zap } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-white mb-6">
            Connect Instantly with WebMeet
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            High-quality video meetings for everyone. Secure, reliable, and free to use.
          </p>
        </motion.div>

        <div className="flex justify-center gap-6 mb-16">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/create')}
            className="px-8 py-4 bg-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:bg-indigo-700 transition-colors"
          >
            Start a Meeting
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/join')}
            className="px-8 py-4 bg-gray-800 text-indigo-400 rounded-lg font-semibold shadow-lg hover:bg-gray-700 transition-colors border border-indigo-500"
          >
            Join a Meeting
          </motion.button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto"
        >
          <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
            <Video className="w-12 h-12 text-indigo-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-white">Crystal Clear Video</h3>
            <p className="text-gray-300">Experience HD video quality with minimal latency.</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
            <Users className="w-12 h-12 text-indigo-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-white">Group Meetings</h3>
            <p className="text-gray-300">Connect with multiple participants seamlessly.</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
            <Zap className="w-12 h-12 text-indigo-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-white">Instant Connect</h3>
            <p className="text-gray-300">No downloads needed. Join meetings in one click.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LandingPage;