import React, { useRef } from 'react';
import { GridNodeData } from '../types';

interface MinimapProps {
  nodes: GridNodeData[];
  transform: { x: number; y: number; scale: number };
  onCenterViewport: (x: number, y: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({ nodes, transform, onCenterViewport }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (nodes.length === 0) return null;

  // Find bounds of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + 400); // approximate node height
  });

  // Add padding
  const padding = 500;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const width = Math.max(maxX - minX, 100);
  const height = Math.max(maxY - minY, 100);

  // Minimap dimensions
  const mapWidth = 200;
  const mapHeight = 150;

  // Scale map
  const scaleX = mapWidth / width;
  const scaleY = mapHeight / height;
  const mapScale = Math.min(scaleX, scaleY);

  const renderWidth = width * mapScale;
  const renderHeight = height * mapScale;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };

  const updateFromPointer = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - (mapWidth - renderWidth) / 2;
    const y = e.clientY - rect.top - (mapHeight - renderHeight) / 2;

    const targetX = (x / mapScale) + minX;
    const targetY = (y / mapScale) + minY;
    
    onCenterViewport(targetX, targetY);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
      // Allow drag to pan minimap 
      if(e.buttons === 1) {
         updateFromPointer(e);
      }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  // Viewport rect
  const viewportWidth = window.innerWidth / transform.scale;
  const viewportHeight = window.innerHeight / transform.scale;
  const viewportX = -transform.x / transform.scale;
  const viewportY = -transform.y / transform.scale;

  const viewRectX = (viewportX - minX) * mapScale;
  const viewRectY = (viewportY - minY) * mapScale;
  const viewRectW = viewportWidth * mapScale;
  const viewRectH = viewportHeight * mapScale;

  return (
    <div 
      ref={containerRef}
      className="bg-[#FFFBEA] border-2 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center overflow-hidden relative cursor-pointer group"
      style={{ width: mapWidth, height: mapHeight }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div 
        className="relative" 
        style={{ width: renderWidth, height: renderHeight }}
      >
        {/* Draw edges */}
        {nodes.filter(n => n.parentId).map(node => {
          const parent = nodes.find(n => n.id === node.parentId);
          if (!parent) return null;
          
          const px = (parent.x + parent.width - minX) * mapScale;
          const py = (parent.y + 200 - minY) * mapScale;
          const cx = (node.x - minX) * mapScale;
          const cy = (node.y + 200 - minY) * mapScale;

          return (
            <svg key={`line-${node.id}`} className="absolute top-0 left-0 overflow-visible pointer-events-none" style={{ width: '100%', height: '100%' }}>
              <line x1={px} y1={py} x2={cx} y2={cy} stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
            </svg>
          );
        })}

        {/* Draw nodes */}
        {nodes.map(node => {
          const nx = (node.x - minX) * mapScale;
          const ny = (node.y - minY) * mapScale;
          const nw = node.width * mapScale;
          const nh = 400 * mapScale;

          return (
            <div 
              key={node.id} 
              className="absolute bg-black rounded-[1px] pointer-events-none group-hover:bg-blue-600 transition-colors"
              style={{
                left: nx,
                top: ny,
                width: Math.max(nw, 4),
                height: Math.max(nh, 4),
              }}
            />
          );
        })}

        {/* Viewport rect */}
        <div 
          className="absolute border-[1.5px] border-red-500 bg-red-500/10 pointer-events-none transition-all duration-75"
          style={{
            left: viewRectX,
            top: viewRectY,
            width: viewRectW,
            height: viewRectH
          }}
        />
      </div>
    </div>
  );
};
