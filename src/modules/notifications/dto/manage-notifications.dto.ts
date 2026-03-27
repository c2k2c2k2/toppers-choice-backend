import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  NotificationAudienceType,
  NotificationBroadcastStatus,
  NotificationChannel,
  NotificationMessageStatus,
  NotificationTemplateStatus,
} from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

export class ListMyNotificationsQueryDto {
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

export class NotificationPreferenceInputDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty()
  @IsBoolean()
  isEnabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: [NotificationPreferenceInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: NotificationPreferenceInputDto) => item.channel)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceInputDto)
  items!: NotificationPreferenceInputDto[];
}

class NotificationTemplateBaseDto {
  @ApiProperty({ example: 'student.welcome' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(120)
  key!: string;

  @ApiProperty({ example: 'Student Welcome' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ example: "Welcome to Topper's Choice" })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subjectTemplate?: string;

  @ApiProperty({ example: 'Welcome {{fullName}}' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(200)
  titleTemplate!: string;

  @ApiProperty({ example: 'Your learning dashboard is now ready.' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(2000)
  bodyTemplate!: string;

  @ApiPropertyOptional({ type: Object, example: { category: 'lifecycle' } })
  @IsOptional()
  @IsObject()
  metaJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: NotificationTemplateStatus,
    default: NotificationTemplateStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(NotificationTemplateStatus)
  status?: NotificationTemplateStatus;
}

export class CreateNotificationTemplateDto extends NotificationTemplateBaseDto {}

export class UpdateNotificationTemplateDto extends PartialType(
  CreateNotificationTemplateDto,
) {}

export class ListAdminNotificationTemplatesQueryDto {
  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationTemplateStatus })
  @IsOptional()
  @IsEnum(NotificationTemplateStatus)
  status?: NotificationTemplateStatus;

  @ApiPropertyOptional({ example: 'welcome' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class CreateNotificationBroadcastDto {
  @ApiPropertyOptional({ example: 'cmag4template001' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ enum: NotificationAudienceType })
  @IsEnum(NotificationAudienceType)
  audienceType!: NotificationAudienceType;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiProperty({ example: 'Mock test window closes tonight' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Complete your attempt before 11:59 PM.' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({
    type: Object,
    example: { userIds: ['cmag4user001', 'cmag4user002'] },
  })
  @IsOptional()
  @IsObject()
  filtersJson?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, example: { testId: 'cmag4test001' } })
  @IsOptional()
  @IsObject()
  payloadJson?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-03-27T07:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateNotificationBroadcastDto extends PartialType(
  CreateNotificationBroadcastDto,
) {}

export class ListAdminNotificationBroadcastsQueryDto {
  @ApiPropertyOptional({ enum: NotificationBroadcastStatus })
  @IsOptional()
  @IsEnum(NotificationBroadcastStatus)
  status?: NotificationBroadcastStatus;

  @ApiPropertyOptional({ enum: NotificationAudienceType })
  @IsOptional()
  @IsEnum(NotificationAudienceType)
  audienceType?: NotificationAudienceType;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}

export class ListAdminNotificationMessagesQueryDto {
  @ApiPropertyOptional({ enum: NotificationMessageStatus })
  @IsOptional()
  @IsEnum(NotificationMessageStatus)
  status?: NotificationMessageStatus;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  broadcastId?: string;
}
