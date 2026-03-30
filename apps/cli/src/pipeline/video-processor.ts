import { getCodecName, isCodecSupported, loadLibAVVariant, type CodecName } from './codec-router.js';
import { SceneDetector } from './scene-detector.js';
import type { VideoInfo, SceneData, ProcessingProgress, LibAVStream, ProcessorCallbacks } from './types.js';
import { yuv420pToRGBA } from './utils/yuv-to-rgb.js';
import { detectContainerFormat, getProbeCodec } from './container-detector.js';

export class VideoProcessor {
  private libav: any = null;
  private demuxerLibav: any = null;
  private sceneDetector: SceneDetector;
  private callbacks: ProcessorCallbacks;
  private videoInfo: VideoInfo | null = null;

  constructor(callbacks: ProcessorCallbacks = {}) {
    this.sceneDetector = new SceneDetector();
    this.callbacks = callbacks;
  }

  getVideoInfo(): VideoInfo | null {
    return this.videoInfo;
  }

  private log(message: string): void {
    if (this.callbacks.onLog) {
      this.callbacks.onLog(message);
    }
  }

  private logError(message: string): void {
    if (this.callbacks.onLog) {
      this.callbacks.onLog(`ERROR: ${message}`);
    }
  }

  async processVideo(videoFile: Buffer | ArrayBuffer, filename: string = 'video.mp4'): Promise<SceneData[]> {
    // Convert to ArrayBuffer
    let arrayBuffer: ArrayBuffer;
    if (Buffer.isBuffer(videoFile)) {
      arrayBuffer = new Uint8Array(videoFile).buffer as ArrayBuffer;
    } else {
      arrayBuffer = videoFile;
    }

    const scenes: SceneData[] = [];
    try {
      this.reportProgress('Detecting container...', 5, 100);
      const container = detectContainerFormat(arrayBuffer);
      this.log(`Detected container: ${container}`);
      if (container === 'unknown') {
        throw new Error('Unknown or unsupported container format');
      }
      const probeCodec = getProbeCodec(container);
      this.reportProgress('Loading demuxer...', 8, 100);
      await this.loadLibAV(probeCodec);
      this.log(`Loaded ${probeCodec} variant for probing ${container} container`);
      this.reportProgress('Probing video...', 10, 100);
      const videoInfo = await this.probeVideoWithLibAV(arrayBuffer, filename, false);
      this.videoInfo = videoInfo;
      this.log(`Video info: ${videoInfo.codec} ${videoInfo.width}x${videoInfo.height} @ ${videoInfo.fps.toFixed(2)}fps`);
      if (!isCodecSupported(videoInfo.codec as CodecName)) {
        throw new Error(`Codec ${videoInfo.codec} is not supported. Supported codecs: VP8, VP9, AV1`);
      }
      this.demuxerLibav = this.libav;
      if (videoInfo.codec !== probeCodec) {
        this.reportProgress(`Loading ${videoInfo.codec} decoder...`, 15, 100);
        await this.loadLibAV(videoInfo.codec as CodecName);
        this.log(`Using ${probeCodec} for demuxing, ${videoInfo.codec} for decoding`);
      } else {
        this.demuxerLibav = this.libav;
      }
      this.reportProgress('Initializing demuxer...', 20, 100);
      const [fmt_ctx, streams] = await this.demuxerLibav.ff_init_demuxer_file(filename);
      const videoStream = streams.find((s: LibAVStream) => s.codec_type === 0) as LibAVStream;
      if (!videoStream) {
        throw new Error('No video stream found');
      }
      this.reportProgress('Initializing decoder...', 25, 100);
      let decoderResult;
      try {
        decoderResult = await this.libav.ff_init_decoder(videoStream.codec_id, videoStream.codecpar);
      } catch (error) {
        throw new Error(`Failed to initialize decoder for codec ${videoInfo.codec} (id: ${videoStream.codec_id}): ${error}`);
      }
      const [, c, pkt, frame] = decoderResult;

      // Init MJPEG encoder for scene JPEG capture
      const [, encC, encFrame, encPkt] = await this.libav.ff_init_encoder("mjpeg", {
        ctx: {
          width: videoInfo.width,
          height: videoInfo.height,
          pix_fmt: 12, // AV_PIX_FMT_YUVJ420P
          global_quality: 80
        }
      });

      this.reportProgress('Reading packets...', 35, 100);
      const [, packetsByStream] = await this.demuxerLibav.ff_read_frame_multi(fmt_ctx, pkt);
      const packets = packetsByStream[videoStream.index] || [];
      this.log(`Read ${packets.length} packets from stream ${videoStream.index}`);
      const intervalMs = 500;
      const timeBase = videoStream.time_base || [1, 30];
      const timeBaseMs = (timeBase[0] / timeBase[1]) * 1000;
      const intervalTimeBase = Math.floor(intervalMs / timeBaseMs);
      let nextTargetTimestamp = 0;
      let processedCount = 0;
      this.sceneDetector.reset();

      for (let i = 0; i < packets.length; i++) {
        const packet = packets[i];
        if (packet.dts < nextTargetTimestamp) {
          continue;
        }
        nextTargetTimestamp = packet.dts + intervalTimeBase;
        processedCount++;
        const progress = 40 + Math.floor((i / packets.length) * 50);
        this.reportProgress(`Processing frame ${processedCount}...`, progress, 100);
        const yuvFrames = await this.libav.ff_decode_multi(c, pkt, frame, [packet], { copyoutFrame: 'default' });
        if (yuvFrames.length === 0) {
          continue;
        }
        const yuvFrame = yuvFrames[0];
        const layout = yuvFrame.layout;
        const width = yuvFrame.width;
        const height = yuvFrame.height;
        const yStride = layout[0].stride;
        const yOffset = layout[0].offset;
        const yLength = yStride * height;
        const yPlane = yuvFrame.data.subarray(yOffset, yOffset + yLength);
        const uStride = layout[1].stride;
        const uOffset = layout[1].offset;
        const uLength = uStride * (height / 2);
        const uPlane = yuvFrame.data.subarray(uOffset, uOffset + uLength);
        const vStride = layout[2].stride;
        const vOffset = layout[2].offset;
        const vLength = vStride * (height / 2);
        const vPlane = yuvFrame.data.subarray(vOffset, vOffset + vLength);
        const rgbaData = yuv420pToRGBA(yPlane, uPlane, vPlane, videoInfo.width, videoInfo.height, yStride, uStride, vStride);
        const analysis = this.sceneDetector.analyzeFrame(rgbaData, videoInfo.width, videoInfo.height);
        this.log(`Frame at ${packet.dts}: deltaE=${analysis.deltaE.toFixed(2)}, isNewScene=${analysis.isNewScene}`);
        if (analysis.isNewScene) {
          const encodeFrame = { ...yuvFrame, format: 12 }; // YUVJ420P for MJPEG
          const jpegPackets = await this.libav.ff_encode_multi(encC, encFrame, encPkt, [encodeFrame]);
          const jpegBuffer = Buffer.from(jpegPackets[0].data);

          const timestampSeconds = (packet.dts * timeBase[0]) / timeBase[1];
          const sceneData: SceneData = {
            timestamp: timestampSeconds,
            colors: analysis.colors,
            deltaE: analysis.deltaE,
            jpegBuffer,
          };
          scenes.push(sceneData);
          if (this.callbacks.onSceneDetected) {
            this.callbacks.onSceneDetected(sceneData);
          }
        }
      }
      this.reportProgress('Cleaning up...', 95, 100);
      await this.libav.ff_free_decoder(c, pkt, frame);
      await this.libav.ff_free_encoder(encC, encFrame, encPkt);
      await this.demuxerLibav.avformat_close_input_js(fmt_ctx);
      await this.demuxerLibav.unlink(filename);
      this.reportProgress('Complete!', 100, 100);
      return scenes;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
      throw err;
    }
  }

