import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsService } from './payments.service';
import { CreateCheckoutDto } from './dto/manage-payments.dto';
import {
  CheckoutResponseDto,
  PaymentCallbackAckResponseDto,
  PaymentOrderResponseDto,
} from './dto/payment-response.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ type: CheckoutResponseDto })
  async createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCheckoutDto,
  ) {
    return this.paymentsService.createCheckout(user, body);
  }

  @Get('orders/:orderId/status')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: PaymentOrderResponseDto })
  async getOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.getOrderStatus(user, orderId);
  }

  @Public()
  @Post('providers/phonepe/callback')
  @ApiOkResponse({ type: PaymentCallbackAckResponseDto })
  async handlePhonePeCallback(@Req() request: Request) {
    return this.paymentsService.handlePhonePeCallback(
      request.body,
      request.headers,
    );
  }
}
