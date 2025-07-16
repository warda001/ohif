const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const database = require('../database');
const logger = require('../utils/logger');

class TwoFactorService {
  constructor() {
    this.issuer = 'Radiology Platform';
  }

  /**
   * Generate a new 2FA secret for a user
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Object} Secret and QR code
   */
  async generateSecret(userId, userEmail) {
    try {
      const secret = speakeasy.generateSecret({
        name: `${this.issuer} (${userEmail})`,
        issuer: this.issuer,
        length: 32
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      // Store secret in database (not yet enabled)
      await database('users')
        .where('id', userId)
        .update({
          two_factor_secret: secret.base32,
          two_factor_enabled: false
        });

      logger.info(`2FA secret generated for user ${userId}`);

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        issuer: this.issuer
      };
    } catch (error) {
      logger.error('Failed to generate 2FA secret:', error);
      throw error;
    }
  }

  /**
   * Verify a 2FA token
   * @param {string} secret - Base32 secret
   * @param {string} token - 6-digit token
   * @param {number} window - Time window (default: 1)
   * @returns {boolean} Verification result
   */
  verifyToken(secret, token, window = 1) {
    try {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window
      });

      return verified;
    } catch (error) {
      logger.error('Failed to verify 2FA token:', error);
      return false;
    }
  }

  /**
   * Enable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} token - Verification token
   * @returns {boolean} Success status
   */
  async enableTwoFactor(userId, token) {
    try {
      const user = await database('users')
        .where('id', userId)
        .first();

      if (!user || !user.two_factor_secret) {
        throw new Error('2FA secret not found');
      }

      // Verify the token
      const isValid = this.verifyToken(user.two_factor_secret, token);
      if (!isValid) {
        throw new Error('Invalid token');
      }

      // Enable 2FA
      await database('users')
        .where('id', userId)
        .update({
          two_factor_enabled: true
        });

      logger.info(`2FA enabled for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to enable 2FA:', error);
      throw error;
    }
  }

  /**
   * Disable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} token - Verification token
   * @returns {boolean} Success status
   */
  async disableTwoFactor(userId, token) {
    try {
      const user = await database('users')
        .where('id', userId)
        .first();

      if (!user || !user.two_factor_secret) {
        throw new Error('2FA not configured');
      }

      // Verify the token
      const isValid = this.verifyToken(user.two_factor_secret, token);
      if (!isValid) {
        throw new Error('Invalid token');
      }

      // Disable 2FA
      await database('users')
        .where('id', userId)
        .update({
          two_factor_enabled: false,
          two_factor_secret: null
        });

      logger.info(`2FA disabled for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to disable 2FA:', error);
      throw error;
    }
  }

  /**
   * Generate backup codes for a user
   * @param {string} userId - User ID
   * @returns {Array<string>} Backup codes
   */
  async generateBackupCodes(userId) {
    try {
      const backupCodes = [];
      
      // Generate 10 backup codes
      for (let i = 0; i < 10; i++) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        backupCodes.push(code);
      }

      // Store hashed backup codes in database
      const hashedCodes = backupCodes.map(code => {
        return require('bcryptjs').hashSync(code, 10);
      });

      await database('users')
        .where('id', userId)
        .update({
          backup_codes: JSON.stringify(hashedCodes)
        });

      logger.info(`Backup codes generated for user ${userId}`);
      return backupCodes;
    } catch (error) {
      logger.error('Failed to generate backup codes:', error);
      throw error;
    }
  }

  /**
   * Verify a backup code
   * @param {string} userId - User ID
   * @param {string} code - Backup code
   * @returns {boolean} Verification result
   */
  async verifyBackupCode(userId, code) {
    try {
      const user = await database('users')
        .where('id', userId)
        .first();

      if (!user || !user.backup_codes) {
        return false;
      }

      const backupCodes = JSON.parse(user.backup_codes);
      const bcrypt = require('bcryptjs');

      // Check if code matches any backup code
      for (let i = 0; i < backupCodes.length; i++) {
        if (bcrypt.compareSync(code, backupCodes[i])) {
          // Remove used code
          backupCodes.splice(i, 1);
          
          await database('users')
            .where('id', userId)
            .update({
              backup_codes: JSON.stringify(backupCodes)
            });

          logger.info(`Backup code used for user ${userId}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to verify backup code:', error);
      return false;
    }
  }

  /**
   * Check if user has 2FA enabled
   * @param {string} userId - User ID
   * @returns {boolean} 2FA status
   */
  async isTwoFactorEnabled(userId) {
    try {
      const user = await database('users')
        .where('id', userId)
        .select('two_factor_enabled')
        .first();

      return user ? user.two_factor_enabled : false;
    } catch (error) {
      logger.error('Failed to check 2FA status:', error);
      return false;
    }
  }

  /**
   * Get user's 2FA status and backup codes count
   * @param {string} userId - User ID
   * @returns {Object} 2FA information
   */
  async getTwoFactorInfo(userId) {
    try {
      const user = await database('users')
        .where('id', userId)
        .select('two_factor_enabled', 'backup_codes')
        .first();

      if (!user) {
        return {
          enabled: false,
          backupCodesCount: 0
        };
      }

      let backupCodesCount = 0;
      if (user.backup_codes) {
        const codes = JSON.parse(user.backup_codes);
        backupCodesCount = codes.length;
      }

      return {
        enabled: user.two_factor_enabled,
        backupCodesCount
      };
    } catch (error) {
      logger.error('Failed to get 2FA info:', error);
      return {
        enabled: false,
        backupCodesCount: 0
      };
    }
  }

  /**
   * Verify 2FA token or backup code
   * @param {string} userId - User ID
   * @param {string} token - Token or backup code
   * @returns {boolean} Verification result
   */
  async verifyTwoFactor(userId, token) {
    try {
      const user = await database('users')
        .where('id', userId)
        .first();

      if (!user || !user.two_factor_enabled) {
        return false;
      }

      // Try token first
      if (token.length === 6 && /^\d+$/.test(token)) {
        return this.verifyToken(user.two_factor_secret, token);
      }

      // Try backup code
      if (token.length === 8 && /^[A-Z0-9]+$/.test(token)) {
        return await this.verifyBackupCode(userId, token);
      }

      return false;
    } catch (error) {
      logger.error('Failed to verify 2FA:', error);
      return false;
    }
  }
}

// Create singleton instance
const twoFactorService = new TwoFactorService();

module.exports = {
  generateSecret: twoFactorService.generateSecret.bind(twoFactorService),
  verifyToken: twoFactorService.verifyToken.bind(twoFactorService),
  enableTwoFactor: twoFactorService.enableTwoFactor.bind(twoFactorService),
  disableTwoFactor: twoFactorService.disableTwoFactor.bind(twoFactorService),
  generateBackupCodes: twoFactorService.generateBackupCodes.bind(twoFactorService),
  verifyBackupCode: twoFactorService.verifyBackupCode.bind(twoFactorService),
  isTwoFactorEnabled: twoFactorService.isTwoFactorEnabled.bind(twoFactorService),
  getTwoFactorInfo: twoFactorService.getTwoFactorInfo.bind(twoFactorService),
  verifyTwoFactor: twoFactorService.verifyTwoFactor.bind(twoFactorService)
};