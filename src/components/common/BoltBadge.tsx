import React from 'react';

export const BoltBadge: React.FC = () => {
  return (
    <a
      href="https://bolt.new/"
      target="_blank"
      rel="noopener noreferrer"
      className="group transition-transform duration-200 hover:scale-110"
      title="Built with Bolt.new"
    >
      <img
        src="/white_circle_360x360.png"
        alt="Built with Bolt.new"
        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-lg group-hover:shadow-xl group-hover:shadow-blue-500/20 transition-shadow duration-200"
      />
    </a>
  );
};