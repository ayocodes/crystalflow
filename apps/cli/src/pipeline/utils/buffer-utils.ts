// Utilities for processing RGBA buffers

import type { RGB } from '../types.js';

/**
 * Extract a cell region from an RGBA buffer
 * @param data Full RGBA buffer (flat Uint8Array)
 * @param width Full frame width
 * @param height Full frame height
 * @param cellX Cell column index (0-7 for 8 columns)
 * @param cellY Cell row index (0-3 for 4 rows)
 * @param cols Total columns (8)
 * @param rows Total rows (4)
 */
export function extractCellData(
  data: Uint8Array,
  width: number,
  height: number,
  cellX: number,
  cellY: number,
  cols: number,
  rows: number
): Uint8Array {
  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);

  const startX = cellX * cellWidth;
  const startY = cellY * cellHeight;

  const cellData = new Uint8Array(cellWidth * cellHeight * 4);
  let cellIndex = 0;

  // Extract row by row from the full buffer
  for (let y = 0; y < cellHeight; y++) {
    const rowStartInFull = ((startY + y) * width + startX) * 4;
    const rowLength = cellWidth * 4;

    cellData.set(
      data.subarray(rowStartInFull, rowStartInFull + rowLength),
      cellIndex
    );
    cellIndex += rowLength;
  }

  return cellData;
}

/**
 * Calculate average color from RGBA cell data
 * @param cellData RGBA buffer for a single cell
 * @param width Cell width
 * @param height Cell height
 */
export function getAverageColor(
  cellData: Uint8Array,
  width: number,
  height: number
): RGB {
  const pixelCount = width * height;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i < cellData.length; i += 4) {
    r += cellData[i];
    g += cellData[i + 1];
    b += cellData[i + 2];
    // Skip alpha (i + 3)
  }

  return {
    r: Math.floor(r / pixelCount),
    g: Math.floor(g / pixelCount),
    b: Math.floor(b / pixelCount),
  };
}

/**
 * Check if a frame is mostly black
 * @param colors Array of RGB colors from grid cells
 * @param threshold RGB value below which is considered black (default 15)
 * @param ratio Minimum ratio of black cells to consider frame black (default 0.9)
 */
export function isBlackFrame(
  colors: RGB[],
  threshold: number = 15,
  ratio: number = 0.9
): boolean {
  const blackCells = colors.filter(
    ({ r, g, b }) => r < threshold && g < threshold && b < threshold
  );

  return blackCells.length / colors.length >= ratio;
}
