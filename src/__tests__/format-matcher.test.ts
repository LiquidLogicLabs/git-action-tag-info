import {
  isSimplePattern,
  convertSimplePatternToRegex,
  isRegexPattern,
  matchTagFormat,
  filterTagsByFormat,
} from '../format-matcher';

describe('format-matcher', () => {
  describe('isSimplePattern', () => {
    it('should detect simple X.X pattern', () => {
      expect(isSimplePattern('X.X')).toBe(true);
      expect(isSimplePattern('vX.X')).toBe(true);
    });

    it('should detect simple X.X.X pattern', () => {
      expect(isSimplePattern('X.X.X')).toBe(true);
      expect(isSimplePattern('vX.X.X')).toBe(true);
    });

    it('should detect case-insensitive v prefix', () => {
      expect(isSimplePattern('VX.X')).toBe(true);
      expect(isSimplePattern('VX.X.X')).toBe(true);
    });

    it('should reject non-simple patterns', () => {
      expect(isSimplePattern('1.2.3')).toBe(false);
      expect(isSimplePattern('X')).toBe(false);
      expect(isSimplePattern('^\\d+\\.\\d+$')).toBe(false);
      expect(isSimplePattern('')).toBe(false);
    });

    it('should accept patterns with multiple X parts', () => {
      // The pattern allows any number of .X parts after the first X
      expect(isSimplePattern('X.X.X.X')).toBe(true);
      expect(isSimplePattern('X.X.X.X.X')).toBe(true);
    });
  });

  describe('convertSimplePatternToRegex', () => {
    it('should convert X.X to regex', () => {
      const regex = convertSimplePatternToRegex('X.X');
      expect(regex.test('3.23')).toBe(true);
      expect(regex.test('1.2')).toBe(true);
      expect(regex.test('10.5')).toBe(true);
      expect(regex.test('3.23-bae0df8a-ls3')).toBe(false); // Full match only
      expect(regex.test('edge-e9613ab3-ls213')).toBe(false);
    });

    it('should convert X.X.X to regex', () => {
      const regex = convertSimplePatternToRegex('X.X.X');
      expect(regex.test('1.2.3')).toBe(true);
      expect(regex.test('10.5.0')).toBe(true);
      expect(regex.test('1.2')).toBe(false);
      expect(regex.test('1.2.3-alpha')).toBe(false); // Full match only
    });

    it('should convert vX.X.X to regex', () => {
      const regex = convertSimplePatternToRegex('vX.X.X');
      expect(regex.test('v1.2.3')).toBe(true);
      expect(regex.test('v10.5.0')).toBe(true);
      expect(regex.test('1.2.3')).toBe(false); // Requires v prefix
      expect(regex.test('V1.2.3')).toBe(false); // Case sensitive
    });

    it('should handle longer patterns', () => {
      const regex = convertSimplePatternToRegex('X.X.X.X');
      expect(regex.test('1.2.3.4')).toBe(true);
      expect(regex.test('10.20.30.40')).toBe(true);
    });
  });

  describe('isRegexPattern', () => {
    it('should detect regex patterns starting with ^', () => {
      expect(isRegexPattern('^\\d+\\.\\d+$')).toBe(true);
      expect(isRegexPattern('^v\\d+')).toBe(true);
    });

    it('should detect regex patterns with special characters', () => {
      expect(isRegexPattern('\\d+\\.\\d+')).toBe(true);
      expect(isRegexPattern('.*')).toBe(true);
      expect(isRegexPattern('[0-9]+')).toBe(true);
      expect(isRegexPattern('(\\d+)')).toBe(true);
    });

    it('should detect regex patterns with slashes', () => {
      expect(isRegexPattern('/^\\d+\\.\\d+$/')).toBe(true);
      expect(isRegexPattern('/pattern/')).toBe(true);
    });

    it('should not detect simple patterns as regex', () => {
      expect(isRegexPattern('X.X')).toBe(false);
      expect(isRegexPattern('X.X.X')).toBe(false);
      expect(isRegexPattern('1.2.3')).toBe(false);
    });
  });

  describe('matchTagFormat', () => {
    describe('simple patterns', () => {
      it('should match X.X pattern with full match', () => {
        expect(matchTagFormat('3.23', 'X.X')).toBe(true);
        expect(matchTagFormat('1.2', 'X.X')).toBe(true);
        expect(matchTagFormat('10.5', 'X.X')).toBe(true);
      });

      it('should match X.X pattern with prefix match', () => {
        expect(matchTagFormat('3.23-bae0df8a-ls3', 'X.X')).toBe(true);
        expect(matchTagFormat('1.2-alpha', 'X.X')).toBe(true);
        expect(matchTagFormat('10.5.0', 'X.X')).toBe(false); // 10.5.0 doesn't match X.X (has 3 parts)
      });

      it('should match X.X.X pattern with full match', () => {
        expect(matchTagFormat('1.2.3', 'X.X.X')).toBe(true);
        expect(matchTagFormat('10.5.0', 'X.X.X')).toBe(true);
      });

      it('should match X.X.X pattern with prefix match', () => {
        expect(matchTagFormat('1.2.3-alpha', 'X.X.X')).toBe(true);
        expect(matchTagFormat('10.5.0-beta.1', 'X.X.X')).toBe(true);
      });

      it('should match vX.X.X pattern', () => {
        expect(matchTagFormat('v1.2.3', 'vX.X.X')).toBe(true);
        expect(matchTagFormat('v1.2.3-alpha', 'vX.X.X')).toBe(true);
        expect(matchTagFormat('1.2.3', 'vX.X.X')).toBe(false); // No v prefix
      });

      it('should not match tags that do not match pattern', () => {
        expect(matchTagFormat('edge-e9613ab3-ls213', 'X.X')).toBe(false);
        expect(matchTagFormat('latest', 'X.X')).toBe(false);
        expect(matchTagFormat('v1.2', 'X.X.X')).toBe(false);
      });
    });

    describe('regex patterns', () => {
      it('should match with regex pattern', () => {
        expect(matchTagFormat('v1.2.3', '^v\\d+\\.\\d+\\.\\d+$')).toBe(true);
        expect(matchTagFormat('v10.5.0', '^v\\d+\\.\\d+\\.\\d+$')).toBe(true);
        expect(matchTagFormat('1.2.3', '^v\\d+\\.\\d+\\.\\d+$')).toBe(false);
      });

      it('should match with regex pattern (with slashes)', () => {
        expect(matchTagFormat('v1.2.3', '/^v\\d+\\.\\d+\\.\\d+$/')).toBe(true);
        expect(matchTagFormat('1.2.3', '/^v\\d+\\.\\d+\\.\\d+$/')).toBe(false);
      });

      it('should handle invalid regex gracefully', () => {
        expect(matchTagFormat('1.2.3', '[invalid')).toBe(false);
        expect(matchTagFormat('1.2.3', '(unclosed')).toBe(false);
      });

      it('should match with prefix when regex has anchors', () => {
        // Even with anchors, prefix matching should work
        const regex = '^\\d+\\.\\d+$';
        expect(matchTagFormat('3.23', regex)).toBe(true);
        expect(matchTagFormat('3.23-bae0df8a-ls3', regex)).toBe(true); // Prefix match
      });
    });

    describe('literal strings', () => {
      it('should match exact literal strings', () => {
        expect(matchTagFormat('exact-match', 'exact-match')).toBe(true);
        expect(matchTagFormat('exact-match', 'different')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty format', () => {
        expect(matchTagFormat('any-tag', '')).toBe(false);
      });

      it('should handle empty tag name', () => {
        expect(matchTagFormat('', 'X.X')).toBe(false);
      });

      it('should handle tags with only numbers', () => {
        expect(matchTagFormat('123', 'X')).toBe(false); // X is not a valid simple pattern
        expect(matchTagFormat('123', '^\\d+$')).toBe(true); // But regex works
      });
    });

    describe('real-world examples', () => {
      it('should match linuxserver docker-baseimage-alpine tags', () => {
        // Example from the user's use case
        expect(matchTagFormat('3.23-bae0df8a-ls3', 'X.X')).toBe(true);
        expect(matchTagFormat('3.22-c210e9fe-ls18', 'X.X')).toBe(true);
        expect(matchTagFormat('3.21-633fbea2-ls27', 'X.X')).toBe(true);
        expect(matchTagFormat('edge-e9613ab3-ls213', 'X.X')).toBe(false);
      });

      it('should match semver tags with X.X.X', () => {
        expect(matchTagFormat('1.2.3', 'X.X.X')).toBe(true);
        expect(matchTagFormat('v1.2.3', 'vX.X.X')).toBe(true);
        expect(matchTagFormat('1.2.3-alpha', 'X.X.X')).toBe(true);
      });
    });
  });

  describe('filterTagsByFormat', () => {
    it('should filter tags by simple pattern', () => {
      const tags = [
        '3.23-bae0df8a-ls3',
        '3.22-c210e9fe-ls18',
        'edge-e9613ab3-ls213',
        '1.2.3',
        'latest',
      ];
      const filtered = filterTagsByFormat(tags, 'X.X');
      expect(filtered).toEqual([
        '3.23-bae0df8a-ls3',
        '3.22-c210e9fe-ls18',
      ]);
    });

    it('should filter tags by X.X.X pattern', () => {
      const tags = [
        '1.2.3',
        '1.2.3-alpha',
        '3.23-bae0df8a-ls3',
        'v2.0.0',
        'edge-e9613ab3-ls213',
      ];
      const filtered = filterTagsByFormat(tags, 'X.X.X');
      expect(filtered).toEqual([
        '1.2.3',
        '1.2.3-alpha',
      ]);
    });

    it('should filter tags by regex pattern', () => {
      const tags = [
        'v1.2.3',
        'v2.0.0',
        '1.2.3',
        'edge-e9613ab3-ls213',
      ];
      const filtered = filterTagsByFormat(tags, '^v\\d+\\.\\d+\\.\\d+$');
      expect(filtered).toEqual([
        'v1.2.3',
        'v2.0.0',
      ]);
    });

    it('should return all tags when format is empty', () => {
      const tags = ['tag1', 'tag2', 'tag3'];
      const filtered = filterTagsByFormat(tags, '');
      expect(filtered).toEqual(tags);
    });

    it('should return empty array when no tags match', () => {
      const tags = ['edge-e9613ab3-ls213', 'latest', 'dev'];
      const filtered = filterTagsByFormat(tags, 'X.X');
      expect(filtered).toEqual([]);
    });

    it('should handle empty tag list', () => {
      const filtered = filterTagsByFormat([], 'X.X');
      expect(filtered).toEqual([]);
    });
  });
});

