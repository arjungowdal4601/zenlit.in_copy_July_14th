import React from 'react';

export const BoltBadge: React.FC = () => {
  return (
    <a
      href="https://bolt.new/"
      target="_blank"
      rel="noopener noreferrer"
      className="group transition-transform duration-200 hover:scale-110 flex-shrink-0"
      title="Built with Bolt.new"
    >
      <div className="relative">
        <img
          src="/white_circle_360x360.png"
          alt="Built with Bolt.new"
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-lg transition-shadow duration-200 group-hover:shadow-xl group-hover:shadow-blue-500/20"
        />
        {/* Optional glow effect on hover */}
        <div className="absolute inset-0 rounded-full bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 blur-sm" />
      </div>
    </a>
  );
};