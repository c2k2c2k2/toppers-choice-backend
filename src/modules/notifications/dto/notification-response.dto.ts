import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationAudienceType,
  NotificationBroadcastStatus,
  NotificationChannel,
  NotificationMessageStatus,
  NotificationTemplateStatus,
} from '@prisma/client';

export class NotificationPreferenceResponseDto {
  @ApiProperty({ enum: NotificationChannel })
  channel!: NotificationChannel;

  @ApiProperty()
  isEnabled!: boolean;
}

export class NotificationMessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationChannel })
  channel!: NotificationChannel;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  payloadJson!: Record<string, unknown> | null;

  @ApiProperty({ enum: NotificationMessageStatus })
  status!: NotificationMessageStatus;

  @ApiPropertyOptional()
  deliveredAt!: Date | null;

  @ApiPropertyOptional()
  readAt!: Date | null;

  @ApiPropertyOptional()
  broadcastId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class NotificationFeedResponseDto {
  @ApiProperty({ type: [NotificationMessageResponseDto] })
  items!: NotificationMessageResponseDto[];

  @ApiProperty()
  unreadCount!: number;
}

export class NotificationTemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: NotificationChannel })
  channel!: NotificationChannel;

  @ApiPropertyOptional()
  subjectTemplate!: string | null;

  @ApiProperty()
  titleTemplate!: string;

  @ApiProperty()
  bodyTemplate!: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metaJson!: Record<string, unknown> | null;

  @ApiProperty({ enum: NotificationTemplateStatus })
  status!: NotificationTemplateStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class NotificationTemplatesListResponseDto {
  @ApiProperty({ type: [NotificationTemplateResponseDto] })
  items!: NotificationTemplateResponseDto[];

  @ApiProperty()
  total!: number;
}

export class NotificationBroadcastResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  templateId!: string | null;

  @ApiProperty({ enum: NotificationAudienceType })
  audienceType!: NotificationAudienceType;

  @ApiProperty({ enum: NotificationChannel })
  channel!: NotificationChannel;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  filtersJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  payloadJson!: Record<string, unknown> | null;

  @ApiPropertyOptional()
  scheduledAt!: Date | null;

  @ApiPropertyOptional()
  dispatchedAt!: Date | null;

  @ApiPropertyOptional()
  cancelledAt!: Date | null;

  @ApiProperty({ enum: NotificationBroadcastStatus })
  status!: NotificationBroadcastStatus;

  @ApiProperty()
  recipientCount!: number;

  @ApiProperty()
  deliveredCount!: number;

  @ApiProperty()
  readCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class NotificationBroadcastsListResponseDto {
  @ApiProperty({ type: [NotificationBroadcastResponseDto] })
  items!: NotificationBroadcastResponseDto[];

  @ApiProperty()
  total!: number;
}

export class NotificationMessagesListResponseDto {
  @ApiProperty({ type: [NotificationMessageResponseDto] })
  items!: NotificationMessageResponseDto[];

  @ApiProperty()
  total!: number;
}
