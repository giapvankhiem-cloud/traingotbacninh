import React from 'react';

interface LycheeLogoProps {
  className?: string;
}

/** The shared red-lychee mark used for the product and brand identity. */
export const LycheeLogo: React.FC<LycheeLogoProps> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center justify-center leading-none ${className}`}
    role="img"
    aria-label="Logo trái vải đỏ"
  >
    🍒
  </span>
);
