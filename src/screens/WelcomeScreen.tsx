'use client'
import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  onGetStarted: () => void;
}

export const WelcomeScreen: React.FC<Props> = ({ onGetStarted }) => {
  return (
    <div className="auth-screen mobile-screen bg-black flex items-center justify-center p-4">
      <motion.div
        className="text-center w-full max-w-md"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="mb-12">
          <img
            src="/src/Picture2.png"
            alt="Zenlit"
            className="w-32 h-32 mx-auto object-contain rounded-lg mb-8"
          />
          
          <h1 className="text-5xl font-bold text-white">Zenlit</h1>
        </div>
        
        {/* Get Started Button */}
        <button
          onClick={onGetStarted}
          className="bg-blue-600 text-white px-12 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-lg"
        >
          Get Started
        </button>
      </motion.div>
    </div>
  );
};