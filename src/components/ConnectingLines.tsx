import React from 'react';
import { GridNodeData } from '../types';

interface ConnectingLinesProps {
  nodes: GridNodeData[];
}

export const ConnectingLines: React.FC<ConnectingLinesProps> = ({ nodes }) => {
  return (
    <svg 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'visible'
      }}
    >
      {nodes.map(node => {
        if (!node.parentId) return null;
        
        const parent = nodes.find(n => n.id === node.parentId);
        if (!parent) return null;

        // Parent connection point: right side, middle
        const startX = parent.x + parent.width;
        // Adjust startY slightly depending on where it spawns, but we use middle of parent card estimation
        // The card has a variable height, so we assume roughly 200px down for the center
        const startY = parent.y + 200; 

        // Child connection point: left side, middle
        const endX = node.x; 
        const endY = node.y + 200;

        // Create a horizontal sweeping bezier curve
        const cp1X = startX + (endX - startX) / 2;
        const cp1Y = startY;
        const cp2X = cp1X;
        const cp2Y = endY;

        return (
          <path
            key={`line-${node.id}`}
            d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
            fill="none"
            stroke="black"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        );
      })}
    </svg>
  );
};
