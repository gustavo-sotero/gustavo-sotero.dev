import type { UploadStatus } from '../constants/enums';

// Upload entity
export interface Upload {
  id: string;
  originalUrl: string;
  optimizedUrl: string | null;
  variants: {
    thumbnail?: string;
    medium?: string;
  } | null;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  status: UploadStatus;
  createdAt: string;
}

// Request to generate a presigned URL
export interface PresignRequest {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  size: number;
  filename: string;
}

// Response from presign endpoint
export interface PresignResponse {
  presignedUrl: string;
  key: string;
  uploadId: string;
}
