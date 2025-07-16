const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const bcrypt = require('bcryptjs');
const database = require('../database');
const logger = require('../utils/logger');

const setupPassport = (passport) => {
  // Local Strategy for username/password login
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  }, async (email, password, done) => {
    try {
      // Find user by email
      const user = await database('users')
        .select('users.*', 'organizations.name as organization_name')
        .leftJoin('organizations', 'users.organization_id', 'organizations.id')
        .where('users.email', email)
        .where('users.is_active', true)
        .first();

      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Check if account is verified
      if (!user.is_verified) {
        return done(null, false, { message: 'Please verify your email address' });
      }

      // Update last login
      await database('users')
        .where('id', user.id)
        .update({ last_login: new Date() });

      return done(null, user);
    } catch (error) {
      logger.error('Error in local authentication:', error);
      return done(error);
    }
  }));

  // JWT Strategy for API authentication
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    passReqToCallback: true
  }, async (req, jwtPayload, done) => {
    try {
      // Find user by ID from JWT payload
      const user = await database('users')
        .select('users.*', 'organizations.name as organization_name')
        .leftJoin('organizations', 'users.organization_id', 'organizations.id')
        .where('users.id', jwtPayload.id)
        .where('users.is_active', true)
        .first();

      if (!user) {
        return done(null, false);
      }

      // Check if user changed password after token was issued
      if (user.password_changed_at && jwtPayload.iat < user.password_changed_at.getTime() / 1000) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      logger.error('Error in JWT authentication:', error);
      return done(error);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await database('users')
        .select('users.*', 'organizations.name as organization_name')
        .leftJoin('organizations', 'users.organization_id', 'organizations.id')
        .where('users.id', id)
        .where('users.is_active', true)
        .first();

      done(null, user);
    } catch (error) {
      logger.error('Error in user deserialization:', error);
      done(error);
    }
  });

  logger.info('Passport authentication strategies configured');
};

module.exports = { setupPassport };