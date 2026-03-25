import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PlansService } from './plans.service';
import {
  CreatePlanDto,
  ListPlansQueryDto,
  UpdatePlanDto,
} from './dto/manage-payments.dto';
import {
  PlanResponseDto,
  PlansListResponseDto,
} from './dto/payment-response.dto';

@ApiTags('admin-plans')
@ApiBearerAuth('access-token')
@Controller('admin/plans')
export class AdminPlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Policy('payments.read')
  @ApiOkResponse({ type: PlansListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listPlans(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPlansQueryDto,
  ) {
    return this.plansService.listAdminPlans(user.siteId, query);
  }

  @Get(':planId')
  @Policy('payments.read')
  @ApiOkResponse({ type: PlanResponseDto })
  async getPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') planId: string,
  ) {
    return this.plansService.getAdminPlan(user.siteId, planId);
  }

  @Post()
  @Policy('payments.manage')
  @Audit({
    action: 'admin.plans.create',
    resourceType: 'plan',
    resourceIdResponseField: 'id',
    includeBodyKeys: [
      'code',
      'slug',
      'name',
      'pricePaise',
      'currencyCode',
      'durationDays',
      'status',
    ],
  })
  @ApiCreatedResponse({ type: PlanResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePlanDto,
  ) {
    return this.plansService.createPlan(user, body);
  }

  @Patch(':planId')
  @Policy('payments.manage')
  @Audit({
    action: 'admin.plans.update',
    resourceType: 'plan',
    resourceIdParam: 'planId',
    includeBodyKeys: [
      'code',
      'slug',
      'name',
      'pricePaise',
      'currencyCode',
      'durationDays',
      'status',
    ],
  })
  @ApiOkResponse({ type: PlanResponseDto })
  async updatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') planId: string,
    @Body() body: UpdatePlanDto,
  ) {
    return this.plansService.updatePlan(user, planId, body);
  }
}
