import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  FileAssetListResponseDto,
  FileAssetResponseDto,
  InitFileUploadResponseDto,
} from './dto/file-asset-response.dto';
import {
  InitFileUploadDto,
  ListFileAssetsQueryDto,
} from './dto/manage-file-assets.dto';
import { FilesService } from './files.service';

@ApiTags('admin-files')
@ApiBearerAuth('access-token')
@Controller('admin/files')
export class AdminFilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @Policy('content.files.read')
  @ApiOkResponse({ type: FileAssetListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listAssets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFileAssetsQueryDto,
  ) {
    return this.filesService.listAssets(user.siteId, query);
  }

  @Get(':assetId')
  @Policy('content.files.read')
  @ApiOkResponse({ type: FileAssetResponseDto })
  async getAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assetId') assetId: string,
  ) {
    return this.filesService.getAssetMetadata(user.siteId, assetId);
  }

  @Post('init-upload')
  @Policy('content.files.manage')
  @Audit({
    action: 'admin.files.init_upload',
    resourceType: 'file_asset',
    resourceIdResponseField: 'fileAsset.id',
    includeBodyKeys: ['purpose', 'fileName', 'contentType', 'sizeBytes'],
  })
  @ApiCreatedResponse({ type: InitFileUploadResponseDto })
  async initUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InitFileUploadDto,
  ) {
    return this.filesService.initUpload(user, body);
  }

  @Post(':assetId/confirm-upload')
  @Policy('content.files.manage')
  @Audit({
    action: 'admin.files.confirm_upload',
    resourceType: 'file_asset',
    resourceIdParam: 'assetId',
  })
  @ApiOkResponse({ type: FileAssetResponseDto })
  async confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assetId') assetId: string,
  ) {
    return this.filesService.confirmUpload(user.siteId, user.userId, assetId);
  }
}
