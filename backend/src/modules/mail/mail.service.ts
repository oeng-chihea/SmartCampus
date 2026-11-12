import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { formatCampusDateTime } from '../../common/utils/date.util';
import { SessionEntity } from '../../database/entities/session.entity';

const BCC_BATCH_SIZE = 50;
const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

export type SessionAlert = Pick<
  SessionEntity,
  'title' | 'teacherName' | 'locationName' | 'dueAt'
>;

interface MailMessage {
  to: string;
  bcc?: string[];
  subject: string;
  text: string;
}

interface MailAddress {
  name?: string;
  email: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly appBaseUrl: string;
  private readonly brevoApiKey: string;
  private readonly transporter: Transporter | null;

  constructor(config: ConfigService) {
    const host = config.get<string>('mail.host');
    const port = config.get<number>('mail.port') ?? 465;

    this.from =
      config.get<string>('mail.from') ?? 'Smart Campus <no-reply@localhost>';
    this.appBaseUrl =
      config.get<string>('mail.appBaseUrl') ?? 'https://localhost:4200';
    this.brevoApiKey = config.get<string>('mail.brevoApiKey') ?? '';
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

  get isConfigured(): boolean {
    return Boolean(this.brevoApiKey) || this.transporter !== null;
  }

  async sendPasswordReset(
    to: string,
    name: string,
    link: string,
  ): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn(`Email not configured. Reset link for ${to}: ${link}`);
      return;
    }

    await this.send({
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

  async sendSessionOpened(
    recipients: string[],
    session: SessionAlert,
  ): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn(
        `Email not configured. Skipped "${session.title}" alert for ${recipients.length} students.`,
      );
      return;
    }

    const due = session.dueAt
      ? formatCampusDateTime(session.dueAt)
      : 'No deadline';
    const text = [
      'Hi,',
      `${session.teacherName} opened an attendance session.`,
      [
        `Session: ${session.title}`,
        `Location: ${session.locationName}`,
        `Mark present before: ${due}`,
      ].join('\n'),
      'Open Smart Campus from inside the classroom to mark your attendance:',
      `${this.appBaseUrl}/student/scan`,
    ].join('\n\n');

    for (let start = 0; start < recipients.length; start += BCC_BATCH_SIZE) {
      await this.send({
        to: this.from,
        bcc: recipients.slice(start, start + BCC_BATCH_SIZE),
        subject: `Attendance open: ${session.title}`,
        text,
      }).catch((error) =>
        this.logger.error('Session alert batch failed', error),
      );
    }
  }

  private async send(message: MailMessage): Promise<void> {
    if (this.brevoApiKey) {
      await this.sendWithBrevo(message);
      return;
    }

    await this.transporter?.sendMail({ from: this.from, ...message });
  }

  private async sendWithBrevo({
    to,
    bcc,
    subject,
    text,
  }: MailMessage): Promise<void> {
    const response = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': this.brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseAddress(this.from),
        to: [parseAddress(to)],
        bcc: bcc?.map((email) => ({ email })),
        subject,
        htmlContent: toHtml(text),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Brevo responded ${response.status}: ${await response.text()}`,
      );
    }
  }
}

function parseAddress(address: string): MailAddress {
  const match = /^(.*)<([^>]+)>$/.exec(address.trim());
  if (!match) {
    return { email: address.trim() };
  }
  return { name: match[1].trim() || undefined, email: match[2].trim() };
}

function toHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}
