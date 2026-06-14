import { useMemo } from 'react';

const GEAR_EMOJIS = ['🎒', '🧭', '⛺', '🏔️', '🔥', '🥾', '🗺️', '🔭', '🌲', '🪵', '🛶', '🔦'];

function AdventureGearCelebration({ count = 18 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        emoji: GEAR_EMOJIS[Math.floor(Math.random() * GEAR_EMOJIS.length)],
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.2 + Math.random() * 1.6,
        size: 1.25 + Math.random() * 1.25,
        spin: 180 + Math.random() * 360,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 animate-[gearFall_linear_forwards]"
          style={{
            left: `${piece.left}%`,
            fontSize: `${piece.size}rem`,
            animationDuration: `${piece.duration}s`,
            animationDelay: `${piece.delay}s`,
            '--gear-spin': `${piece.spin}deg`,
          }}
        >
          {piece.emoji}
        </span>
      ))}
    </div>
  );
}

export default AdventureGearCelebration;
