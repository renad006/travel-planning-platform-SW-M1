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
});