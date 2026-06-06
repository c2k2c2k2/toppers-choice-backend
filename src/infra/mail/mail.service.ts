import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EnvironmentVariables } from '../config/env.validation';
import {
  buildBrandedEmailHtml,
  buildPlainTextEmail,
} from './mail.templates';

type SendMailInput = {
  to: string;
  subject: string;
  title: string;
  previewText: string;
  intro: string;
  body?: string;
  otpCode?: string;
  actionLabel?: string;
  actionUrl?: string;
  footerNote?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromEmail: string | null;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService<EnvironmentVariables>) {
    const host = this.configService.get('SMTP_HOST', { infer: true });
    const user = this.configService.get('SMTP_USER', { infer: true });
    const pass = this.configService.get('SMTP_PASS', { infer: true });
    this.fromEmail =
      this.configService.get('SMTP_FROM_EMAIL', { infer: true }) ?? null;
    this.fromName =
      this.configService.get('SMTP_FROM_NAME', { infer: true }) ??
      "Toppers' Choice";

    if (!host || !user || !pass || !this.fromEmail) {
      this.transporter = null;
      this.logger.warn(
        'SMTP is not configured. Email sends will be recorded as skipped.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get('SMTP_PORT', { infer: true }) ?? 587,
      secure: this.configService.get('SMTP_SECURE', { infer: true }) ?? false,
      auth: {
        user,
        pass,
      },
    });
  }

  get isConfigured() {
    return Boolean(this.transporter && this.fromEmail);
  }

  async sendBrandedMail(input: SendMailInput) {
    if (!this.transporter || !this.fromEmail) {
      this.logger.warn(`Skipped email to ${input.to}: ${input.subject}`);
      return {
        sent: false,
        skipped: true,
      };
    }

    const templateInput = {
      title: input.title,
      previewText: input.previewText,
      intro: input.intro,
      body: input.body,
      otpCode: input.otpCode,
      actionLabel: input.actionLabel,
      actionUrl: input.actionUrl,
      footerNote: input.footerNote,
    };

    await this.transporter.sendMail({
      to: input.to,
      from: {
        name: this.fromName,
        address: this.fromEmail,
      },
      subject: input.subject,
      html: buildBrandedEmailHtml(templateInput),
      text: buildPlainTextEmail(templateInput),
    });

    return {
      sent: true,
      skipped: false,
    };
  }
}
