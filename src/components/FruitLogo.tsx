import React from 'react';

export type FruitLogoKind = 'orange' | 'lychee' | 'apple' | 'pomelo' | 'guava';

const fruitMarks: Record<FruitLogoKind, string> = {
  orange: '🍊',
  lychee: '🍒',
  apple: '🍎',
  pomelo: '🍐',
  guava: '🥝',
};

const fruitLabels: Record<FruitLogoKind, string> = {
  orange: 'Logo cam',
  lychee: 'Logo vải',
  apple: 'Logo táo',
  pomelo: 'Logo bưởi',
  guava: 'Logo ổi',
};

interface FruitLogoProps {
  fruit: FruitLogoKind;
  className?: string;
}

/** Fruit marks replace the former generic AI sparkle and bot branding. */
export const FruitLogo: React.FC<FruitLogoProps> = ({ fruit, className = '' }) => (
  <span
    className={`inline-flex items-center justify-center leading-none ${className}`}
    role="img"
    aria-label={fruitLabels[fruit]}
  >
    {fruitMarks[fruit]}
  </span>
);
