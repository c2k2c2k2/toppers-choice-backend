import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateContentEntryDto,
  FeatureContentEntryDto,
  ListAdminContentQueryDto,
  PublishContentEntryDto,
  ReorderContentEntriesDto,
  UpdateContentEntryDto,
} from './dto/manage-content.dto';
import {
  ContentDetailResponseDto,
  ContentListResponseDto,
} from './dto/content-response.dto';
import { ContentService } from './content.service';

@ApiTags('admin-content')
@ApiBearerAuth('access-token')
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @Policy('content.structured.read')
  @ApiOkResponse({ type: ContentListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listContent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminContentQueryDto,
  ) {
    return this.contentService.listAdminContent(user.siteId, query);
  }

  @Get(':contentEntryId')
  @Policy('content.structured.read')
  @ApiOkResponse({ type: ContentDetailResponseDto })
  async getContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentEntryId') contentEntryId: string,
  ) {
    return this.contentService.getAdminContent(user.siteId, contentEntryId);
  }

  @Post()
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.content.entries.create',
    resourceType: 'content_entry',
    resourceIdResponseField: 'id',
    includeBodyKeys: [
      'family',
      'format',
      'title',
      'slug',
      'visibility',
      'accessType',
    ],
  })
  @ApiCreatedResponse({ type: ContentDetailResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createContent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateContentEntryDto,
  ) {
    return this.contentService.createContent(user, body);
  }

  @Patch(':contentEntryId')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.content.entries.update',
    resourceType: 'content_entry',
    resourceIdParam: 'contentEntryId',
    includeBodyKeys: [
      'family',
      'format',
      'title',
      'slug',
      'visibility',
      'accessType',
    ],
  })
  @ApiOkResponse({ type: ContentDetailResponseDto })
  async updateContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentEntryId') contentEntryId: string,
    @Body() body: UpdateContentEntryDto,
  ) {
    return this.contentService.updateContent(user, contentEntryId, body);
  }

  @Post(':contentEntryId/publish')
  @Policy('content.structured.publish')
  @Audit({
    action: 'admin.content.entries.publish',
    resourceType: 'content_entry',
    resourceIdParam: 'contentEntryId',
    includeBodyKeys: ['publishAt'],
  })
  @ApiOkResponse({ type: ContentDetailResponseDto })
  async publishContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentEntryId') contentEntryId: string,
    @Body() body: PublishContentEntryDto,
  ) {
    return this.contentService.publishContent(user, contentEntryId, body);
  }

  @Post(':contentEntryId/unpublish')
  @Policy('content.structured.publish')
  @Audit({
    action: 'admin.content.entries.unpublish',
    resourceType: 'content_entry',
    resourceIdParam: 'contentEntryId',
  })
  @ApiOkResponse({ type: ContentDetailResponseDto })
  async unpublishContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentEntryId') contentEntryId: string,
  ) {
    return this.contentService.unpublishContent(user, contentEntryId);
  }

  @Post(':contentEntryId/feature')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.content.entries.feature',
    resourceType: 'content_entry',
    resourceIdParam: 'contentEntryId',
    includeBodyKeys: ['featuredOrderIndex'],
  })
  @ApiOkResponse({ type: ContentDetailResponseDto })
  async featureContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentEntryId') contentEntryId: string,
    @Body() body: FeatureContentEntryDto,
  ) {
    return this.contentService.featureContent(user, contentEntryId, body);
  }

  @Post(':contentEntryId/unfeature')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.content.entries.unfeature',
    resourceType: 'content_entry',
    resourceIdParam: 'contentEntryId',
  })
  @ApiOkResponse({ type: ContentDetailResponseDto })
  async unfeatureContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentEntryId') contentEntryId: string,
  ) {
    return this.contentService.unfeatureContent(user, contentEntryId);
  }

  @Put('reorder')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.content.entries.reorder',
    resourceType: 'content_entry',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderContent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderContentEntriesDto,
  ) {
    await this.contentService.reorderContent(user.siteId, body);

    return {
      message: 'Structured content reordered successfully.',
    };
  }
}
