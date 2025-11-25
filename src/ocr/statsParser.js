/**
 * Parser for extracting player statistics from OCR text
 */

class StatsParser {
  /**
   * Parse OCR text to extract player statistics
   */
  parseStats(ocrText) {
    // Split into lines and clean up
    let lines = ocrText.split('\n').map(line => line.trim()).filter(line => line);
    
    // Remove very short noise lines (single letters, numbers < 3 chars)
    // But keep them if they're part of a larger context
    const cleanedLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1] || '';
      const prevLine = lines[i - 1] || '';
      
      // Keep line if:
      // - It's longer than 2 chars, OR
      // - It's a number (even if short), OR
      // - Previous/next line suggests it's important context
      if (line.length > 2 || 
          line.match(/^\d+$/) || 
          line.match(/[,\d]+/) ||
          prevLine.toLowerCase().includes('investment') ||
          prevLine.toLowerCase().includes('worth') ||
          prevLine.toLowerCase().includes('prestige')) {
        cleanedLines.push(line);
      }
    }
    
    lines = cleanedLines;
    
    const stats = {
      name: null,
      id: null,
      level: null,
      guild_name: null,
      net_worth: null,
      prestige: null,
      invested: null,
      registered: null,
      helped: null,
      ascensions: null,
      bounty_trophies: null,
      collection_score: null
    };

    // Extract player name and ID (usually at the top)
    // Format: "PlayerName PlayerID#12345" or "PlayerName PlayerIDnumber"
    // Also handles separate lines: "PlayerName" on one line, "#12345" on next line
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      
      // Check if current line is just an ID (starts with #) - indicates name is on previous line
      const separateIdMatch = line.match(/^\s*#\s*([A-Za-z0-9]+)\s*$/);
      if (separateIdMatch && i > 0) {
        // ID is on its own line - get name from previous line
        const prevLine = lines[i - 1].trim();
        
        // Make sure previous line isn't a number or common UI element
        if (prevLine && !/^\d+$/.test(prevLine) && prevLine.length >= 2 && prevLine.length <= 30) {
          stats.name = prevLine;
          stats.id = prevLine + '#' + separateIdMatch[1];
          console.log('📝 Extracted name/ID from separate lines:', stats.name, '/', stats.id);
          break;
        }
      }
      
      // Look for player ID pattern with # (with optional space before #)
      // Matches: "Name#12345", "Name #12345", "First Last#12345", "First Last #12345"
      // Now supports ALL special characters including <, >, !, @, etc.
      // Pattern: anything except # followed by # followed by alphanumeric ID
      const idMatch = line.match(/(.+?)\s*#\s*([A-Za-z0-9]+)/);
      if (idMatch) {
        // Clean up the name part: remove common OCR artifacts and normalize spaces
        // Keep special characters like <, >, !, @, etc. in the name
        let namePart = idMatch[1].trim();
        const fullId = namePart + '#' + idMatch[2]; // Normalized format
        
        // Split by whitespace to detect repeated names
        // Use a simpler split that preserves special characters
        const words = namePart.split(/\s+/).filter(w => w.length > 0);
        
        // Remove common OCR artifacts from individual words but keep special chars
        const cleanWords = words.map(w => {
          // Remove trailing/leading punctuation that's clearly OCR noise
          return w.replace(/^[,_"'\-\.]+|[,_"'\-\.]+$/g, '');
        }).filter(w => w.length > 0);
        
        // Check if name is repeated (e.g., "< SuzIa > < SuzIa >", "Kredithai Kredithai")
        // For names with special chars, compare the full cleaned words
        if (cleanWords.length >= 2) {
          const firstWord = cleanWords[0];
          const secondWord = cleanWords[1];
          
          // If first two words are the same (exact match or case-insensitive)
          if (firstWord.toLowerCase() === secondWord.toLowerCase()) {
            stats.name = firstWord;
            stats.id = firstWord + '#' + idMatch[2];
          }
          // Check for 2-word name repeated (e.g., "< Name > < Name >")
          else if (cleanWords.length >= 4) {
            const thirdWord = cleanWords[2];
            const fourthWord = cleanWords[3];
            
            // Check for pattern: "< Name > < Name >" (6 words)
            if (cleanWords.length === 6 &&
                cleanWords[0] === '<' && cleanWords[2] === '>' &&
                cleanWords[3] === '<' && cleanWords[5] === '>' &&
                cleanWords[1].toLowerCase() === cleanWords[4].toLowerCase()) {
              // Pattern: ['<', 'Name', '>', '<', 'Name', '>']
              stats.name = cleanWords[1];
              stats.id = cleanWords[1] + '#' + idMatch[2];
            }
            // Check for pattern: "< Name > < Name >" (4 words, simplified)
            else if (cleanWords.length === 4 && 
                     firstWord === '<' && secondWord === thirdWord && 
                     fourthWord === '>') {
              // This is a name with < > delimiters repeated once
              stats.name = secondWord;
              stats.id = secondWord + '#' + idMatch[2];
            }
            else if (firstWord.toLowerCase() === thirdWord.toLowerCase() && 
                secondWord.toLowerCase() === fourthWord.toLowerCase()) {
              // Pattern: "Word1 Word2 Word1 Word2" - it's a repeated 2-word name
              stats.name = firstWord + ' ' + secondWord;
              stats.id = stats.name + '#' + idMatch[2];
            }
            // Check for SIMILAR 2-word patterns with OCR variations (e.g., "ClairL Lynx Clair Lynx")
            // Use the second occurrence (words 3 and 4) as it's closer to # and more accurate
            else if (secondWord.toLowerCase() === fourthWord.toLowerCase()) {
              // Second word matches exactly, check if first and third are similar
              const word1 = firstWord.toLowerCase().replace(/[^a-z]/g, '');
              const word3 = thirdWord.toLowerCase().replace(/[^a-z]/g, '');
              
              // Check if one contains the other (OCR variation like "clairl" vs "clair")
              if ((word1.includes(word3) || word3.includes(word1)) && Math.abs(word1.length - word3.length) <= 2) {
                console.log('🔧 Detected similar 2-word pattern with OCR variation, using second occurrence:', thirdWord, fourthWord);
                stats.name = thirdWord + ' ' + fourthWord;
                stats.id = stats.name + '#' + idMatch[2];
              } else {
                // No clear pattern, use all words
                stats.name = cleanWords.join(' ');
                stats.id = stats.name + '#' + idMatch[2];
              }
            }
            // Check if second and third match (e.g., "noise Gabs888 Gabs888")
            else if (secondWord.toLowerCase() === thirdWord.toLowerCase()) {
              // Second and third match, use second word (skip first as noise)
              stats.name = secondWord;
              stats.id = secondWord + '#' + idMatch[2];
            }
            // Check if first and third match
            else if (firstWord.toLowerCase() === thirdWord.toLowerCase()) {
              // First and third match - single word repeated with noise in between
              stats.name = firstWord;
              stats.id = firstWord + '#' + idMatch[2];
            } else {
              // No repetition pattern found - use all words as name
              stats.name = cleanWords.join(' ');
              stats.id = stats.name + '#' + idMatch[2];
            }
          }
          // Only 3 words total
          else if (cleanWords.length === 3) {
            const thirdWord = cleanWords[2];
            // Check for pattern: "< Name >"
            if (firstWord === '<' && thirdWord === '>') {
              stats.name = secondWord;
              stats.id = secondWord + '#' + idMatch[2];
            }
            else if (firstWord.toLowerCase() === thirdWord.toLowerCase()) {
              // First and third match (e.g., "Name Name noise")
              stats.name = firstWord;
              stats.id = firstWord + '#' + idMatch[2];
            } 
            // Check if second and third are SIMILAR (OCR variation like "zane" and "Zane�")
            else {
              const word2 = secondWord.toLowerCase().replace(/[^a-z0-9]/g, '');
              const word3 = thirdWord.toLowerCase().replace(/[^a-z0-9]/g, '');
              
              // If words 2 and 3 are similar (one contains the other or exact match)
              if (word2 === word3 || ((word2.includes(word3) || word3.includes(word2)) && Math.abs(word2.length - word3.length) <= 2)) {
                // Check if first word is a short all-caps suffix (like "TM", "II", "Jr")
                if (firstWord.length <= 3 && firstWord === firstWord.toUpperCase() && /^[A-Z]+$/.test(firstWord)) {
                  // Combine: second word + first word as suffix
                  console.log('🔧 Detected suffix pattern, combining:', secondWord + firstWord);
                  stats.name = secondWord + firstWord;
                  stats.id = stats.name + '#' + idMatch[2];
                } else {
                  // Second and third match (e.g., "noise Name Name")
                  stats.name = secondWord;
                  stats.id = secondWord + '#' + idMatch[2];
                }
              } else {
                // No repetition - use all words
                stats.name = cleanWords.join(' ');
                stats.id = stats.name + '#' + idMatch[2];
              }
            }
          } else {
            // Only 2 words - could be "< Name" or "Name >" or multi-word name
            stats.name = cleanWords.join(' ');
            stats.id = stats.name + '#' + idMatch[2];
          }
        } else {
          // Only one clean word
          stats.name = cleanWords[0] || namePart;
          stats.id = stats.name + '#' + idMatch[2];
        }
        
        // Check previous lines for cleaner version of the name (handles OCR prefix errors)
        // Example: Line 0: "CheezDipz", Line 1: "ZCheezDipz#10660" → use "CheezDipz"
        // Also handles truncation: Line 0: "zaneTM", Line 1: "zaneT#89534" → use "zaneTM"
        // Note: With special chars support, this is less critical but still useful
        if (stats.name && i > 0) {
          for (let j = 0; j < i; j++) {
            const prevLine = lines[j].trim();
            
            // Check if previous line could be a cleaner version (reasonable length, not just symbols)
            if (prevLine.length >= 3 && prevLine.length <= 30) {
              // Check if extracted name contains previous line (e.g., "ZCheezDipz" contains "CheezDipz")
              const nameNoSpaces = stats.name.replace(/\s/g, '');
              const prevNoSpaces = prevLine.replace(/\s/g, '');
              
              if (nameNoSpaces.toLowerCase().includes(prevNoSpaces.toLowerCase())) {
                // Check if removing first char(s) from extracted name gives us the previous line
                if (nameNoSpaces.substring(1).toLowerCase() === prevNoSpaces.toLowerCase()) {
                  console.log('🔄 Found cleaner name in previous line:', prevLine, '(was:', stats.name + ')');
                  stats.name = prevLine;
                  stats.id = prevLine + '#' + idMatch[2];
                  break;
                }
              }
              
              // Compare extracted name with previous line to find cleaner version
              // The name extracted from the ID line (with #) is usually more accurate
              
              // Case 1: Previous line is SHORTER - could be cleaner without prefix noise
              // Example: Previous="CheezDipz", Extracted="ZCheezDipz" → use "CheezDipz"
              if (nameNoSpaces.toLowerCase().startsWith(prevNoSpaces.toLowerCase()) && 
                  prevNoSpaces.length < nameNoSpaces.length) {
                const lengthDiff = nameNoSpaces.length - prevNoSpaces.length;
                if (lengthDiff <= 3) {
                  console.log('🔄 Found cleaner name in previous line (removing OCR prefix noise):', prevLine, '(was:', stats.name + ')');
                  stats.name = prevLine;
                  stats.id = prevLine + '#' + idMatch[2];
                  break;
                }
              }
              
              // Case 2: Previous line is LONGER - likely has OCR suffix noise
              // Example: Previous="Kredithais", Extracted="Kredithai" → use "Kredithai" (from ID line)
              // The name from the ID line is more accurate, so SKIP the previous line
              else if (prevNoSpaces.toLowerCase().startsWith(nameNoSpaces.toLowerCase()) && 
                  prevNoSpaces.length > nameNoSpaces.length) {
                const lengthDiff = prevNoSpaces.length - nameNoSpaces.length;
                if (lengthDiff <= 3) {
                  console.log('⏭️ Skipping previous line with OCR suffix noise:', prevLine, '(keeping:', stats.name + ')');
                  // Don't update - keep the name extracted from ID line
                  break;
                }
              }
            }
          }
        }
        
        console.log('📝 Extracted name/ID:', stats.name, '/', stats.id);
      }
      
      // Fix duplicated names (e.g., "SodziakowaSodziakowa" → "Sodziakowa")
      // This can happen when PaddleOCR merges the same text detected twice
      if (stats.name) {
        const nameLen = stats.name.length;
        if (nameLen >= 6 && nameLen % 2 === 0) {
          const halfLen = nameLen / 2;
          const firstHalf = stats.name.substring(0, halfLen);
          const secondHalf = stats.name.substring(halfLen);
          
          if (firstHalf === secondHalf) {
            const duplicatedName = stats.name; // Save before fixing
            console.log('🔧 Fixed duplicated name:', stats.name, '→', firstHalf);
            stats.name = firstHalf;
            
            // Update ID if it contains the duplicated name
            if (stats.id && stats.id.startsWith(duplicatedName)) {
              // Replace the duplicated name part with the fixed name
              stats.id = firstHalf + stats.id.substring(duplicatedName.length);
              console.log('🔧 Fixed duplicated ID:', stats.id);
            }
          }
        }
      }
      
      // Look for ID pattern without # (OCR error common case)
      // Pattern: Name followed by NameWithMixedCaseAndNumbers
      // Now supports special characters in names
      if (!stats.id) {
        // Match patterns like "Gabi Gabizg0328" or "< Name > NameID123"
        // Allow any characters in first part, alphanumeric with numbers in second
        const nameIdMatch = line.match(/(.{3,30})\s+([A-Za-z]+[a-z]*[0-9]+)/);
        if (nameIdMatch) {
          const namePart = nameIdMatch[1].trim();
          // Clean up similar to main pattern
          const words = namePart.split(/\s+/).filter(w => w.length > 0);
          const cleanWords = words.map(w => w.replace(/^[,_"'\-\.]+|[,_"'\-\.]+$/g, '')).filter(w => w.length > 0);
          stats.name = cleanWords.join(' ');
          // Format the ID with # separator for consistency
          stats.id = `${stats.name}#${nameIdMatch[2]}`;
          console.log('📝 Extracted name/ID without # separator:', stats.name, '/', stats.id);
        }
      }
      
      // Look for standalone name (only if no name found yet)
      // Accept any characters now, not just letters
      if (!stats.name && line.length > 2 && line.length < 30) {
        // Skip if it's likely a stat keyword
        const statKeywords = ['net worth', 'prestige', 'investment', 'helped', 'ascension', 'bounty', 'collection', 'online', 'member'];
        const isStatKeyword = statKeywords.some(kw => line.toLowerCase().includes(kw));
        if (!isStatKeyword) {
          stats.name = line.trim();
        }
      }
    }

    // Extract guild name - prioritize clean standalone lines
    // Find which line has the player ID (guild name should be after this)
    let playerLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (stats.id && lines[i].includes(stats.id)) {
        playerLineIndex = i;
        break;
      }
    }
    
    // First pass: Look for clean standalone guild names
    // Start searching AFTER the player ID line
    if (!stats.guild_name) {
      const startLine = playerLineIndex >= 0 ? playerLineIndex + 1 : 0;
      
      for (let i = startLine; i < Math.min(lines.length, 15); i++) {
        const line = lines[i].trim();
        
        // Look for clean standalone guild name (just letters, no extra junk)
        // This should appear AFTER player name/ID
        if ((stats.name || stats.id) && !stats.guild_name) {
          // Skip lines that start with single letters followed by space (OCR noise like "E Net worth")
          if (line.match(/^[A-Z]\s/)) {
            console.log('⏭️ Skipping line with single letter prefix:', line);
            continue;
          }
          
          // Skip stat-related keywords and status indicators
          const statKeywords = [
            'net worth', 'prestige', 'investment', 'mastered', 'helped', 
            'ascension', 'bounty', 'collection', 'active', 'level', 'officer',
            'last active', 'online', 'guildmaster', 'member'
          ];
          const lineToCheck = line.toLowerCase();
          const containsStatKeyword = statKeywords.some(keyword => lineToCheck.includes(keyword));
          if (containsStatKeyword) {
            console.log('⏭️ Skipping line with stat/status keyword:', line);
            continue;
          }
          
          // Skip lines that contain "#" (player tags/IDs)
          // May be an issue if a guild has a # in its name
          if (line.includes('#')) {
            console.log('⏭️ Skipping line with # (player tag):', line);
            continue;
          }
          
          // Extract guild name from line (may have OCR noise like numbers or dashes)
          // Pattern: Find word(s) that look like a guild name (supports up to 3 words, including special chars)
          const guildNameMatch = line.match(/\b([^\s]{3,}(?:\s+[^\s]+){0,2})\b/);
          if (guildNameMatch) {
            const potentialGuild = guildNameMatch[1].trim();
            
            // Skip pure numbers (likely level, rank, or UI elements)
            if (/^\d+$/.test(potentialGuild)) {
              console.log('⏭️ Skipping pure number:', potentialGuild);
              continue;
            }
            
            // Skip if it contains part of the player name or player ID
            if (stats.name && (potentialGuild.toLowerCase().includes(stats.name.toLowerCase()) || stats.name.toLowerCase().includes(potentialGuild.toLowerCase()))) {
              continue;
            }
            
            // Skip if it looks like part of player ID (contains player name substring)
            if (stats.id && potentialGuild.includes('#')) {
              continue;
            }
            
            // Skip UI terms, rank labels, and common single words
            const uiTerms = ['online', 'offline', 'visit', 'shop', 'member', 'settings', 
                             'officer', 'leader', 'guildmaster', 'elder', 'recruit', 'veteran'];
            if (uiTerms.includes(potentialGuild.toLowerCase())) {
              console.log('⏭️ Skipping UI term/class/rank:', potentialGuild);
              continue;
            }
            
            // Skip short all-caps words (likely titles like "ICICI", "ANCIENT", etc)
            // unless they're longer guild names
            if (potentialGuild.length <= 8 && potentialGuild === potentialGuild.toUpperCase() && /^[A-Z]+$/.test(potentialGuild)) {
              console.log('⏭️ Skipping likely title (short all-caps):', potentialGuild);
              continue;
            }
            
            // Skip short mixed-case words that start with uppercase and have lowercase/uppercase mix
            // These are often titles (e.g., "UvGly", "Ancient")
            if (potentialGuild.length <= 8 && /^[A-Z][a-z]*[A-Z]/.test(potentialGuild)) {
              console.log('⏭️ Skipping likely title (short mixed-case):', potentialGuild);
              continue;
            }
            
            console.log('📛 Found guild name:', potentialGuild, '(line', i, ':', line + ')');
            stats.guild_name = potentialGuild;
            break;
          }
        }
      }
    }
    
    // Second pass: If no clean guild name found, try extracting from noisy lines
    if (!stats.guild_name && (stats.name || stats.id)) {
      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const line = lines[i];
        
        // Skip stat labels and status indicators
        if (line.match(/^(net\s*worth|prestige|invested|registered|helped|ascensions|bounty|collection|active|level|last\s*active|mastered|online|officer|member|guildmaster)/i)) {
          continue;
        }
        
        // Try to extract a word (including special characters)
        const wordMatch = line.match(/([^\s]{3,}(?:\s+[^\s]+){0,2})/);
        if (wordMatch) {
          const potentialGuild = wordMatch[1].trim();
          
          // Skip pure numbers (likely level, rank, or UI elements)
          if (/^\d+$/.test(potentialGuild)) {
            continue;
          }
          
          // Skip if same as player name
          if (stats.name && potentialGuild.toLowerCase().includes(stats.name.toLowerCase())) {
            continue;
          }
          
          // Skip UI terms, rank labels, and common single words (same as first pass)
          const uiTerms = ['online', 'offline', 'visit', 'shop', 'member', 'settings', 
                           'officer', 'leader', 'guildmaster', 'elder', 'recruit', 'veteran'];
          if (uiTerms.includes(potentialGuild.toLowerCase())) {
            continue;
          }
          
          console.log('📛 Found guild name from noisy line:', potentialGuild, '(line', i + ')');
          stats.guild_name = potentialGuild;
          break;
        }
      }
    }
    
    // Look for pattern "NUMBER GuildName" in early lines - this is MORE RELIABLE than isolated words
    // Pattern: "98 Hailight" is a strong indicator of guild name + level
    // This should OVERRIDE any previously found isolated words which are often OCR errors from titles
    let levelGuildName = null;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      // Pattern: "98 Hailight" - 2-digit number followed by capitalized word
      const levelGuildMatch = line.match(/^(\d{2})\s+([A-Z][A-Za-z]{3,})/);
      if (levelGuildMatch) {
        const potentialGuild = levelGuildMatch[2];
        // Skip UI terms
        const uiTerms = ['online', 'offline', 'officer', 'leader', 'member'];
        if (!uiTerms.includes(potentialGuild.toLowerCase())) {
          console.log('📛 Found guild name with level pattern (reliable):', potentialGuild, '(line', i + ':', line + ')');
          levelGuildName = potentialGuild;
          break;
        }
      }
    }
    
    // If we found a guild with level pattern, prefer it over any isolated word
    if (levelGuildName) {
      if (stats.guild_name && stats.guild_name !== levelGuildName) {
        console.log('📛 Replacing isolated guild name', stats.guild_name, 'with level-pattern guild:', levelGuildName);
      }
      stats.guild_name = levelGuildName;
    }
    
    // Clean up guild name - remove common OCR noise at the end (single letters) and numbers
    if (stats.guild_name) {
      // Remove trailing single letters that are likely OCR noise (e.g., "Hailight I" -> "Hailight")
      stats.guild_name = stats.guild_name.replace(/\s+[A-Z]$/i, '').trim();
      
      // Remove trailing numbers that might be level badges (e.g., "Hailight 98" -> "Hailight")
      stats.guild_name = stats.guild_name.replace(/\s+\d+$/, '').trim();
      
      console.log('Guild name after cleanup:', stats.guild_name);
    }

    // Extract level - look for explicit "Level:" or numbers in first 3 lines only
    let level = null;
    const levelExplicit = ocrText.match(/level[:\s]+(\d{1,3})/i);
    if (levelExplicit) {
      level = parseInt(levelExplicit[1]);
    } else {
      // Only search first 3 lines for level (badge number)
      const firstLines = lines.slice(0, 3).join('\n');
      const numbersInTop = firstLines.match(/\b(\d{2})\b/g);
      if (numbersInTop) {
        for (const num of numbersInTop) {
          const n = parseInt(num);
          // Level is typically 1-99, not part of ID
          if (n >= 1 && n <= 99 && stats.id && !stats.id.includes(num)) {
            level = n;
            console.log('📊 Found level:', level, 'in top lines');
            break;
          }
        }
      }
    }
    
    // If no level found, set to null (level is optional - OCR often can't read badge numbers)
    if (!level) {
      console.log('⚠️ Level not found - OCR may not be able to read the level badge');
      stats.level = null;
    } else {
      stats.level = level;
      
      // If guild name was found but level is also present, check if there's a better guild name
      // on the same line as the level (this is more reliable than isolated words)
      if (stats.guild_name && level) {
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
          const line = lines[i];
          // Check if this line contains the level
          if (line.includes(String(level))) {
            // Extract guild name - could be before or after the level
            // Pattern: "Hailight 98" or "98 Hailight"
            const beforeLevel = line.split(String(level))[0].trim();
            const afterLevel = line.split(String(level))[1]?.trim() || '';
            
            // Try to find a valid guild name (prefer text before level if both exist)
            let betterGuildName = null;
            
            // Check text before level
            if (beforeLevel) {
              const guildMatch = beforeLevel.match(/([A-Za-z][A-Za-z0-9\s]{2,}?)\s*$/);
              if (guildMatch) {
                betterGuildName = guildMatch[1].trim();
              }
            }
            
            // If no name before, check after level
            if (!betterGuildName && afterLevel) {
              const guildMatch = afterLevel.match(/^([A-Za-z][A-Za-z0-9\s]{2,}?)(?:\s|$)/);
              if (guildMatch) {
                betterGuildName = guildMatch[1].trim();
              }
            }
            
            if (betterGuildName) {
              // Skip if it's a rank/UI term
              const uiTerms = ['online', 'offline', 'officer', 'leader', 'guildmaster', 'member'];
              if (!uiTerms.includes(betterGuildName.toLowerCase())) {
                console.log('📛 Found better guild name on same line as level:', betterGuildName, '(replacing:', stats.guild_name + ')');
                stats.guild_name = betterGuildName;
                break;
              }
            }
          }
        }
      }
    }

    // Extract Net worth (find the line with "Net worth", then get first number on same or next line)
    const netWorth = this.extractStatValue(lines, ['net worth', 'worth'], ocrText, 'first');
    stats.net_worth = (netWorth && this.isValidNumberFormat(netWorth)) ? netWorth : null;

    // Extract Prestige (second value when on same line as Net worth)
    const prestige = this.extractStatValue(lines, ['prestige'], ocrText, 'second');
    stats.prestige = (prestige && this.isValidNumberFormat(prestige)) ? prestige : null;

    // Extract Investments/Invested (pick largest number since investments are always large values)
    const invested = this.extractStatValue(lines, ['investment', 'invested'], ocrText, 'largest');
    stats.invested = (invested && this.isValidNumberFormat(invested)) ? invested : null;

    // Extract Registered/Helped/Ascensions (these are smaller numbers)
    const helped = this.extractStatValue(lines, ['helped'], ocrText, 'first');
    if (helped) {
      stats.helped = this.parseNumber(helped);
    }

    const ascensions = this.extractStatValue(lines, ['ascension'], ocrText, 'second');
    if (ascensions) {
      stats.ascensions = this.parseNumber(ascensions);
    }

    // Extract Bounty Trophies and Collection Score (special handling for multiple values)
    const bountyTrophies = this.extractStatValue(lines, ['bounty trophies', 'bounty'], ocrText, 'first', true);
    if (bountyTrophies) {
      stats.bounty_trophies = this.parseNumber(bountyTrophies);
    }

    // Extract Collection Score (second value on same line as Bounty)
    // Only extract if it's different from bounty trophies (avoids duplicate when OCR is poor)
    const collectionScore = this.extractStatValue(lines, ['collection score', 'collection'], ocrText, 'second', true);
    if (collectionScore && collectionScore !== bountyTrophies) {
      stats.collection_score = this.parseNumber(collectionScore);
    }
    
    // Extract Mastered (shown in game as "Mastered" - blueprints mastered)
    // Mastered is typically a 3-digit number, pick the smallest meaningful number
    // NOTE: Stored in stats.registered for backward compatibility with existing database
    const mastered = this.extractStatValue(lines, ['mastered'], ocrText, 'smallest', true);
    if (mastered) {
      stats.registered = this.parseNumber(mastered);
    }
    
    console.log('Extracted stats:', {
      net_worth: stats.net_worth,
      prestige: stats.prestige,
      invested: stats.invested,
      helped: stats.helped,
      ascensions: stats.ascensions
    });

    return stats;
  }

  /**
   * Extract a stat value by searching for keywords (handles multi-line)
   * @param {Array} lines - Array of text lines
   * @param {Array} keywords - Keywords to search for
   * @param {string} fullText - Full OCR text
   * @param {string} position - 'first', 'second', 'last', or 'largest' for which number to pick
   * @param {boolean} skipSmallNumbers - Skip single/double digit numbers if larger ones exist
   */
  extractStatValue(lines, keywords, fullText, position = 'first', skipSmallNumbers = false) {
    // Skip the old same-line method for multi-value lines
    // (it doesn't respect the position parameter)
    
    // Use multi-line approach which respects position parameter
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Check if this line contains any of our keywords
      const matchedKeyword = keywords.find(kw => line.includes(kw.toLowerCase()));
      
      if (matchedKeyword) {
        console.log(`🔍 Found keyword "${matchedKeyword}" on line ${i}:`, lines[i]);
        
        // Check if keyword and number are on the same line
        const keywordIndex = line.indexOf(matchedKeyword.toLowerCase());
        const lineAfterKeyword = lines[i].substring(keywordIndex + matchedKeyword.length);
        const numberOnSameLine = lineAfterKeyword.match(/([0-9,]+)/);
        
        if (numberOnSameLine) {
          console.log(`   ✓ Found number after keyword on same line:`, numberOnSameLine[1]);
          return numberOnSameLine[1];
        }
        
        // Check for two-column layout: if previous line also has a stat keyword
        // This indicates values will be on separate lines (e.g., "Net worth" / "Prestige" on lines 7/8, values on lines 9/10)
        const statKeywords = ['net worth', 'worth', 'prestige', 'investment', 'invested', 'helped', 'ascension', 'mastered', 'registered', 'bounty', 'collection'];
        const prevLineIsStatKeyword = i > 0 && statKeywords.some(kw => lines[i-1].toLowerCase().includes(kw));
        // const nextLineIsStatKeyword = i < lines.length - 1 && statKeywords.some(kw => lines[i+1].toLowerCase().includes(kw));
        
        // Look for numbers on the next line (common in Shop Titans UI)
        // Also check next 2-3 lines in case text is split
        let allNumbers = [];
        let startLine = i + 1;
        
        // If we're looking for 'second' or 'smallest' value and previous line had a stat keyword,
        // we need to check the layout type by finding the first line with numbers
        // Example horizontal multi-column: "Net worth" (line i-1), "Prestige" (line i), "5,090,366,434    98,815" (line i+1)
        // Example vertical multi-column: "Net worth" (line i-1), "Prestige" (line i), "HEA" (line i+1), "5,090,366,434" (line i+2), "98,815" (line i+3)
        // Example two-column: "Investments" (line i-1), "Mastered" (line i), "18,827,374,500" (line i+1), "176" (line i+2)
        if ((position === 'second' || position === 'smallest') && prevLineIsStatKeyword) {
          // Look ahead up to 3 lines to find the first line with numbers
          // Skip single-digit UI indicators
          let firstValueLine = null;
          let firstValueLineNums = null;
          for (let lookAhead = i + 1; lookAhead < Math.min(i + 4, lines.length); lookAhead++) {
            const nums = lines[lookAhead].match(/([0-9,]+)/g);
            if (nums && nums.length > 0) {
              // Skip single-digit only lines (UI indicators)
              const line = lines[lookAhead].trim();
              const isSingleDigitOnly = line.length <= 2 && /^[0-9]$/.test(line);
              
              if (isSingleDigitOnly) {
                continue; // Skip and look at next line
              }
              
              firstValueLine = lookAhead;
              firstValueLineNums = nums;
              break;
            }
          }
          
          // Check if the first value line has multiple numbers (horizontal layout) or single number (vertical layout)
          if (firstValueLineNums && firstValueLineNums.length > 1) {
            console.log(`   🔄 Horizontal multi-column layout detected (${firstValueLineNums.length} values on same line), using position-based extraction`);
            // Don't skip - use the numbers on the value line directly
            startLine = firstValueLine;
          } else if (firstValueLine !== null) {
            // Single number on the first value line - this is vertical multi-column layout
            // We need to skip this first value (belongs to previous keyword) and use the next line
            console.log(`   🔄 Vertical multi-column layout detected, skipping first value line`);
            startLine = firstValueLine + 1; // Skip to the second value line
          }
        }
        
        for (let j = startLine; j < Math.min(startLine + 3, lines.length); j++) {
          const nums = lines[j].match(/([0-9,]+)/g);
          if (nums) {
            // Filter out single-digit numbers that are on their own line
            // (these are usually UI indicators, not actual stat values)
            const line = lines[j].trim();
            const isSingleDigitOnly = line.length <= 2 && /^[0-9]$/.test(line);
            
            if (isSingleDigitOnly) {
              console.log(`   ⏭️ Skipping line with single digit UI indicator: "${line}"`);
              continue; // Skip this line and check the next one
            }
            
            allNumbers = allNumbers.concat(nums);
            break; // Found numbers, stop looking
          }
        }
        
        if (allNumbers && allNumbers.length > 0) {
          // Filter out OCR noise: remove numbers that are clearly wrong
          // Investment numbers should be > 1000, net worth > 100000
          const isInvestmentOrNetWorth = keywords.some(kw => 
            ['investment', 'invested', 'net worth', 'worth'].includes(kw.toLowerCase())
          );
          
          if (isInvestmentOrNetWorth && allNumbers.length > 1) {
            // Filter: keep only numbers with commas OR numbers > 1000
            const filtered = allNumbers.filter(num => {
              const hasComma = num.includes(',');
              const value = parseInt(num.replace(/,/g, ''));
              return hasComma || value > 1000;
            });
            if (filtered.length > 0) {
              allNumbers = filtered;
              console.log(`   🧹 Filtered out small investment numbers, remaining:`, allNumbers);
            }
          }
          
          if (allNumbers.length > 0) {
            // Filter out small numbers (OCR noise) if requested
            if (skipSmallNumbers) {
              const filteredNumbers = allNumbers.filter(num => {
                const parsed = parseInt(num.replace(/,/g, ''));
                return parsed >= 100; // Keep numbers >= 100
              });
              
              if (filteredNumbers.length > 0) {
                allNumbers = filteredNumbers;
                console.log(`   🧹 Filtered out small numbers, remaining:`, allNumbers);
              }
            }
            
            let selectedNumber;
            
            // Use the position parameter to decide which number to pick
            if (position === 'largest') {
              // Pick the largest number (useful for investments which are always large)
              selectedNumber = allNumbers.reduce((max, current) => {
                const maxVal = parseInt(max.replace(/,/g, ''));
                const currentVal = parseInt(current.replace(/,/g, ''));
                return currentVal > maxVal ? current : max;
              });
              console.log(`   ✓ Found number(s) on next line:`, allNumbers, `-> selected (largest):`, selectedNumber);
            } else if (position === 'smallest') {
              if (allNumbers.length === 1 && prevLineIsStatKeyword) {
                // Multi-column layout: we already skipped ahead to the correct value's line
                selectedNumber = allNumbers[0];
                console.log(`   ✓ Found smallest value (multi-column layout):`, selectedNumber);
              } else {
                // Pick the smallest number (useful for mastered/small stats)
                selectedNumber = allNumbers.reduce((min, current) => {
                  const minVal = parseInt(min.replace(/,/g, ''));
                  const currentVal = parseInt(current.replace(/,/g, ''));
                  return currentVal < minVal ? current : min;
                });
                console.log(`   ✓ Found number(s) on next line:`, allNumbers, `-> selected (smallest):`, selectedNumber);
              }
            } else if (position === 'last') {
              // Pick the last number
              selectedNumber = allNumbers[allNumbers.length - 1];
              console.log(`   ✓ Found number(s) on next line:`, allNumbers, `-> selected (last):`, selectedNumber);
            } else if (position === 'second') {
              if (allNumbers.length > 1) {
                // Multiple numbers on same line, pick second
                selectedNumber = allNumbers[1];
                console.log(`   ✓ Found number(s) on next line:`, allNumbers, `-> selected (second):`, selectedNumber);
              } else if (allNumbers.length === 1 && prevLineIsStatKeyword) {
                // Multi-column layout: we already skipped ahead to the correct value's line
                selectedNumber = allNumbers[0];
                console.log(`   ✓ Found second value (multi-column layout):`, selectedNumber);
              } else {
                // Only one number available and not in two-column layout
                console.log(`   ⚠️ Only one number found, cannot extract second value from:`, allNumbers);
                return null;
              }
            } else {
              selectedNumber = allNumbers[0];
              console.log(`   ✓ Found number(s) on next line:`, allNumbers, `-> selected (${position}):`, selectedNumber);
            }
            
            return selectedNumber;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract a stat value by searching for keywords (OLD METHOD - keeping for reference)
   */
  extractStat(text, keywords) {
    for (const keyword of keywords) {
      const pattern = new RegExp(keyword + '[:\\s]+([\\d,]+)', 'i');
      const match = text.match(pattern);
      if (match) {
        return match[1].replace(/[^0-9,]/g, '');
      }
    }
    return null;
  }

  /**
   * Validate if a number string has proper comma formatting
   * Proper format: groups of 3 digits separated by commas (e.g., "1,234,567" or "12,345")
   * Also allows numbers without commas (e.g., "3781", "166")
   */
  isValidNumberFormat(str) {
    if (!str) return false;
    // Remove commas to check if it's all digits
    const digitsOnly = str.replace(/,/g, '');
    if (!/^\d+$/.test(digitsOnly)) return false;
    
    // If there are no commas, it's valid (e.g., "3781", "166")
    if (!str.includes(',')) return true;
    
    // Check comma placement: should be every 3 digits from the right
    const parts = str.split(',');
    
    // First part can be 1-3 digits, rest must be exactly 3 digits
    if (parts[0].length > 3 || parts[0].length < 1) return false;
    
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].length !== 3) {
        console.log('⚠️ Malformed number detected:', str, '- part', i, 'has', parts[i].length, 'digits instead of 3');
        return false;
      }
    }
    
    return true;
  }

  /**
   * Parse number string (handles commas and OCR noise)
   */
  parseNumber(str) {
    if (!str) return null;
    
    // Check if the number format is valid
    if (!this.isValidNumberFormat(str)) {
      console.log('⚠️ Skipping malformed number:', str);
      return null;
    }
    
    // Remove commas and any non-digit characters (OCR noise)
    const cleaned = str.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Validate if stats object has minimum required fields
   */
  isValid(stats) {
    // Require at least name or ID, and guild name
    const hasIdentifier = stats.name || stats.id;
    const hasGuild = stats.guild_name;
    
    // Require at least 2 key stats (net worth, prestige, or investments)
    const keyStatsCount = [
      stats.net_worth,
      stats.prestige,
      stats.invested
    ].filter(val => val !== null && val !== undefined).length;
    
    const hasMinimumStats = keyStatsCount >= 2;
    
    console.log('Validation check:', {
      hasIdentifier,
      hasGuild,
      keyStatsCount,
      hasMinimumStats,
      isValid: hasIdentifier && hasGuild && hasMinimumStats
    });
    
    return hasIdentifier && hasGuild && hasMinimumStats;
  }

  /**
   * Parse stats from OCR result object
   */
  parseFromOCR(ocrResult) {
    const stats = this.parseStats(ocrResult.text);
    
    // Add OCR confidence
    stats._confidence = ocrResult.confidence;
    
    return stats;
  }
}

// Export singleton instance
const statsParser = new StatsParser();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = statsParser;
}

