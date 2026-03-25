import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PlansService } from './plans.service';
import { ListPlansQueryDto } from './dto/manage-payments.dto';
import {
  PlanResponseDto,
  PlansListResponseDto,
} from './dto/payment-response.dto';

@ApiTags('public-plans')
@Controller('public/plans')
export class PublicPlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: PlansListResponseDto })
  async listPlans(@Query() query: ListPlansQueryDto) {
    return this.plansService.listPublicPlans(query);
  }

  @Public()
  @Get(':planId')
  @ApiOkResponse({ type: PlanResponseDto })
  async getPlan(@Param('planId') planId: string) {
    return this.plansService.getPublicPlan(planId);
  }
}
