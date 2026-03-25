import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import {
  HealthLivenessResponseDto,
  HealthReadinessResponseDto,
} from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ type: HealthLivenessResponseDto })
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('readiness')
  @ApiOkResponse({ type: HealthReadinessResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async getReadiness() {
    const readiness = await this.healthService.getReadiness();

    if (!readiness.ready) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'Service is not ready.',
        details: readiness,
      });
    }

    return readiness;
  }
}
