// Detect video container format from file header (magic bytes)

export type ContainerFormat = 'mp4' | 'webm' | 'mkv' | 'unknown';

export function detectContainerFormat(buffer: ArrayBuffer): ContainerFormat {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) {
    return 'unknown';
  }
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
    const docTypePos = findDocType(bytes);
    if (docTypePos !== -1) {
      const docType = String.fromCharCode(...bytes.slice(docTypePos, docTypePos + 4));
      if (docType === 'webm') {
        return 'webm';
      } else if (docType === 'matr') {
        return 'mkv';
      }
    }
    return 'webm';
  }
  if (bytes.length >= 8) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 &&
        bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'mp4';
    }
  }
  return 'unknown';
}

function findDocType(bytes: Uint8Array): number {
  for (let i = 0; i < Math.min(100, bytes.length - 4); i++) {
    if (bytes[i] === 0x42 && bytes[i + 1] === 0x82) {
      return i + 3;
    }
  }
  return -1;
}

export function getProbeCodec(container: ContainerFormat): 'vp9' | 'av1' | 'default' {
  switch (container) {
    case 'webm':
    case 'mkv':
      return 'vp9';
    case 'mp4':
      return 'default';
    default:
      return 'default';
  }
}
