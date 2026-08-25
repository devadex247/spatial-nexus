export interface GridNodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  prompt: string;
  asciiArt: string;
  text: string;
  prompts: string[];
  status: 'generating' | 'ready' | 'error';
  versionIndex: number;
  versions: NodeVersion[];
  parentId?: string;
}

export interface NodeVersion {
  prompt: string;
  asciiArt: string;
  text: string;
  prompts: string[];
}

declare global {
  interface Window {
    aistudio?: {
      openSelectKey?: () => Promise<boolean | void>;
    };
  }
}
