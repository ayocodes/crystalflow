// Types for libav.js video processing pipeline

export interface VideoInfo {
  codec: string;
  codecId: number;
  width: number;
  height: number;
  pixelFormat: number;
  duration: number;
  fps: number;
}

export interface SceneData {
  timestamp: number;
  colors: RGB[];
  deltaE: number;
  jpegBuffer: Buffer;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ProcessingProgress {
  stage: string;
  current: number;
  total: number;
  percentage: number;
}

export interface ProcessorCallbacks {
  onProgress?: (progress: ProcessingProgress) => void;
  onSceneDetected?: (scene: SceneData) => void;
  onError?: (error: Error) => void;
  onLog?: (message: string) => void;
}

export type CodecVariant = 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1';

// libav.js Stream type (from demuxer)
export interface LibAVStream {
  index: number;
  codec_type: number;
  codec_id: number;
  codecpar: {
    width: number;
    height: number;
    format: number;
  };
  time_base: [number, number];
  duration: number;
  format: number;
}
