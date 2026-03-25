import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

export class HealthDependencyDto {
  @ApiProperty({ example: 'up' })
  status!: string;

  @ApiPropertyOptional({ example: 'connect ECONNREFUSED 127.0.0.1:5432' })
  error?: string;
}

export class HealthLivenessResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'toppers-choice-backend' })
  service!: string;

  @ApiProperty({ example: 'development' })
  environment!: string;

  @ApiProperty({ example: '2026-03-25T18:30:00.000Z' })
  timestamp!: string;
}

export class HealthReadinessResponseDto {
  @ApiProperty({ example: true })
  ready!: boolean;

  @ApiProperty({ example: 'ready' })
  status!: string;

  @ApiProperty({ example: '2026-03-25T18:30:00.000Z' })
  timestamp!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(HealthDependencyDto) },
  })
  dependencies!: Record<string, HealthDependencyDto>;
}
