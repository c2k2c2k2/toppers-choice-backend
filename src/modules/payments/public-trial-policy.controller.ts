import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { TrialPolicyResponseDto } from './dto/payment-response.dto';
import { PaymentSettingsService } from './payment-settings.service';

@ApiTags('public-trial-policy')
@Controller('public/trial')
export class PublicTrialPolicyController {
  constructor(private readonly paymentSettingsService: PaymentSettingsService) {}

  @Public()
  @Get('policy')
  @ApiOkResponse({ type: TrialPolicyResponseDto })
  async getTrialPolicy() {
    return this.paymentSettingsService.getTrialPolicy();
  }
}
