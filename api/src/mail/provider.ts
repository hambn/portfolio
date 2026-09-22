import type { Services } from '../contracts.js';
import { fetchWithTimeout } from '../lib/http.js';

// A message is already validated and pinned to the configured inbox by the time
// it reaches a provider: nothing here chooses a recipient.
interface MailMessage {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}

export interface MailProvider {
  readonly name: string;
  // Throws on failure; the route turns that into a single generic error.
  send(services: Services, message: MailMessage): Promise<void>;
  // Credentials this provider needs before the route will accept anything.
  configured(services: Services): boolean;
}

const resend: MailProvider = {
  name: 'resend',
  configured: (services) => Boolean(services.config.MAIL_API_KEY),
  async send(services, message) {
    const response = await fetchWithTimeout(
      services,
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${services.config.MAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          reply_to: message.replyTo,
          subject: message.subject,
          text: message.text,
        }),
      },
      10000,
    );
    await response.body?.cancel();
    if (!response.ok) throw new Error(`resend_rejected_${response.status}`);
  },
};

// Same shape, different vendor: providers differ only in the envelope, so
// switching is a change to `email.provider` in links.json. Add a provider
// here; nothing else in the API changes.
const postmark: MailProvider = {
  name: 'postmark',
  configured: (services) => Boolean(services.config.MAIL_API_KEY),
  async send(services, message) {
    const response = await fetchWithTimeout(
      services,
      'https://api.postmarkapp.com/email',
      {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': services.config.MAIL_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          From: message.from,
          To: message.to,
          ReplyTo: message.replyTo,
          Subject: message.subject,
          TextBody: message.text,
          MessageStream: 'outbound',
        }),
      },
      10000,
    );
    await response.body?.cancel();
    if (!response.ok) throw new Error(`postmark_rejected_${response.status}`);
  },
};

const providers: Record<string, MailProvider> = { resend, postmark };

// The vendor is named in links.json, like every other identity the API serves.
export function mailProvider(name: string): MailProvider | null {
  return providers[name || 'resend'] ?? null;
}
