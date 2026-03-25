import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogActorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;
}

export class AuditLogResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  resourceType!: string;

  @ApiPropertyOptional({ nullable: true })
  resourceId!: string | null;

  @ApiPropertyOptional({ type: AuditLogActorDto, nullable: true })
  actor!: AuditLogActorDto | null;

  @ApiPropertyOptional({ nullable: true })
  ipAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  userAgent!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  meta!: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-03-26T10:30:00.000Z' })
  createdAt!: string;
}

export class AuditLogsListResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items!: AuditLogResponseDto[];
}