  private async probeVideoWithLibAV(videoFile: ArrayBuffer, filename: string, cleanup: boolean = false): Promise<VideoInfo> {
    try {
      await this.libav.writeFile(filename, new Uint8Array(videoFile));
      let fmt_ctx, streams;
      try {
        [fmt_ctx, streams] = await this.libav.ff_init_demuxer_file(filename);
      } catch (demuxError) {
        throw new Error(`Failed to open demuxer: ${demuxError}`);
      }
      const videoStream = streams.find((s: LibAVStream) => s.codec_type === 0) as LibAVStream;
      if (!videoStream) {
        throw new Error('No video stream found in file');
      }
      const codecName = getCodecName(videoStream.codec_id);
      if (!codecName) {
        throw new Error(`Unknown codec ID: ${videoStream.codec_id}`);
      }
      if (!isCodecSupported(codecName)) {
        throw new Error(`Codec ${codecName} is not supported`);
      }
      const timeBase = videoStream.time_base || [1, 30];
      const duration = videoStream.duration && timeBase ? videoStream.duration * timeBase[0] / timeBase[1] : 0;
      const fps = timeBase ? timeBase[1] / timeBase[0] : 30;
      const width = await this.libav.AVCodecParameters_width(videoStream.codecpar);
      const height = await this.libav.AVCodecParameters_height(videoStream.codecpar);
      const format = await this.libav.AVCodecParameters_format(videoStream.codecpar);
      const videoInfo: VideoInfo = {
        codec: codecName,
        codecId: videoStream.codec_id,
        width: width || 0,
        height: height || 0,
        pixelFormat: format || 0,
        duration,
        fps,
      };
      await this.libav.avformat_close_input_js(fmt_ctx);
      if (cleanup) {
        await this.libav.unlink(filename);
      }
      return videoInfo;
    } catch (error) {
      throw error;
    }
  }

  private async loadLibAV(codecName: CodecName): Promise<void> {
    const LibAVModule = await loadLibAVVariant(codecName);
    const options: any = { noworker: true };
    if (codecName === 'h264') {
      options.variant = 'h264parseaacdecode';
    }
    this.libav = await LibAVModule.LibAV(options);
  }

  private reportProgress(stage: string, current: number, total: number): void {
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress({ stage, current, total, percentage: Math.floor((current / total) * 100) });
    }
  }
}
