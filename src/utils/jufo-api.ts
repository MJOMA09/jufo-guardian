
import { JufoResponse } from "@/types";
import { searchJufoDatabase, hasDatabaseData } from "./jufo-data";

/**
 * Check publication quality in the JUFO portal
 * Enhanced with improved accuracy through better matching algorithms
 */
export const checkJufoQuality = async (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): Promise<JufoResponse & { status: 'Indexed' | 'Not Indexed' }> => {
  try {
    console.log(`=== ENHANCED JUFO QUALITY CHECK (Accuracy Focused) ===`);
    console.log(`Checking JUFO quality for: ${source}`);
    console.log(`ISSN Print: ${issnPrint || 'N/A'}`);
    console.log(`ISSN Online: ${issnOnline || 'N/A'}`);
    console.log(`ISBN: ${isbn || 'N/A'}`);
    
    // Check if source is empty or contains "unknown" text
    if (!source || source.trim() === "" || source.toLowerCase().includes("unknown")) {
      console.log("Unknown or empty source detected");
      return { 
        level: "Not found", 
        norwegianLevel: null, 
        indexed: false, 
        evaluated: false, 
        checked: true, 
        status: 'Not Indexed' 
      };
    }
    
    // If we have imported data, use enhanced matching
    if (hasDatabaseData()) {
      console.log("Using imported JUFO database for enhanced search");
      
      const result = searchJufoDatabase(source, issnPrint, issnOnline, isbn);
      
      if (result) {
        console.log(`✅ MATCH FOUND: ${result.name}, Level: ${result.level}`);
        const { isIndexed, status } = determineIndexingStatus(result.level);
        
        return {
          level: result.level,
          norwegianLevel: result.norwegianLevel,
          indexed: isIndexed,
          evaluated: result.evaluated,
          checked: true,
          status: status
        };
      }
      
      // No match found in database
      console.log(`❌ No match found in JUFO database`);
      return { 
        level: "Not found", 
        norwegianLevel: null, 
        indexed: false, 
        evaluated: false, 
        checked: true, 
        status: 'Not Indexed' 
      };
    }
    
    // Fall back to enhanced mock database if no imported data
    console.log("Falling back to enhanced mock database");
    const normalizedSource = source.toLowerCase().trim();
    
    // Enhanced mock database with more realistic and varied data
    const mockDatabase = {
      // High-impact journals (Level 3)
      "nature": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "science": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "cell": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "proceedings of the national academy of sciences": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      
      // Good quality journals (Level 2)
      "journal of informetrics": { level: 2, norwegianLevel: 2, indexed: true, evaluated: true },
      "information processing & management": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international conference on information systems": { level: 2, norwegianLevel: null, indexed: true, evaluated: true },
      "management learning": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international journal of human-computer interaction": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international journal of human–computer interaction": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "acm transactions on computer systems": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "ieee transactions on software engineering": { level: 2, norwegianLevel: 2, indexed: true, evaluated: true },
      
      // Standard journals (Level 1)
      "plos one": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "scientific reports": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "bmc bioinformatics": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "frontiers in psychology": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "sustainability": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "ieee access": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "journal of medical internet research": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "computers & education": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      
      // Level 0 journals (evaluated but not indexed)
      "predatory journal": { level: 0, norwegianLevel: null, indexed: false, evaluated: true },
      "low quality venue": { level: 0, norwegianLevel: null, indexed: false, evaluated: true },
      "questionable research quarterly": { level: 0, norwegianLevel: null, indexed: false, evaluated: true },
      
      // Variations for testing accuracy
      "nature communications": { level: 2, norwegianLevel: 2, indexed: true, evaluated: true },
      "nature biotechnology": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "science advances": { level: 2, norwegianLevel: 2, indexed: true, evaluated: true },
      "journal of agricultural sciences": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
    };
    
    // Enhanced matching for mock database with fuzzy matching for better accuracy
    let bestMatch = null;
    let bestScore = 0;
    
    // First try exact match
    const exactMatch = Object.keys(mockDatabase).find(key => {
      const normalizedKey = key.toLowerCase().trim();
      return normalizedKey === normalizedSource;
    });
    
    if (exactMatch) {
      bestMatch = exactMatch;
      bestScore = 1.0;
    } else {
      // Try fuzzy matching for better accuracy
      for (const key of Object.keys(mockDatabase)) {
        const normalizedKey = key.toLowerCase().trim();
        
        // Check if source contains the key or vice versa
        if (normalizedSource.includes(normalizedKey) || normalizedKey.includes(normalizedSource)) {
          const score = Math.max(normalizedSource.length, normalizedKey.length) / 
                       Math.min(normalizedSource.length, normalizedKey.length);
          if (score > bestScore && score >= 0.7) {
            bestMatch = key;
            bestScore = score;
          }
        }
        
        // Check for partial word matches
        const sourceWords = normalizedSource.split(/\s+/);
        const keyWords = normalizedKey.split(/\s+/);
        const commonWords = sourceWords.filter(word => 
          word.length > 3 && keyWords.some(keyWord => keyWord.includes(word) || word.includes(keyWord))
        );
        
        if (commonWords.length >= 2) {
          const wordScore = commonWords.length / Math.max(sourceWords.length, keyWords.length);
          if (wordScore > bestScore && wordScore >= 0.6) {
            bestMatch = key;
            bestScore = wordScore;
          }
        }
      }
    }
    
    // Return mock data with correct status assignment
    if (bestMatch) {
      const mockResult = mockDatabase[bestMatch as keyof typeof mockDatabase];
      const { isIndexed, status } = determineIndexingStatus(mockResult.level);
      
      console.log(`✅ Mock database match: ${bestMatch} -> Level: ${mockResult.level}, Status: ${status}, Score: ${bestScore.toFixed(2)}`);
      
      return { 
        ...mockResult,
        indexed: isIndexed,
        checked: true,
        status: status
      };
    } else {
      console.log(`❌ No match found in mock database for: ${normalizedSource}`);
      return { 
        level: "Not found", 
        norwegianLevel: null, 
        indexed: false, 
        evaluated: false, 
        checked: true, 
        status: 'Not Indexed' 
      };
    }
  } catch (error) {
    console.error("❌ Error checking JUFO quality:", error);
    return { 
      level: "Not found", 
      norwegianLevel: null, 
      indexed: false, 
      evaluated: false, 
      checked: true, 
      status: 'Not Indexed' 
    };
  }
};

/**
 * Determine indexing status based on JUFO level
 * CRITICAL LOGIC: Only levels 1, 2, 3 are indexed. Level 0 is NOT indexed.
 */
const determineIndexingStatus = (level: number | string | null | undefined): { isIndexed: boolean, status: 'Indexed' | 'Not Indexed' } => {
  if (level === null || level === undefined || level === "Not found") {
    return { isIndexed: false, status: 'Not Indexed' };
  }
  
  // Ensure we're working with a number for comparison
  const levelNum = typeof level === 'number' ? level : parseInt(String(level), 10);
  
  if (!isNaN(levelNum)) {
    // CRITICAL: Levels 1, 2, 3 are indexed. Level 0 is NOT indexed.
    if (levelNum >= 1 && levelNum <= 3) {
      return { isIndexed: true, status: 'Indexed' };
    } else if (levelNum === 0) {
      return { isIndexed: false, status: 'Not Indexed' };
    }
  }
  
  return { isIndexed: false, status: 'Not Indexed' };
};
