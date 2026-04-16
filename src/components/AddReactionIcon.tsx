import React from 'react';
import Svg, { Circle, Path, Line } from 'react-native-svg';

interface AddReactionIconProps {
  size?: number;
  color?: string;
}

/**
 * A ghost-emoji face with a "+" badge — communicates "add your own reaction".
 * Renders as a simple SVG so it scales cleanly at any size.
 */
export function AddReactionIcon({ size = 28, color = '#9CA3AF' }: AddReactionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Face circle */}
      <Circle cx="15" cy="17" r="12" stroke={color} strokeWidth="2" fill="none" />
      {/* Left eye */}
      <Circle cx="11" cy="15" r="1.5" fill={color} />
      {/* Right eye */}
      <Circle cx="19" cy="15" r="1.5" fill={color} />
      {/* Smile arc */}
      <Path
        d="M10.5 20.5 C12 23, 18 23, 19.5 20.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Plus badge background */}
      <Circle cx="25.5" cy="6.5" r="6.5" fill={color} />
      {/* Plus horizontal */}
      <Line x1="22.5" y1="6.5" x2="28.5" y2="6.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      {/* Plus vertical */}
      <Line x1="25.5" y1="3.5" x2="25.5" y2="9.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
