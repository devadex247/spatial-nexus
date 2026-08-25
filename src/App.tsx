import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Play, Sparkles, ZoomIn, ZoomOut, MessageSquare, Share } from 'lucide-react';
import { GridNodeData } from './types';
import { NodeCard } from './components/NodeCard';
import { ConnectingLines } from './components/ConnectingLines';
import { Minimap } from './components/Minimap';
import { motion } from 'motion/react';

const NODE_WIDTH = 400;

export default function App() {
  const [nodes, setNodes] = useState<GridNodeData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [hasLinkedKey, setHasLinkedKey] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  // Canvas Transform State
  const [transform, setTransform] = useState({ 
    x: 0, 
    y: 0, 
    scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 0.85 
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartInfo = useRef({ x: 0, y: 0, transformX: 0, transformY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodeDragStartInfo = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  // Focus tracking
  const [activeNode, setActiveNode] = useState<string | null>(null);

  // Panning Support
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only pan on left click background
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStartInfo.current = {
        x: e.clientX,
        y: e.clientY,
        transformX: transform.x,
        transformY: transform.y,
      };
      // prevent selection while dragging
      e.preventDefault();
    }
  };

  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    // Only allow drag if clicking the header or specific handle, handled by the event target in NodeCard
    e.stopPropagation();
    // Capture pointer on the element being grabbed so fast drags don't break
    e.currentTarget.setPointerCapture(e.pointerId);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    nodeDragStartInfo.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStartInfo.current.x;
      const dy = e.clientY - dragStartInfo.current.y;
      setTransform(prev => ({
        ...prev,
        x: dragStartInfo.current.transformX + dx,
        y: dragStartInfo.current.transformY + dy,
      }));
    } else if (draggingNodeId) {
      const dx = (e.clientX - nodeDragStartInfo.current.x) / transform.scale;
      const dy = (e.clientY - nodeDragStartInfo.current.y) / transform.scale;
      setNodes(prev => prev.map(n => 
        n.id === draggingNodeId ? { ...n, x: nodeDragStartInfo.current.nodeX + dx, y: nodeDragStartInfo.current.nodeY + dy } : n
      ));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setDraggingNodeId(null);
    if ((e.target as HTMLElement).hasPointerCapture && (e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Disable zooming for now, just pan
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = -e.deltaY * 0.002;
      handleZoom(zoomFactor, e.clientX, e.clientY);
    } else {
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleZoom = (delta: number, originX?: number, originY?: number) => {
    setTransform(prev => {
      const newScale = Math.min(Math.max(0.2, prev.scale + delta), 3);
      
      if (originX === undefined || originY === undefined) {
        // Zoom to center if no origin given
        originX = window.innerWidth / 2;
        originY = window.innerHeight / 2;
      }

      // Adjust x and y to keep the zoom centered on the pointer
      const scaleRatio = newScale / prev.scale;
      const newX = originX - (originX - prev.x) * scaleRatio;
      const newY = originY - (originY - prev.y) * scaleRatio;

      return { x: newX, y: newY, scale: newScale };
    });
  };

  const centerOnPosition = useCallback((x: number, y: number) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform(prev => ({
      ...prev,
      x: hw - x * prev.scale - (NODE_WIDTH / 2) * prev.scale,
      y: hh - y * prev.scale - 200 * prev.scale
    }));
  }, []);

  const handleCenterViewport = useCallback((x: number, y: number) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform(prev => ({
      ...prev,
      x: hw - x * prev.scale,
      y: hh - y * prev.scale
    }));
  }, []);

  const generateNode = async (prompt: string, x: number, y: number, parentId?: string, isRegenerationOf?: string) => {
    const id = isRegenerationOf || `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create new node or update existing to 'generating'
    if (isRegenerationOf) {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, status: 'generating' } : n));
    } else {
      const newNode: GridNodeData = {
        id, x, y,
        width: NODE_WIDTH,
        prompt,
        asciiArt: '',
        imageUrl: '',
        text: '',
        prompts: [],
        status: 'generating',
        versionIndex: 0,
        versions: [],
        parentId
      };
      setNodes(prev => [...prev, newNode]);
    }
    
    // Center view locally
    // Use timeout to let render happen first
    setTimeout(() => centerOnPosition(x, y), 50);

    try {
      // 1. Fetch text
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      let insertIndex = 0;

      setNodes(prev => prev.map(node => {
        if (node.id === id) {
          insertIndex = isRegenerationOf ? node.versions.length : 0;
          const newVersion = {
            prompt,
            asciiArt: '',
            imageUrl: '',
            imageLoading: true,
            text: data.text || 'No text',
            prompts: data.prompts || [],
          };
          
          return {
            ...node,
            status: 'ready',
            versions: isRegenerationOf ? [...node.versions, newVersion] : [newVersion],
            versionIndex: insertIndex,
            text: newVersion.text,
            asciiArt: newVersion.asciiArt,
            imageUrl: newVersion.imageUrl,
            prompts: newVersion.prompts,
          };
        }
        return node;
      }));

      // 2. Fetch image
      fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      }).then(r => r.json()).then(imgData => {
        if (imgData.imageUrl) {
          setNodes(prev => prev.map(node => {
            if (node.id === id) {
              const versions = [...node.versions];
              if (versions[insertIndex]) {
                versions[insertIndex] = { ...versions[insertIndex], imageUrl: imgData.imageUrl, imageLoading: false };
              }
              const isCurrentVersion = node.versionIndex === insertIndex;
              return {
                ...node,
                versions,
                ...(isCurrentVersion ? { imageUrl: imgData.imageUrl } : {})
              };
            }
            return node;
          }));
        } else {
           setNodes(prev => prev.map(node => {
            if (node.id === id) {
              const versions = [...node.versions];
              if (versions[insertIndex]) {
                versions[insertIndex] = { ...versions[insertIndex], imageLoading: false };
              }
              return { ...node, versions };
            }
            return node;
          }));
        }
      }).catch(err => {
         console.error('Image fetch error:', err);
         setNodes(prev => prev.map(node => {
            if (node.id === id) {
              const versions = [...node.versions];
              if (versions[insertIndex]) {
                versions[insertIndex] = { ...versions[insertIndex], imageLoading: false };
              }
              return { ...node, versions };
            }
            return node;
          }));
      });

    } catch (error) {
      console.error(error);
      setNodes(prev => prev.map(node => node.id === id ? { ...node, status: 'error' } : node));
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const startX = 0;
    const startY = 0;
    const executeSearch = () => {
      generateNode(searchQuery, startX, startY);
      setSearchQuery('');
    };

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          executeSearch();
        }
        return;
      } else {
        setPendingAction(() => executeSearch);
        setShowBillingModal(true);
        return;
      }
    }

    executeSearch();
  };

  const handleMagicWand = async () => {
    const ideas = ["Evolution of Video Games", "Quantum Entanglement", "Rise of the Roman Empire", "History of Artificial Intelligence", "Deep Sea Ecosystems"];
    const text = ideas[Math.floor(Math.random() * ideas.length)];
    
    const executeMagicWand = () => {
      generateNode(text, 0, 0);
    };

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          executeMagicWand();
        }
        return;
      } else {
        setPendingAction(() => executeMagicWand);
        setShowBillingModal(true);
        return;
      }
    }

    executeMagicWand();
  };

  const handleExpand = (prompt: string, parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    
    // Spawn to the right
    const newX = parent.x + parent.width + 400; // 400px gap for prompts and connections
    
    // Add initial offset so the line is never perfectly straight
    const initialOffset = Math.random() > 0.5 ? 200 : -200;
    let newY = parent.y + initialOffset;
    const estimatedHeight = 850; // Average node height to avoid overlap
    
    let isOccupied = true;
    let offsetMultiplier = 1;
    let direction = Math.random() > 0.5 ? 1 : -1; // 1 for down, -1 for up
    
    while (isOccupied) {
      isOccupied = nodes.some(n => 
        Math.abs(n.x - newX) < 200 && // Roughly in the same column
        Math.abs(n.y - newY) < estimatedHeight // Overlaps vertically
      );
      
      if (isOccupied) {
        newY = parent.y + initialOffset + (estimatedHeight * offsetMultiplier * direction);
        direction *= -1;
        if (direction === 1) {
          offsetMultiplier++;
        }
      }
    }
    
    generateNode(prompt, newX, newY, parentId);
  };

  const handleRegenerate = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      generateNode(node.prompt, node.x, node.y, node.parentId, nodeId);
    }
  };

  const handleDelete = (nodeId: string) => {
    // Delete this node and all descendants
    const getDescendants = (id: string, allNodes: GridNodeData[]): string[] => {
      const children = allNodes.filter(n => n.parentId === id).map(n => n.id);
      let desc = [...children];
      for (const childId of children) {
        desc = [...desc, ...getDescendants(childId, allNodes)];
      }
      return desc;
    };
    
    const toDelete = [nodeId, ...getDescendants(nodeId, nodes)];
    setNodes(prev => prev.filter(n => !toDelete.includes(n.id)));
  };

  const setVersion = (nodeId: string, versionIndex: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, versionIndex } : n));
  };
  
  const totalChars = nodes.reduce((acc, node) => acc + ((node.versions[node.versionIndex]?.text?.length) || 0), 0);

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden dot-grid canvas-bg"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Draggable/Zoomable Canvas */}
      <div 
        className="absolute top-0 left-0 origin-top-left canvas-bg"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width: '100%',
          height: '100%'
        }}
      >
        <ConnectingLines nodes={nodes} />
        {nodes.map((node, index) => (
          <NodeCard 
            key={node.id} 
            index={index}
            node={node} 
            onExpand={handleExpand}
            onRegenerate={handleRegenerate}
            onClose={handleDelete}
            setVersion={setVersion}
            onPointerDown={(e) => handleNodePointerDown(e, node.id)}
          />
        ))}
      </div>

      {/* Initial Search UI */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
          <h1 
            className="font-tomorrow font-bold text-4xl md:text-[60px] tracking-[-0.02em] mb-4 md:mb-2 text-black pointer-events-auto"
          >
            GRIDSCAPE
          </h1>
          <div className="pointer-events-auto w-full max-w-2xl bg-white border-2 border-black p-2 md:p-2 shadow-[4px_4px_0px_#000] md:shadow-[8px_8px_0px_#000] flex flex-col sm:flex-row gap-2 sm:gap-0">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex px-2 sm:px-4 items-center">
              <Search className="text-gray-400 mr-2 sm:mr-3 shrink-0" size={20} />
              <input
                autoFocus
                className="flex-1 outline-none font-sans text-base sm:text-lg lg:text-xl py-2 sm:py-3 w-full"
                placeholder="What do you want to explore?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={handleSearchSubmit}
                className="flex-1 sm:flex-none sm:w-12 h-12 bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <Play fill="currentColor" size={20} />
              </button>
              <button 
                onClick={handleMagicWand}
                className="flex-1 sm:flex-none sm:w-12 h-12 border-2 border-black text-black bg-yellow-100 flex items-center justify-center hover:bg-yellow-200 transition-colors cursor-pointer"
              >
                <Sparkles size={20} />
              </button>
            </div>
          </div>
          <div className="mt-6 md:mt-8 text-center text-[10px] md:text-xs font-mono text-gray-500 max-w-lg leading-relaxed uppercase tracking-widest px-4 md:px-0">
            GRIDSCAPE IS AN INFINITE SPATIAL-KNOWLEDGE-ENGINE FOR MAPPING COMPLEX IDEAS... START WITH ANY TOPIC AND GENERATE NON-LINEAR RESEARCH NODES...
          </div>
        </div>
      )}

      {/* Floating UI Elements */}
      
      {nodes.length > 0 && (
        <>
          {/* Capacity Badge */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none md:bottom-6 md:left-6 md:translate-x-0 hidden md:block">
            <div className="bg-black text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full font-mono text-[8px] md:text-[10px] uppercase tracking-widest shadow-lg">
              CAPACITY: {nodes.length} NODES
            </div>
          </div>

          {/* Tools Menu & Minimap */}
          <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 pointer-events-auto flex flex-col items-end gap-2 md:gap-4">
            <div className="hidden md:block">
              <Minimap
                nodes={nodes}
                transform={transform}
                onCenterViewport={handleCenterViewport}
              />
            </div>
            
            <div className="bg-black text-white p-1 rounded-xl flex items-center shadow-2xl">
              <div className="hidden sm:block px-4 font-mono text-[10px] min-w-[100px] text-center border-r border-gray-700">
                {totalChars} CHARS
              </div>
              
              <button 
                onClick={() => handleZoom(-0.2)}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-800 rounded-lg transition-colors mx-1 cursor-pointer"
              >
                <ZoomOut size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
              
              <button 
                onClick={() => handleZoom(0.2)}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-800 rounded-lg transition-colors mr-1 cursor-pointer"
              >
                <ZoomIn size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
            </div>
          </div>
        </>
      )}
{/* Support returning back to zero state search button */}
      {nodes.length > 0 && (
      <div className="absolute top-4 left-4 md:top-6 md:left-6">
            <button 
                onClick={() => {
                  setNodes([]);
                  setTransform({ 
                    x: 0, 
                    y: 0, 
                    scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 0.85 
                  });
                }}
                className="bg-white border-2 border-black text-[10px] md:text-xs font-mono font-bold px-3 py-2 md:px-4 md:py-2 hover:bg-red-50 hover:text-red-600 transition-colors shadow-[2px_2px_0px_#000] md:shadow-[4px_4px_0px_#000] cursor-pointer cursor-auto"
            >
                [ RESET CANVAS ]
            </button>
      </div>)}

      {showBillingModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#FFFBEA]/80 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg shadow-[4px_4px_0px_#000] md:shadow-[8px_8px_0px_#000] p-4 md:p-6 relative flex flex-col gap-4">
            <button 
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-black bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              onClick={() => {
                setShowBillingModal(false);
                setPendingAction(null);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <h2 className="font-sans font-bold text-lg md:text-xl pr-8 text-black leading-tight">
              This application uses premium AI models. You must select an API key from a Google Cloud project with a billing enabled. Free tier keys do not support these high end features.
            </h2>
            <p className="font-mono text-sm text-gray-700 leading-relaxed">
              Make sure your project is linked to a valid billing account. Check the pricing documentation for more details.
            </p>
            <button
              className="mt-2 bg-black text-white font-mono font-bold text-sm tracking-wide py-3 px-6 hover:bg-gray-800 transition-colors w-full border-2 border-black cursor-pointer"
              onClick={async () => {
                setShowBillingModal(false);
                if (window.aistudio && window.aistudio.openSelectKey) {
                  await window.aistudio.openSelectKey();
                  // Assume selection success to avoid delay
                  setHasLinkedKey(true);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                } else {
                  // Fallback if running outside aistudio
                  setHasLinkedKey(true);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                }
              }}
            >
              SELECT API KEY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
