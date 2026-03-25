import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { PaymentsService } from './payments.service';
import { ListAdminPaymentOrdersQueryDto } from './dto/manage-payments.dto';
import {
  PaymentOrderResponseDto,
  PaymentOrdersListResponseDto,
} from './dto/payment-response.dto';

@ApiTags('admin-payments')
@ApiBearerAuth('access-token')
@Controller('admin/payments/orders')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Policy('payments.read')
  @ApiOkResponse({ type: PaymentOrdersListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminPaymentOrdersQueryDto,
  ) {
    return this.paymentsService.listAdminOrders(user.siteId, query);
  }

  @Get(':orderId')
  @Policy('payments.read')
  @ApiOkResponse({ type: PaymentOrderResponseDto })
  async getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.getAdminOrder(user.siteId, orderId);
  }

  @Post(':orderId/reconcile')
  @Policy('payments.manage')
  @Audit({
    action: 'admin.payments.orders.reconcile',
    resourceType: 'payment_order',
    resourceIdParam: 'orderId',
  })
  @ApiOkResponse({ type: PaymentOrderResponseDto })
  async reconcileOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.reconcileAdminOrder(user.siteId, orderId);
  }
}
