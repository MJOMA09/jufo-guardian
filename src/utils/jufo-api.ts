
import { JufoResponse } from "@/types";
import { searchJufoDatabase, hasDatabaseData } from "./jufo-data";

/**
 * Check publication quality in the JUFO portal
 * Enhanced with comprehensive matching and proper status assignment
 */
export const checkJufoQuality = async (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): Promise<JufoResponse & { status: 'Indexed' | 'Not Indexed' }> => {
  try {
    console.log(`=== JUFO QUALITY CHECK ===`);
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
    
    // If we have imported data, use that first
    if (hasDatabaseData()) {
      console.log("Using imported JUFO database for comprehensive search");
      
      // Use the enhanced comprehensive search
      const foundResult = searchJufoDatabase(source, issnPrint, issnOnline, isbn);
      
      if (foundResult) {
        // CORRECT status assignment logic:
        // - Level 1, 2, or 3: Indexed (these are quality-ranked publications)
        // - Level 0: Not Indexed (in database but not quality-ranked)
        // - Absent: Not in database at all
        
        let isIndexed = false;
        let status: 'Indexed' | 'Not Indexed' = 'Not Indexed';
        
        // Fix the type comparison issue - properly handle different level types
        if (foundResult.level !== null && foundResult.level !== undefined) {
          // Ensure we're working with a number for comparison
          const levelNum = typeof foundResult.level === 'number' ? foundResult.level : parseInt(String(foundResult.level), 10);
          
          if (!isNaN(levelNum)) {
            // CRITICAL FIX: Levels 1, 2, 3 are indexed. Level 0 is NOT indexed.
            if (levelNum >= 1 && levelNum <= 3) {
              isIndexed = true;
              status = 'Indexed';
            } else if (levelNum === 0) {
              isIndexed = false;
              status = 'Not Indexed';
            }
          }
        }
        
        console.log(`✅ FINAL RESULT: Level ${foundResult.level}, Indexed: ${isIndexed}, Status: ${status}`);
        
        return {
          level: foundResult.level,
          norwegianLevel: foundResult.norwegianLevel,
          indexed: isIndexed,
          evaluated: foundResult.evaluated,
          checked: true,
          status: status
        };
      } else {
        console.log(`❌ No match found in JUFO database for: ${source}`);
        console.log(`❌ Checked ISSN Print: ${issnPrint}, ISSN Online: ${issnOnline}, ISBN: ${isbn}`);
        // No match found in database - mark as Not found
        return { 
          level: "Not found", 
          norwegianLevel: null, 
          indexed: false, 
          evaluated: false, 
          checked: true, 
          status: 'Not Indexed' 
        };
      }
    }
    
    // Fall back to enhanced mock database if no imported data
    console.log("Falling back to enhanced mock database");
    const normalizedSource = source.toLowerCase().trim();
    
    // Enhanced mock database for testing with more realistic data
    const mockDatabase = {
      "nature": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "science": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "cell": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "plos one": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "scientific reports": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "journal of informetrics": { level: 2, norwegianLevel: 2, indexed: true, evaluated: true },
      "information processing & management": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international conference on information systems": { level: 2, norwegianLevel: null, indexed: true, evaluated: true },
      "management learning": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international journal of human-computer interaction": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international journal of human–computer interaction": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      // Add more level 1 journals for testing
      "bmc bioinformatics": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "frontiers in psychology": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "sustainability": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "ieee access": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      // Add level 0 journals (not indexed but evaluated)
      "predatory journal": { level: 0, norwegianLevel: null, indexed: false, evaluated: true },
      "low quality venue": { level: 0, norwegianLevel: null, indexed: false, evaluated: true },
      // Not found journals
      "new journal": { level: "Not found", norwegianLevel: null, indexed: false, evaluated: false },
    };
    
    // Enhanced fuzzy matching with improved normalization
    const matchedKey = Object.keys(mockDatabase).find(k => {
      // Normalize both strings for comparison
      const normalizedKey = k.toLowerCase()
        .replace(/[\-–—]/g, '') // Replace various types of hyphens/dashes
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      const normalizedQuery = normalizedSource
        .replace(/[\-–—]/g, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
        
      return normalizedKey.includes(normalizedQuery) || normalizedQuery.includes(normalizedKey);
    });
    
    // Return mock data with CORRECT status assignment
    if (matchedKey) {
      const mockResult = mockDatabase[matchedKey as keyof typeof mockDatabase];
      
      // Apply CORRECT indexing logic for mock data
      let isIndexed = false;
      let status: 'Indexed' | 'Not Indexed' = 'Not Indexed';
      
      if (mockResult.level !== null && mockResult.level !== "Not found" && typeof mockResult.level === 'number') {
        // CRITICAL: Only levels 1, 2, 3 should be marked as "Indexed"
        if (mockResult.level >= 1 && mockResult.level <= 3) {
          isIndexed = true;
          status = 'Indexed';
        } else if (mockResult.level === 0) {
          isIndexed = false;
          status = 'Not Indexed';
        }
      }
      
      console.log(`✅ Mock database match: ${matchedKey} -> Level: ${mockResult.level}, Status: ${status}`);
      
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
