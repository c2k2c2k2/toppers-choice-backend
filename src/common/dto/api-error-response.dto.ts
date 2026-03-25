import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

export class ApiErrorDetailDto {
  @ApiPropertyOptional({
    example: 'siteCode',
    description: 'Field or path associated with the error.',
  })
  path?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['siteCode must match /^[a-z0-9-]+$/'],
  })
  messages?: string[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code!: string;

  @ApiProperty({ example: 'Request validation failed' })
  message!: string;

  @ApiPropertyOptional({
    description: 'Structured error details when available.',
    oneOf: [
      {
        type: 'array',
        items: { $ref: getSchemaPath(ApiErrorDetailDto) },
      },
      {
        type: 'object',
        additionalProperties: true,
      },
    ],
  })
  details?: unknown;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'e8ef6cd9-9cb6-4704-af08-b3fd849771a3',
  })
  requestId!: string | null;

  @ApiProperty({ example: '2026-03-25T18:30:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/health/readiness' })
  path!: string;
}
