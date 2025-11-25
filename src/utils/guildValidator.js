/**
 * Guild name validation utilities
 */

class GuildValidator {
  /**
   * Compare extracted guild name with configured guild name
   * NOTE: This isn't currently used, as we no longer set a guild name in the settings.
   * @param {string} extractedGuild - Guild name from OCR
   * @param {string} configuredGuild - Guild name from settings
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Object} Validation result
   */
  validate(extractedGuild, configuredGuild, threshold = 0.8) {
    if (!extractedGuild || !configuredGuild) {
      return {
        valid: false,
        reason: 'Missing guild name',
        similarity: 0
      };
    }

    // Normalize both guild names
    const normalized1 = this.normalize(extractedGuild);
    const normalized2 = this.normalize(configuredGuild);

    // Exact match
    if (normalized1 === normalized2) {
      return {
        valid: true,
        similarity: 1.0
      };
    }

    // Calculate similarity using Levenshtein distance
    const similarity = this.calculateSimilarity(normalized1, normalized2);

    const valid = similarity >= threshold;

    return {
      valid,
      similarity,
      reason: valid ? null : `Guild mismatch: expected "${configuredGuild}", got "${extractedGuild}" (similarity: ${(similarity * 100).toFixed(1)}%)`
    };
  }

  /**
   * Normalize guild name for comparison
   */
  normalize(guildName) {
    return guildName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Validate with custom error messages
   */
  validateWithMessage(extractedGuild, configuredGuild) {
    const result = this.validate(extractedGuild, configuredGuild);
    
    if (result.valid) {
      return {
        valid: true,
        message: 'Guild name validated successfully'
      };
    } else {
      return {
        valid: false,
        message: result.reason || 'Guild name validation failed'
      };
    }
  }
}

// Export singleton instance
const guildValidator = new GuildValidator();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = guildValidator;
}

