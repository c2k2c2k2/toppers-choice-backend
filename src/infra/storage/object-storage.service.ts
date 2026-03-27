import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { Client } from 'minio';

type CreateUploadUrlInput = {
  objectKey: string;
  contentType: string;
  contentLength?: number;
  expiresInSeconds: number;
};

type HeadObjectResult = {
  contentLength: number | null;
  contentType: string | null;
  eTag: string | null;
  lastModified: Date | null;
};

type ReadObjectResult = HeadObjectResult & {
  body: Readable;
};

type ReadObjectRangeInput = {
  objectKey: string;
  offset: number;
  length?: number;
};

@Injectable()
export class ObjectStorageService {
  private readonly endpoint: string | null;
  private readonly region: string;
  private readonly bucket: string | null;
  private readonly accessKeyId: string | null;
  private readonly secretAccessKey: string | null;
  private readonly forcePathStyle: boolean;
  private readonly client: Client | null;

  constructor(private readonly configService: ConfigService) {
    this.endpoint =
      this.configService.get<string>('OBJECT_STORAGE_ENDPOINT') ?? null;
    this.region =
      this.configService.get<string>('OBJECT_STORAGE_REGION') ?? 'us-east-1';
    this.bucket =
      this.configService.get<string>('OBJECT_STORAGE_BUCKET') ?? null;
    this.accessKeyId =
      this.configService.get<string>('OBJECT_STORAGE_ACCESS_KEY_ID') ?? null;
    this.secretAccessKey =
      this.configService.get<string>('OBJECT_STORAGE_SECRET_ACCESS_KEY') ??
      null;
    this.forcePathStyle =
      this.configService.get<boolean>('OBJECT_STORAGE_FORCE_PATH_STYLE') ??
      true;

    if (
      this.endpoint &&
      this.bucket &&
      this.accessKeyId &&
      this.secretAccessKey
    ) {
      const endpointUrl = new URL(this.endpoint);
      this.client = new Client({
        endPoint: endpointUrl.hostname,
        port:
          endpointUrl.port.length > 0
            ? Number(endpointUrl.port)
            : endpointUrl.protocol === 'https:'
              ? 443
              : 80,
        useSSL: endpointUrl.protocol === 'https:',
        accessKey: this.accessKeyId,
        secretKey: this.secretAccessKey,
        region: this.region,
        pathStyle: this.forcePathStyle,
      });
    } else {
      this.client = null;
    }
  }

  isConfigured() {
    return this.client !== null && this.bucket !== null;
  }

  async assertBucketReachable() {
    const client = this.getClient();
    const exists = await client.bucketExists(this.getBucket());

    if (!exists) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_BUCKET_NOT_FOUND',
        message: 'Configured private object storage bucket was not found.',
      });
    }
  }

  async createSignedUploadUrl(input: CreateUploadUrlInput) {
    const client = this.getClient();
    void input.contentType;
    void input.contentLength;

    return client.presignedPutObject(
      this.getBucket(),
      input.objectKey,
      input.expiresInSeconds,
    );
  }

  async headObject(objectKey: string): Promise<HeadObjectResult> {
    const client = this.getClient();
    const response = await client.statObject(this.getBucket(), objectKey);

    return {
      contentLength: response.size ?? null,
      contentType:
        this.readMetadataValue(response.metaData, 'content-type') ?? null,
      eTag: response.etag ?? null,
      lastModified: response.lastModified ?? null,
    };
  }

  async readObject(objectKey: string): Promise<ReadObjectResult> {
    const client = this.getClient();
    const body = await client.getObject(this.getBucket(), objectKey);
    const metadata = await this.headObject(objectKey);

    return {
      body,
      contentLength: metadata.contentLength,
      contentType: metadata.contentType,
      eTag: metadata.eTag,
      lastModified: metadata.lastModified,
    };
  }

  async readObjectRange(
    input: ReadObjectRangeInput,
  ): Promise<ReadObjectResult> {
    const client = this.getClient();
    const body = await client.getPartialObject(
      this.getBucket(),
      input.objectKey,
      input.offset,
      input.length,
    );
    const metadata = await this.headObject(input.objectKey);

    return {
      body,
      contentLength: metadata.contentLength,
      contentType: metadata.contentType,
      eTag: metadata.eTag,
      lastModified: metadata.lastModified,
    };
  }

  private getClient() {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message:
          'Private object storage is not configured for file asset operations.',
      });
    }

    return this.client;
  }

  private getBucket() {
    if (!this.bucket) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message:
          'Private object storage is not configured for file asset operations.',
      });
    }

    return this.bucket;
  }

  private readMetadataValue(
    metadata: Record<string, unknown> | undefined,
    key: string,
  ) {
    const value = metadata?.[key];
    return typeof value === 'string' ? value : null;
  }
}
