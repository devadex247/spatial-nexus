import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { GridNodeData } from '../types';

import ReactMarkdown from 'react-markdown';

const Typewriter = ({ text, onExpand, nodeId }: { text: string, onExpand: (prompt: string, parentId: string) => void, nodeId: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  // Pre-process text to fix bad markdown links where href has spaces
  const processedText = (text || '').replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, (match, p1, p2) => {
    return `[${p1}](${p2.replace(/\s/g, '%20')})`;
  });
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const charsPerTick = Math.max(1, Math.floor(processedText.length / 100)); // adjust speed
    const interval = setInterval(() => {
      if (i >= processedText.length) {
        clearInterval(interval);
      } else {
        setDisplayedText(processedText.slice(0, i + charsPerTick));
        i += charsPerTick;
      }
    }, 20);
    return () => clearInterval(interval);
  }, [processedText]);

  return (
    <div className="whitespace-pre-wrap">
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => (
            <button 
              type="button"
              className="font-bold underline decoration-black decoration-2 hover:bg-yellow-200 transition-colors mx-1 inline"
              onClick={(e) => {
                e.stopPropagation();
                // Safely extract string from children if possible, or fallback to href
                let promptText = props.href || "";
                if (promptText.startsWith('#')) promptText = promptText.substring(1);
                promptText = decodeURIComponent(promptText);
                
                // If it's a relative link or something else, prefer to use children text if it's string
                if (Array.isArray(props.children) && typeof props.children[0] === 'string') {
                  promptText = props.children[0];
                } else if (typeof props.children === 'string') {
                  promptText = props.children;
                }
                onExpand(promptText, nodeId);
              }}
            >
              {props.children}
            </button>
          )
        }}
      >
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};

const LOADING_MESSAGES = [
  "Searching the internet...",
  "Looking for connections...",
  "Gathering the cool bits...",
  "Brewing some ideas...",
  "Almost there..."
];

const FunLoader = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 flex flex-col items-center justify-center text-center gap-6 min-h-[400px]">
      <div className="relative h-6 w-full flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute font-mono text-sm uppercase tracking-wider text-black w-full text-center font-bold"
          >
            {LOADING_MESSAGES[index]}
          </motion.div>
        </AnimatePresence>
      </div>
      <Loader2 className="w-8 h-8 animate-spin text-black" />
      <div className="absolute -inset-2 border-2 border-dashed border-gray-200 pointer-events-none rounded opacity-50"></div>
    </div>
  );
};

