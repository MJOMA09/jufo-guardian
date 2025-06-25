
import { JufoResponse } from "@/types";
import { searchJufoDatabase, hasDatabaseData } from "./jufo-data";

/**
 * Check publication quality in the JUFO portal
 * Enhanced with ULTRA-STRICT 100% source matching priority, then ISSN/ISBN fallback
 */
export const checkJufoQuality = async (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): Promise<JufoResponse & { status: 'Indexed' | 'Not Indexed' }> => {
  try {
    console.log(`=== ULTRA-STRICT JUFO QUALITY CHECK ===`);
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
    
    // If we have imported data, use ULTRA-STRICT matching
    if (hasDatabaseData()) {
      console.log("Using imported JUFO database for ULTRA-STRICT prioritized search");
      
      // ULTRA-STRICT PRIORITY 1: 100% exact source name matching ONLY
      console.log("=== ULTRA-STRICT PRIORITY 1: 100% EXACT SOURCE NAME MATCHING ===");
      const sourceResult = searchJufoDatabase(source);
      
      if (sourceResult) {
        console.log(`✅ 100% ULTRA-STRICT SOURCE MATCH FOUND: ${sourceResult.name}, Level: ${sourceResult.level}`);
        const { isIndexed, status } = determineIndexingStatus(sourceResult.level);
        
        return {
          level: sourceResult.level,
          norwegianLevel: sourceResult.norwegianLevel,
          indexed: isIndexed,
          evaluated: sourceResult.evaluated,
          checked: true,
          status: status
        };
      }
      
      // ULTRA-STRICT PRIORITY 2: ISSN/ISBN matching ONLY (source < 100% match)
      console.log("=== ULTRA-STRICT PRIORITY 2: ISSN/ISBN MATCHING (SOURCE < 100%) ===");
      if (issnPrint || issnOnline || isbn) {
        const identifierResult = searchJufoDatabase("", issnPrint, issnOnline, isbn);
        
        if (identifierResult) {
          console.log(`✅ ISSN/ISBN MATCH FOUND (DISCARDING < 100% SOURCE): ${identifierResult.name}, Level: ${identifierResult.level}`);
          const { isIndexed, status } = determineIndexingStatus(identifierResult.level);
          
          return {
            level: identifierResult.level,
            norwegianLevel: identifierResult.norwegianLevel,
            indexed: isIndexed,
            evaluated: identifierResult.evaluated,
            checked: true,
            status: status
          };
        }
      }
      
      // No match found in database
      console.log(`❌ No 100% ultra-strict source match OR ISSN/ISBN match found in JUFO database`);
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
    
    // ULTRA-STRICT matching for mock database - exact match only
    const matchedKey = Object.keys(mockDatabase).find(k => {
      const normalizedKey = k.toLowerCase().trim();
      return normalizedKey === normalizedSource;
    });
    
    // Return mock data with CORRECT status assignment
    if (matchedKey) {
      const mockResult = mockDatabase[matchedKey as keyof typeof mockDatabase];
      const { isIndexed, status } = determineIndexingStatus(mockResult.level);
      
      console.log(`✅ Mock database 100% exact match: ${matchedKey} -> Level: ${mockResult.level}, Status: ${status}`);
      
      return { 
        ...mockResult,
        indexed: isIndexed,
        checked: true,
        status: status
      };
    } else {
      console.log(`❌ No 100% exact match found in mock database for: ${normalizedSource}`);
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
