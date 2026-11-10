import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly transporter: Transporter | null;

  constructor(config: ConfigService) {
    const host = config.get<string>('mail.host');
    const port = config.get<number>('mail.port') ?? 465;

    this.from =
      config.get<string>('mail.from') ?? 'Smart Campus <no-reply@localhost>';
    this.transporter = host
      ? createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user: config.get<string>('mail.user'),
            pass: config.get<string>('mail.pass'),
          },
        })
      : null;
  }

  async sendPasswordReset(
    to: string,
    name: string,
    link: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`SMTP not configured. Reset link for ${to}: ${link}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Reset your Smart Campus password',
      text: [
        `Hi ${name},`,
        'Open this link to choose a new password. It works once and expires in 30 minutes:',
        link,
        'If you did not ask for this, you can ignore this email.',
      ].join('\n\n'),
    });
  }
}
