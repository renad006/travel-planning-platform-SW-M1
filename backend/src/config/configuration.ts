export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    // ACC-06: access token 15 min, refresh token 30 min of inactivity
    accessExpiresMinutes: parseInt(
      process.env.JWT_ACCESS_EXPIRES_MINUTES ?? '15',
      10,
    ),
    refreshExpiresMinutes: parseInt(
      process.env.JWT_REFRESH_EXPIRES_MINUTES ?? '30',
      10,
    ),
  },
  // PAY: Stripe + payments config (values come from env vars, never hard-coded)
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'USD',

  // GEN-01-B: SMTP settings (use an Ethereal test inbox in development)
  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from:
      process.env.MAIL_FROM ??
      'Travel Platform <no-reply@travel-platform.local>',
  },
});
