// YUV to RGB conversion utilities

/**
 * Convert YUV420P frame to RGBA
 * @param yPlane Y plane data
 * @param uPlane U plane data
 * @param vPlane V plane data
 * @param width Frame width
 * @param height Frame height
 * @param yStride Y plane stride (bytes per row, may be > width due to padding)
 * @param uStride U plane stride
 * @param vStride V plane stride
 * @returns Flat RGBA buffer
 */
export function yuv420pToRGBA(
  yPlane: Uint8Array,
  uPlane: Uint8Array,
  vPlane: Uint8Array,
  width: number,
  height: number,
  yStride: number = width,
  uStride: number = width >> 1,
  vStride: number = width >> 1
): Uint8Array {
  const rgbaData = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Use stride for plane indexing (handles padding)
      const yIndex = y * yStride + x;
      const uvIndex = (y >> 1) * uStride + (x >> 1);

      const Y = yPlane[yIndex];
      const U = uPlane[uvIndex] - 128;
      const V = vPlane[uvIndex] - 128;

      // YUV to RGB conversion
      let R = Y + 1.402 * V;
      let G = Y - 0.344136 * U - 0.714136 * V;
      let B = Y + 1.772 * U;

      // Clamp to 0-255
      R = Math.max(0, Math.min(255, R));
      G = Math.max(0, Math.min(255, G));
      B = Math.max(0, Math.min(255, B));

      // Use width for RGBA indexing (no padding in output)
      const rgbaIndex = (y * width + x) * 4;
      rgbaData[rgbaIndex] = R;
      rgbaData[rgbaIndex + 1] = G;
      rgbaData[rgbaIndex + 2] = B;
      rgbaData[rgbaIndex + 3] = 255; // Alpha
    }
  }

  return rgbaData;
}
