import { ApiProperty } from '@nestjs/swagger';

export class PublicBootstrapResponseDto {
  @ApiProperty({
    example: {
      code: 'toppers-choice',
      slug: 'toppers-choice',
      name: "Toppers' Choice",
      primaryDomain: null,
      defaultLocale: 'mr-IN',
      timezone: 'Asia/Kolkata',
    },
  })
  site!: Record<string, unknown>;

  @ApiProperty({
    example: {
      site: {
        branding: {
          displayName: "Toppers' Choice",
          tagline: 'Competitive exam preparation platform',
        },
      },
      platform: {
        features: {
          notes: true,
          practice: true,
          tests: true,
        },
      },
    },
  })
  publicConfig!: Record<string, unknown>;

  @ApiProperty({
    example: {
      appBaseUrl: 'http://localhost:3000',
      apiBasePath: '/api/v1',
    },
  })
  runtime!: Record<string, unknown>;

  @ApiProperty({
    example: [
      {
        key: 'site.public',
        version: 1,
        visibility: 'PUBLIC',
        publishedAt: '2026-03-25T18:30:00.000Z',
      },
    ],
  })
  versions!: Array<Record<string, unknown>>;

  @ApiProperty({ example: '2026-03-25T18:30:00.000Z' })
  resolvedAt!: string;

  @ApiProperty({ example: false })
  stale!: boolean;
}
