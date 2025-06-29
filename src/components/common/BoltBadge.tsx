import React from 'react';

export const BoltBadge: React.FC = () => {
  return (
    <a
      href="https://bolt.new/"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-4 right-4 z-50 group transition-transform duration-200 hover:scale-110"
      title="Built with Bolt.new"
    >
      <img
        src="/white_circle_360x360.png"
        alt="Built with Bolt.new"
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg group-hover:shadow-xl group-hover:shadow-blue-500/20 transition-shadow duration-200"
      />
    </a>
  );
};