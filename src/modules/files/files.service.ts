import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FileAsset,
  FileAssetAccess,
  FileAssetStatus,
  UserType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ObjectStorageService } from '../../infra/storage/object-storage.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  FILE_EXTENSION_BY_CONTENT_TYPE,
  FILE_PURPOSE_RULES,
  FILE_UPLOAD_URL_TTL_SECONDS,
  isInlineAssetContentType,
} from './files.constants';
import { InitFileUploadDto, ListFileAssetsQueryDto } from './dto/manage-file-assets.dto';
import { fileAssetSelect, mapFileAsset } from './files.types';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async listAssets(siteId: string, query: ListFileAssetsQueryDto) {
    const where = {
      siteId,
      purpose: query.purpose,
      status: query.status,
      accessLevel: query.accessLevel,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.fileAsset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        select: fileAssetSelect,
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      items: items.map((item) => mapFileAsset(item)),
      total,
    };
  }

  async getAssetMetadata(siteId: string, assetId: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        siteId,
      },
      select: fileAssetSelect,
    });

    if (!asset) {
      throw new NotFoundException({
        code: 'FILE_ASSET_NOT_FOUND',
        message: 'File asset was not found.',
      });
    }

    return mapFileAsset(asset);
  }

  async initUpload(user: AuthenticatedUser, input: InitFileUploadDto) {
    const site = await this.prisma.site.findUnique({
      where: { id: user.siteId },
      select: {
        id: true,
        code: true,
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: 'SITE_NOT_FOUND',
        message: 'Active site context was not found.',
      });
    }

    this.validateUploadInput(input);
    await this.objectStorageService.assertBucketReachable();

    const extension = this.resolveExtension(input.fileName, input.contentType);
    const objectKey = this.buildObjectKey(site.code, input.purpose, extension);
    const uploadExpiresAt = new Date(
      Date.now() + FILE_UPLOAD_URL_TTL_SECONDS * 1000,
    );
    const createdAsset = await this.prisma.fileAsset.create({
      data: {
        siteId: site.id,
        createdByUserId: user.userId,
        purpose: input.purpose,
        accessLevel:
          input.accessLevel ?? FILE_PURPOSE_RULES[input.purpose].defaultAccessLevel,
        status: FileAssetStatus.PENDING_UPLOAD,
        objectKey,
        originalFileName: input.fileName.trim(),
        extension,
        contentType: input.contentType,
        declaredSizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256 ?? null,
        uploadExpiresAt,
      },
      select: fileAssetSelect,
    });
    const uploadUrl = await this.objectStorageService.createSignedUploadUrl({
      objectKey,
      contentType: input.contentType,
      contentLength: input.sizeBytes,
      expiresInSeconds: FILE_UPLOAD_URL_TTL_SECONDS,
    });

    return {
      fileAsset: mapFileAsset(createdAsset),
      uploadUrl,
      uploadMethod: 'PUT' as const,
      requiredHeaders: {
        'Content-Type': input.contentType,
      },
    };
  }

  async confirmUpload(siteId: string, actorUserId: string, assetId: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        siteId,
      },
      select: fileAssetSelect,
    });

    if (!asset) {
      throw new NotFoundException({
        code: 'FILE_ASSET_NOT_FOUND',
        message: 'File asset was not found.',
      });
    }

    if (asset.status === FileAssetStatus.REVOKED) {
      throw new BadRequestException({
        code: 'FILE_ASSET_REVOKED',
        message: 'Revoked assets cannot be confirmed.',
      });
    }

    const metadata = await this.objectStorageService.headObject(asset.objectKey);

    if (!metadata.contentLength || metadata.contentLength <= 0) {
      throw new BadRequestException({
        code: 'FILE_UPLOAD_MISSING',
        message: 'The uploaded object could not be verified in object storage.',
      });
    }

    if (
      asset.declaredSizeBytes !== null &&
      metadata.contentLength !== asset.declaredSizeBytes
    ) {
      throw new BadRequestException({
        code: 'FILE_SIZE_MISMATCH',
        message: 'Uploaded object size does not match the initialized upload.',
      });
    }

    if (
      metadata.contentType &&
      metadata.contentType.toLowerCase() !== asset.contentType.toLowerCase()
    ) {
      throw new BadRequestException({
        code: 'FILE_CONTENT_TYPE_MISMATCH',
        message:
          'Uploaded object content type does not match the initialized upload.',
      });
    }

    const updated = await this.prisma.fileAsset.update({
      where: { id: asset.id },
      data: {
        status: FileAssetStatus.READY,
        sizeBytes: metadata.contentLength,
        etag: metadata.eTag,
        confirmedAt: new Date(),
        confirmedByUserId: actorUserId,
      },
      select: fileAssetSelect,
    });

    return mapFileAsset(updated);
  }

  async streamPublicAsset(assetId: string, response: Response) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        status: FileAssetStatus.READY,
        accessLevel: FileAssetAccess.PUBLIC,
      },
    });

    if (!asset) {
      throw new NotFoundException({
        code: 'FILE_ASSET_NOT_FOUND',
        message: 'Public file asset was not found.',
      });
    }

    return this.writeStreamResponse(asset, response, 'public, max-age=300');
  }

  async streamProtectedAsset(
    assetId: string,
    user: AuthenticatedUser,
    response: Response,
  ) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        siteId: user.siteId,
        status: FileAssetStatus.READY,
      },
    });

    if (!asset) {
      throw new NotFoundException({
        code: 'FILE_ASSET_NOT_FOUND',
        message: 'File asset was not found.',
      });
    }

    await this.assertCanReadAsset(asset, user);

    return this.writeStreamResponse(asset, response, 'private, no-store');
  }

  private async writeStreamResponse(
    asset: FileAsset,
    response: Response,
    cacheControl: string,
  ) {
    const object = await this.objectStorageService.readObject(asset.objectKey);

    response.setHeader('Content-Type', object.contentType ?? asset.contentType);
    response.setHeader('Cache-Control', cacheControl);
    response.setHeader(
      'Content-Disposition',
      `${isInlineAssetContentType(asset.contentType) ? 'inline' : 'attachment'}; filename="${this.escapeContentDispositionFilename(asset.originalFileName)}"`,
    );

    if (object.contentLength !== null) {
      response.setHeader('Content-Length', String(object.contentLength));
    }

    if (object.eTag) {
      response.setHeader('ETag', object.eTag);
    }

    if (object.lastModified) {
      response.setHeader('Last-Modified', object.lastModified.toUTCString());
    }

    return new StreamableFile(object.body);
  }

  private async assertCanReadAsset(asset: FileAsset, user: AuthenticatedUser) {
    if (asset.accessLevel === FileAssetAccess.PUBLIC) {
      return;
    }

    if (asset.createdByUserId === user.userId) {
      return;
    }

    if (asset.accessLevel === FileAssetAccess.AUTHENTICATED) {
      return;
    }

    if (user.userType === UserType.ADMIN) {
      const evaluation = await this.authorizationService.evaluatePolicy(
        user.siteId,
        user.userId,
        {
          permissions: ['content.files.read', 'content.files.manage'],
          match: 'any',
        },
      );

      if (evaluation.allowed) {
        return;
      }
    }

    throw new ForbiddenException({
      code: 'FILE_ASSET_ACCESS_DENIED',
      message: 'You do not have access to this file asset.',
    });
  }

  private validateUploadInput(input: InitFileUploadDto) {
    const purposeRule = FILE_PURPOSE_RULES[input.purpose];

    if (!purposeRule) {
      throw new BadRequestException({
        code: 'FILE_PURPOSE_UNSUPPORTED',
        message: 'The requested file asset purpose is not supported.',
      });
    }

    if (!purposeRule.allowedContentTypes.includes(input.contentType)) {
      throw new BadRequestException({
        code: 'FILE_CONTENT_TYPE_UNSUPPORTED',
        message: 'The requested content type is not allowed for this purpose.',
        details: {
          purpose: input.purpose,
          allowedContentTypes: purposeRule.allowedContentTypes,
        },
      });
    }

    if (input.sizeBytes > purposeRule.maxSizeBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'The requested file exceeds the maximum allowed size.',
        details: {
          purpose: input.purpose,
          maxSizeBytes: purposeRule.maxSizeBytes,
        },
      });
    }
  }

  private resolveExtension(fileName: string, contentType: string) {
    const normalizedName = fileName.trim();
    const nameParts = normalizedName.split('.');
    const fileExtension =
      nameParts.length > 1 ? nameParts.at(-1)?.toLowerCase() ?? null : null;
    const expectedExtension = FILE_EXTENSION_BY_CONTENT_TYPE[contentType];

    if (!expectedExtension) {
      throw new BadRequestException({
        code: 'FILE_EXTENSION_UNSUPPORTED',
        message: 'The requested content type is not supported.',
      });
    }

    if (fileExtension && fileExtension.length > 0) {
      return fileExtension;
    }

    return expectedExtension;
  }

  private buildObjectKey(
    siteCode: string,
    purpose: FileAsset['purpose'],
    extension: string,
  ) {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const objectId = randomUUID();

    return [
      'sites',
      siteCode,
      purpose.toLowerCase(),
      year,
      month,
      `${objectId}.${extension}`,
    ].join('/');
  }

  private escapeContentDispositionFilename(value: string) {
    return value.replaceAll('"', '\\"');
  }
}
