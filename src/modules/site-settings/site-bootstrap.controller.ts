import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import { PublicBootstrapResponseDto } from './dto/public-bootstrap-response.dto';
import { ResolveSiteBootstrapQueryDto } from './dto/resolve-site-bootstrap-query.dto';
import { SiteSettingsService } from './site-settings.service';

@ApiTags('public-bootstrap')
@Public()
@Controller('public/bootstrap')
export class SiteBootstrapController {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  @Get()
  @ApiOkResponse({ type: PublicBootstrapResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async getBootstrap(@Query() query: ResolveSiteBootstrapQueryDto) {
    return this.siteSettingsService.getPublicBootstrap(query.siteCode);
  }
}
