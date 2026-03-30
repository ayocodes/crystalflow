import { Colour } from './utils/colour.js';
import { extractCellData, getAverageColor, isBlackFrame } from './utils/buffer-utils.js';
import type { RGB } from './types.js';

export interface SceneDetectionConfig {
  gridCols: number;
  gridRows: number;
  deltaThreshold: number;
  skipBlackFrames: boolean;
}

export const DEFAULT_CONFIG: SceneDetectionConfig = {
  gridCols: 8,
  gridRows: 4,
  deltaThreshold: 12,
  skipBlackFrames: true,
};

export class SceneDetector {
  private previousColors: RGB[] = [];
  private hasFirstValidFrame: boolean = false;
  private config: SceneDetectionConfig;

  constructor(config: Partial<SceneDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  analyzeFrame(
    rgbaData: Uint8Array,
    width: number,
    height: number
  ): {
    isNewScene: boolean;
    colors: RGB[];
    deltaE: number;
    reason?: string;
  } {
    const { gridCols, gridRows, deltaThreshold, skipBlackFrames } = this.config;
    const colors: RGB[] = [];
    const cellWidth = Math.floor(width / gridCols);
    const cellHeight = Math.floor(height / gridRows);
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cellData = extractCellData(rgbaData, width, height, col, row, gridCols, gridRows);
        const avgColor = getAverageColor(cellData, cellWidth, cellHeight);
        colors.push(avgColor);
      }
    }
    if (!this.hasFirstValidFrame && skipBlackFrames && isBlackFrame(colors)) {
      return { isNewScene: false, colors, deltaE: 0, reason: 'black_frame' };
    }
    if (this.previousColors.length === 0) {
      this.previousColors = colors;
      this.hasFirstValidFrame = true;
      return { isNewScene: true, colors, deltaE: 0, reason: 'first_frame' };
    }
    const deltaEs: number[] = [];
    for (let i = 0; i < colors.length; i++) {
      const color1 = colors[i];
      const color2 = this.previousColors[i];
      const [l1, a1, b1] = Colour.rgba2lab(color1.r, color1.g, color1.b);
      const [l2, a2, b2] = Colour.rgba2lab(color2.r, color2.g, color2.b);
      const delta = Colour.deltaE00(l1, a1, b1, l2, a2, b2);
      deltaEs.push(delta);
    }
    const avgDeltaE = deltaEs.reduce((sum, d) => sum + d, 0) / deltaEs.length;
    const isNewScene = avgDeltaE > deltaThreshold;
    if (isNewScene) {
      this.previousColors = colors;
      this.hasFirstValidFrame = true;
    }
    return { isNewScene, colors, deltaE: avgDeltaE, reason: isNewScene ? 'scene_change' : 'similar' };
  }

  reset(): void {
    this.previousColors = [];
    this.hasFirstValidFrame = false;
  }
}
