export interface StorageResult {
  cid: string;
  size: number;
  provider: "local" | "filecoin";
}

export interface StorageProvider {
  upload(data: Buffer, metadata?: Record<string, string>): Promise<StorageResult>;
  download(cid: string): Promise<Buffer>;
  getUrl(cid: string): string;
}
