import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ResolvePublicCatalogQueryDto } from './dto/manage-taxonomy.dto';
import { PublicCatalogResponseDto } from './dto/taxonomy-response.dto';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('catalog')
@Controller()
export class PublicCatalogController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Public()
  @Get('public/catalog')
  @ApiOkResponse({ type: PublicCatalogResponseDto })
  async getPublicCatalog(@Query() query: ResolvePublicCatalogQueryDto) {
    return this.taxonomyService.getPublicCatalog(query.siteCode);
  }

  @Get('catalog')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: PublicCatalogResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async getAuthenticatedCatalog(@CurrentUser() user: AuthenticatedUser) {
    return this.taxonomyService.getAuthenticatedCatalog(user.siteId);
  }
}
