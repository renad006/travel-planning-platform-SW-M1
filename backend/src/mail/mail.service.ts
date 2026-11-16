import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, getTestMessageUrl } from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailInput {
  to: string;
  subject: string;
  text: string;
}

// GEN-01-B: sends email through SMTP. In development use an Ethereal test inbox.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('mail.host');
    const user = config.get<string>('mail.user');
    const pass = config.get<string>('mail.pass');
    this.from =
      config.get<string>('mail.from') ??
      'Travel Platform <no-reply@travel-platform.local>';

    if (host) {
      this.transporter = createTransport({
        host,
        port: config.get<number>('mail.port') ?? 587,
        auth: user && pass ? { user, pass } : undefined,
      });
    } else {
      this.transporter = null;
      this.logger.warn('MAIL_HOST is not set: emails will be skipped');
    }
  }

  /** Never throws: a mail failure must not break the request that triggered it. */
  async send(input: MailInput): Promise<void> {
    if (!this.transporter) return;
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      const preview = getTestMessageUrl(info);
      this.logger.log(
        `Email sent to ${input.to}${preview ? ` (preview: ${preview})` : ''}`,
      );
    } catch (error) {
      this.logger.warn(
        `Email to ${input.to} failed: ${(error as Error).message}`,
      );
    }
  }
}