interface NodeCardProps {
  index: number;
  node: GridNodeData;
  onExpand: (prompt: string, parentId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onClose: (nodeId: string) => void;
  setVersion: (nodeId: string, versionIndex: number) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({ 
  index,
  node, 
  onExpand, 
  onRegenerate, 
  onClose,
  setVersion,
  onPointerDown
}) => {
  const version = node.versions[node.versionIndex] || node;
  const isGenerating = node.status === 'generating';
  
  const versionText = `${index + 1}.${node.versionIndex}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        zIndex: 10
      }}
      className="flex flex-col gap-2 origin-top-left"
    >
      {/* Node Toolbar */}
      <div 
        className="flex items-center gap-2 text-xs font-mono cursor-grab active:cursor-grabbing w-fit"
        onPointerDown={(e) => onPointerDown?.(e)}
      >
        <div className="bg-white border border-black rounded-full px-3 py-1.5 shadow-[2px_2px_0px_#000] flex items-center gap-3">
          <span className="font-bold">NODE {versionText}</span>
          
          <div className="h-3 w-px bg-gray-300"></div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setVersion(node.id, Math.max(0, node.versionIndex - 1))}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={node.versionIndex === 0}
              className="hover:bg-gray-100 p-0.5 rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="w-8 text-center">{node.versionIndex + 1}/{node.versions.length || 1}</span>
            <button 
              onClick={() => setVersion(node.id, Math.min(node.versions.length - 1, node.versionIndex + 1))}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={node.versionIndex === node.versions.length - 1}
              className="hover:bg-gray-100 p-0.5 rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="h-3 w-px bg-gray-300"></div>
          
          <span className="w-16">
            {isGenerating ? '---' : `${version.text?.length || 0} CH`}
          </span>
          
          <div className="h-3 w-px bg-gray-300"></div>
          
          <button 
            onClick={() => onRegenerate(node.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="hover:text-blue-600 transition-colors cursor-pointer"
            title="Regenerate"
          >
            <Sparkles size={14} />
          </button>
          
          <button 
            onClick={() => onClose(node.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="hover:text-red-600 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div 
        className="flex flex-col shadow-[4px_4px_0px_#000] bg-white border-2 border-black rounded relative z-10"
        onPointerDown={(e) => onPointerDown?.(e)}
      >
        
        {/* Stacked effect base lines if multiple versions */}
        {node.versions.length > 1 && (
          <>
            <div className="absolute top-1 -right-1.5 w-full h-full border-r-2 border-t-2 border-black rounded bg-white -z-10 shadow-[2px_2px_0px_#000]" />
            <div className="absolute top-2 -right-3 w-full h-full border-r-2 border-t-2 border-black rounded bg-white -z-20 shadow-[2px_2px_0px_#000]" />
          </>
        )}

        {node.status === 'error' ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
            <div className="text-red-500 mb-2">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
            <div className="font-mono text-sm uppercase tracking-wider text-red-500">
              SYSTEM_FAULT:<br/>NEURAL ENGINE FAILURE
            </div>
            <div className="text-xs text-gray-500 mt-2 font-mono">Unable to process prompt. Please try regenerating.</div>
            <div className="absolute -inset-2 border-2 border-dashed border-red-300 pointer-events-none rounded opacity-50"></div>
          </div>
        ) : isGenerating ? (
          <FunLoader />
        ) : (
          <>
            {/* Visual Header / Image */}
            <div className={`bg-[#f8f9fa] border-b-2 border-black overflow-hidden flex items-center justify-center relative ${version.imageUrl ? 'min-h-[300px]' : 'min-h-[200px]'}`}>
              {version.imageUrl ? (
                <img 
                  src={version.imageUrl} 
                  alt={node.prompt} 
                  className="w-full h-[300px] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : version.imageLoading ? (
                 <div className="flex flex-col items-center gap-2 py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">Generating Visual Data...</span>
                 </div>
              ) : version.asciiArt ? (
                <pre className="text-gray-800 whitespace-pre font-mono p-4 text-[10px] sm:text-xs leading-tight mx-auto">
                  {version.asciiArt}
                </pre>
              ) : (
                <span className="font-mono text-[10px] text-gray-400 py-16 uppercase tracking-widest">No Visual Data</span>
              )}
            </div>
            
            {/* Text Content */}
            <div 
              className="p-5 min-h-[300px] max-h-[400px] overflow-y-auto custom-scrollbar text-sm leading-relaxed cursor-text selection:bg-yellow-200"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-3 uppercase tracking-tight">{node.prompt}</h3>
              <Typewriter text={version.text} onExpand={onExpand} nodeId={node.id} />
            </div>
          </>
        )}
      </div>

      {/* Suggested Prompts (Spawning Side) */}
      <AnimatePresence>
        {!isGenerating && version.prompts && version.prompts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.3 } }}
            className="absolute left-full bottom-0 ml-[20px] flex flex-col gap-3 w-64"
          >
            {version.prompts.map((prompt: string, idx: number) => (
              <div key={idx} className="relative group">
                {/* Visual solid horizontal line bridging the 20px gap */}
                <div className="absolute top-1/2 right-full w-[20px] h-[2px] bg-black" />
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand(prompt, node.id);
                  }}
                  className="w-full relative bg-[#FFFBEA] border border-black p-3 text-left shadow-[2px_2px_0px_rgba(0,0,0,0.2)] hover:shadow-[2px_2px_0px_#000] hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all text-xs font-medium cursor-pointer block"
                >
                  {prompt}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
