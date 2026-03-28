import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { logger } from '../utils/logger.js';
import { upsertUserFromGoogleProfile } from './userService.js';

export function initGoogleAuth() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await upsertUserFromGoogleProfile(profile);
          logger.info('Google OAuth success', { userId: user.id, email: user.email });
          return done(null, user);
        } catch (err) {
          logger.error('Google OAuth upsert failed', { error: err.message });
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}
