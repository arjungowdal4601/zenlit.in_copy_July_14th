import React from 'react';

interface Props {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const Avatar: React.FC<Props> = ({
  src,
  alt,
  size = 'md',
  onClick
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className="relative inline-block">
      <img
        src={src || undefined}
        alt={alt}
        className={`
          ${sizeClasses[size]}
          rounded-full
          object-cover
          cursor-pointer
          ring-2
          ring-blue-500
        `}
        onClick={onClick}
      />
    </div>
  );
};