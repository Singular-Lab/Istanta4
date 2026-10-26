export const QUEUE_NAMES = {
  WHATSAPP: 'whatsapp',
  WEBHOOKS: 'webhooks',
  EXPORTS: 'exports',
  EMAILS: 'emails',
  AI_CONTENT: 'ai-content',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
