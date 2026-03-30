export type CodecName = 'h264' | 'hevc' | 'vp8' | 'vp9' | 'av1' | 'default';

interface VariantConfig {
  packageName: string;
  variantName: string;
  supported: boolean;
}

const CODEC_TO_VARIANT: Record<CodecName, VariantConfig> = {
  h264: {
    packageName: '@wcpeter/libav.js-h264',
    variantName: 'h264parseaacdecode',
    supported: false,
  },
  hevc: {
    packageName: '',
    variantName: 'hevc-aac',
    supported: false,
  },
  vp8: {
    packageName: '@libav.js/variant-webm',
    variantName: 'webm',
    supported: true,
  },
  vp9: {
    packageName: '@libav.js/variant-webm-vp9',
    variantName: 'webm-vp9',
    supported: true,
  },
  av1: {
    packageName: '@libav.js/variant-av1-opus',
    variantName: 'av1-opus',
    supported: true,
  },
  default: {
    packageName: '@libav.js/variant-default',
    variantName: 'default',
    supported: true,
  },
};

const CODEC_ID_MAP: Record<number, CodecName> = {
  27: 'h264',
  173: 'hevc',
  139: 'vp8',
  167: 'vp9',
  225: 'av1',
  226: 'av1',
};

export function getCodecName(codecId: number): CodecName | null {
  return CODEC_ID_MAP[codecId] || null;
}

export function getVariantConfig(codecName: CodecName): VariantConfig {
  return CODEC_TO_VARIANT[codecName];
}

export function isCodecSupported(codecName: CodecName): boolean {
  return CODEC_TO_VARIANT[codecName]?.supported || false;
}

export async function loadLibAVVariant(codecName: CodecName): Promise<any> {
  const config = getVariantConfig(codecName);
  if (!config.supported) {
    throw new Error(`Codec ${codecName} is not supported (no build available)`);
  }
  switch (codecName) {
    case 'vp8':
      return (await import('@libav.js/variant-webm')).default;
    case 'vp9':
      return (await import('@libav.js/variant-webm-vp9')).default;
    case 'av1':
      return (await import('@libav.js/variant-av1-opus')).default;
    case 'default':
      return (await import('@libav.js/variant-default')).default;
    default:
      throw new Error(`Unknown codec: ${codecName}`);
  }
}
