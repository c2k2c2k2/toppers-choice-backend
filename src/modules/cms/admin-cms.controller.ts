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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CmsService } from './cms.service';
import {
  CmsAnnouncementsListResponseDto,
  CmsAnnouncementResponseDto,
  CmsBannersListResponseDto,
  CmsBannerResponseDto,
  CmsPageResponseDto,
  CmsPagesListResponseDto,
  CmsSectionsListResponseDto,
  CmsSectionResponseDto,
} from './dto/cms-response.dto';
import {
  CreateCmsAnnouncementDto,
  CreateCmsBannerDto,
  CreateCmsPageDto,
  CreateCmsSectionDto,
  ListCmsRecordsQueryDto,
  PublishCmsRecordDto,
  ReorderCmsRecordsDto,
  UpdateCmsAnnouncementDto,
  UpdateCmsBannerDto,
  UpdateCmsPageDto,
  UpdateCmsSectionDto,
} from './dto/manage-cms.dto';

@ApiTags('admin-cms')
@ApiBearerAuth('access-token')
@Controller('admin/cms')
export class AdminCmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('pages')
  @Policy('content.cms.read')
  @ApiOkResponse({ type: CmsPagesListResponseDto })
  async listPages(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCmsRecordsQueryDto,
  ) {
    return this.cmsService.listAdminPages(user.siteId, query);
  }

  @Get('pages/:pageId')
  @Policy('content.cms.read')
  @ApiOkResponse({ type: CmsPageResponseDto })
  async getPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
  ) {
    return this.cmsService.getAdminPage(user.siteId, pageId);
  }

  @Post('pages')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.pages.create',
    resourceType: 'cms_page',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['slug', 'title', 'visibility'],
  })
  @ApiCreatedResponse({ type: CmsPageResponseDto })
  async createPage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCmsPageDto,
  ) {
    return this.cmsService.createPage(user, body);
  }

  @Patch('pages/:pageId')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.pages.update',
    resourceType: 'cms_page',
    resourceIdParam: 'pageId',
    includeBodyKeys: ['slug', 'title', 'visibility'],
  })
  @ApiOkResponse({ type: CmsPageResponseDto })
  async updatePage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() body: UpdateCmsPageDto,
  ) {
    return this.cmsService.updatePage(user, pageId, body);
  }

  @Post('pages/:pageId/publish')
  @Policy('content.cms.publish')
  @Audit({
    action: 'admin.cms.pages.publish',
    resourceType: 'cms_page',
    resourceIdParam: 'pageId',
    includeBodyKeys: ['publishAt'],
  })
  @ApiOkResponse({ type: CmsPageResponseDto })
  async publishPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() body: PublishCmsRecordDto,
  ) {
    return this.cmsService.publishPage(user, pageId, body);
  }

  @Post('pages/:pageId/unpublish')
  @Policy('content.cms.publish')
  @Audit({
    action: 'admin.cms.pages.unpublish',
    resourceType: 'cms_page',
    resourceIdParam: 'pageId',
  })
  @ApiOkResponse({ type: CmsPageResponseDto })
  async unpublishPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
  ) {
    return this.cmsService.unpublishPage(user, pageId);
  }

  @Put('pages/reorder')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.pages.reorder',
    resourceType: 'cms_page',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderPages(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderCmsRecordsDto,
  ) {
    await this.cmsService.reorderPages(user.siteId, body);
    return {
      message: 'CMS pages reordered successfully.',
    };
  }

  @Get('banners')
  @Policy('content.cms.read')
  @ApiOkResponse({ type: CmsBannersListResponseDto })
  async listBanners(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCmsRecordsQueryDto,
  ) {
    return this.cmsService.listAdminBanners(user.siteId, query);
  }

  @Get('banners/:bannerId')
  @Policy('content.cms.read')
  @ApiOkResponse({ type: CmsBannerResponseDto })
  async getBanner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bannerId') bannerId: string,
  ) {
    return this.cmsService.getAdminBanner(user.siteId, bannerId);
  }

  @Post('banners')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.banners.create',
    resourceType: 'cms_banner',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['placement', 'title', 'visibility'],
  })
  @ApiCreatedResponse({ type: CmsBannerResponseDto })
  async createBanner(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCmsBannerDto,
  ) {
    return this.cmsService.createBanner(user, body);
  }

  @Patch('banners/:bannerId')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.banners.update',
    resourceType: 'cms_banner',
    resourceIdParam: 'bannerId',
    includeBodyKeys: ['placement', 'title', 'visibility'],
  })
  @ApiOkResponse({ type: CmsBannerResponseDto })
  async updateBanner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bannerId') bannerId: string,
    @Body() body: UpdateCmsBannerDto,
  ) {
    return this.cmsService.updateBanner(user, bannerId, body);
  }

  @Post('banners/:bannerId/publish')
  @Policy('content.cms.publish')
  @Audit({
    action: 'admin.cms.banners.publish',
    resourceType: 'cms_banner',
    resourceIdParam: 'bannerId',
    includeBodyKeys: ['publishAt'],
  })
  @ApiOkResponse({ type: CmsBannerResponseDto })
  async publishBanner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bannerId') bannerId: string,
    @Body() body: PublishCmsRecordDto,
  ) {
    return this.cmsService.publishBanner(user, bannerId, body);
  }

  @Post('banners/:bannerId/unpublish')
  @Policy('content.cms.publish')
  @Audit({
    action: 'admin.cms.banners.unpublish',
    resourceType: 'cms_banner',
    resourceIdParam: 'bannerId',
  })
  @ApiOkResponse({ type: CmsBannerResponseDto })
  async unpublishBanner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bannerId') bannerId: string,
  ) {
    return this.cmsService.unpublishBanner(user, bannerId);
  }

  @Put('banners/reorder')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.banners.reorder',
    resourceType: 'cms_banner',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderBanners(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderCmsRecordsDto,
  ) {
    await this.cmsService.reorderBanners(user.siteId, body);
    return {
      message: 'CMS banners reordered successfully.',
    };
  }

  @Get('announcements')
  @Policy('content.cms.read')
  @ApiOkResponse({ type: CmsAnnouncementsListResponseDto })
  async listAnnouncements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCmsRecordsQueryDto,
  ) {
    return this.cmsService.listAdminAnnouncements(user.siteId, query);
  }

  @Get('announcements/:announcementId')
  @Policy('content.cms.read')
  @ApiOkResponse({ type: CmsAnnouncementResponseDto })
  async getAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('announcementId') announcementId: string,
  ) {
    return this.cmsService.getAdminAnnouncement(user.siteId, announcementId);
  }

  @Post('announcements')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.announcements.create',
    resourceType: 'cms_announcement',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['title', 'visibility', 'level'],
  })
  @ApiCreatedResponse({ type: CmsAnnouncementResponseDto })
  async createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCmsAnnouncementDto,
  ) {
    return this.cmsService.createAnnouncement(user, body);
  }

  @Patch('announcements/:announcementId')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.announcements.update',
    resourceType: 'cms_announcement',
    resourceIdParam: 'announcementId',
    includeBodyKeys: ['title', 'visibility', 'level'],
  })
  @ApiOkResponse({ type: CmsAnnouncementResponseDto })
  async updateAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('announcementId') announcementId: string,
    @Body() body: UpdateCmsAnnouncementDto,
  ) {
    return this.cmsService.updateAnnouncement(user, announcementId, body);
  }

  @Post('announcements/:announcementId/publish')
  @Policy('content.cms.publish')
  @Audit({
    action: 'admin.cms.announcements.publish',
    resourceType: 'cms_announcement',
    resourceIdParam: 'announcementId',
    includeBodyKeys: ['publishAt'],
  })
  @ApiOkResponse({ type: CmsAnnouncementResponseDto })
  async publishAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('announcementId') announcementId: string,
    @Body() body: PublishCmsRecordDto,
  ) {
    return this.cmsService.publishAnnouncement(user, announcementId, body);
  }

  @Post('announcements/:announcementId/unpublish')
  @Policy('content.cms.publish')
  @Audit({
    action: 'admin.cms.announcements.unpublish',
    resourceType: 'cms_announcement',
    resourceIdParam: 'announcementId',
  })
  @ApiOkResponse({ type: CmsAnnouncementResponseDto })
  async unpublishAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('announcementId') announcementId: string,
  ) {
    return this.cmsService.unpublishAnnouncement(user, announcementId);
  }

  @Put('announcements/reorder')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.announcements.reorder',
    resourceType: 'cms_announcement',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderAnnouncements(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderCmsRecordsDto,
  ) {
    await this.cmsService.reorderAnnouncements(user.siteId, body);
    return {
      message: 'CMS announcements reordered successfully.',
    };
  }

  @Get('sections')
  @Policy('content.cms.read')
  @ApiOkResponse({ type: CmsSectionsListResponseDto })
  async listSections(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCmsRecordsQueryDto,
  ) {
    return this.cmsService.listAdminSections(user.siteId, query);
  }

  @Get('sections/:sectionId')
  @Policy('content.cms.read')
  @ApiOkResponse({ type: CmsSectionResponseDto })
  async getSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sectionId') sectionId: string,
  ) {
    return this.cmsService.getAdminSection(user.siteId, sectionId);
  }

  @Post('sections')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.sections.create',
    resourceType: 'cms_section',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['surface', 'code', 'title', 'visibility', 'type'],
  })
  @ApiCreatedResponse({ type: CmsSectionResponseDto })
  async createSection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCmsSectionDto,
  ) {
    return this.cmsService.createSection(user, body);
  }

  @Patch('sections/:sectionId')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.sections.update',
    resourceType: 'cms_section',
    resourceIdParam: 'sectionId',
    includeBodyKeys: ['surface', 'code', 'title', 'visibility', 'type'],
  })
  @ApiOkResponse({ type: CmsSectionResponseDto })
  async updateSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sectionId') sectionId: string,
    @Body() body: UpdateCmsSectionDto,
  ) {
    return this.cmsService.updateSection(user, sectionId, body);
  }

  @Post('sections/:sectionId/publish')
  @Policy('content.cms.publish')
  @Audit({
    action: 'admin.cms.sections.publish',
    resourceType: 'cms_section',
    resourceIdParam: 'sectionId',
    includeBodyKeys: ['publishAt'],
  })
  @ApiOkResponse({ type: CmsSectionResponseDto })
  async publishSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sectionId') sectionId: string,
    @Body() body: PublishCmsRecordDto,
  ) {
    return this.cmsService.publishSection(user, sectionId, body);
  }

  @Post('sections/:sectionId/unpublish')
  @Policy('content.cms.publish')
  @Audit({
    action: 'admin.cms.sections.unpublish',
    resourceType: 'cms_section',
    resourceIdParam: 'sectionId',
  })
  @ApiOkResponse({ type: CmsSectionResponseDto })
  async unpublishSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sectionId') sectionId: string,
  ) {
    return this.cmsService.unpublishSection(user, sectionId);
  }

  @Put('sections/reorder')
  @Policy('content.cms.manage')
  @Audit({
    action: 'admin.cms.sections.reorder',
    resourceType: 'cms_section',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderSections(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderCmsRecordsDto,
  ) {
    await this.cmsService.reorderSections(user.siteId, body);
    return {
      message: 'CMS sections reordered successfully.',
    };
  }
}
