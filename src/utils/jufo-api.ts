
import { JufoResponse } from "@/types";
import { searchJufoDatabase, hasDatabaseData } from "./jufo-data";

/**
 * Check publication quality in the JUFO portal
 * Priority: ISSN (print/online) or ISBN first, then source name
 * Enhanced with improved accuracy and recall
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
        level: "Absent", 
        norwegianLevel: null, 
        indexed: false, 
        evaluated: false, 
        checked: true, 
        status: 'Not Indexed' 
      };
    }
    
    // If we have imported data, use that first
    if (hasDatabaseData()) {
      console.log("Using imported JUFO database for search");
      
      let foundResult = null;
      
      // Enhanced search with multiple attempts for better recall
      // Priority 1: Check by ISSN (print or online) first
      if (issnPrint || issnOnline) {
        console.log("Searching by ISSN...");
        foundResult = searchJufoDatabase("", issnPrint, issnOnline, isbn);
        if (foundResult) {
          console.log(`✅ JUFO database ISSN match found: Level ${foundResult.level}, Norwegian Level ${foundResult.norwegianLevel !== null ? foundResult.norwegianLevel : 'N/A'}`);
        }
      }
      
      // Priority 2: Check by ISBN if no ISSN match
      if (!foundResult && isbn) {
        console.log("Searching by ISBN...");
        foundResult = searchJufoDatabase("", undefined, undefined, isbn);
        if (foundResult) {
          console.log(`✅ JUFO database ISBN match found: Level ${foundResult.level}, Norwegian Level ${foundResult.norwegianLevel !== null ? foundResult.norwegianLevel : 'N/A'}`);
        }
      }
      
      // Priority 3: Check by source name if no ISSN/ISBN match
      if (!foundResult && source) {
        console.log("Searching by source name...");
        foundResult = searchJufoDatabase(source);
        if (foundResult) {
          console.log(`✅ JUFO database source match found: Level ${foundResult.level}, Norwegian Level ${foundResult.norwegianLevel !== null ? foundResult.norwegianLevel : 'N/A'}`);
        }
      }
      
      // Process the result if found
      if (foundResult) {
        // Determine indexing status: Indexed if level is 1, 2, or 3
        const isIndexed = foundResult.level !== null && typeof foundResult.level === 'number' && foundResult.level >= 1;
        const status = isIndexed ? 'Indexed' : 'Not Indexed';
        
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
        // No match found in database - mark as Absent
        return { 
          level: "Absent", 
          norwegianLevel: null, 
          indexed: false, 
          evaluated: false, 
          checked: true, 
          status: 'Not Indexed' 
        };
      }
    }
    
    // Fall back to mock database if no imported data
    console.log("Falling back to mock database");
    const normalizedSource = source.toLowerCase().trim();
    
    // Enhanced mock database for testing
    const mockDatabase = {
      "nature": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "science": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "cell": { level: 3, norwegianLevel: 2, indexed: true, evaluated: true },
      "plos one": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "scientific reports": { level: 1, norwegianLevel: 1, indexed: true, evaluated: true },
      "journal of informetrics": { level: 2, norwegianLevel: 2, indexed: true, evaluated: true },
      "information processing & management": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international conference on information systems": { level: 2, norwegianLevel: null, indexed: true, evaluated: true },
      "predatory journal": { level: 0, norwegianLevel: null, indexed: false, evaluated: true },
      "new journal": { level: "Absent", norwegianLevel: null, indexed: false, evaluated: false },
      "management learning": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international journal of human-computer interaction": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international journal of human–computer interaction": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
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
    
    // Return mock data or not indexed response
    if (matchedKey) {
      const mockResult = mockDatabase[matchedKey as keyof typeof mockDatabase];
      // Apply the same indexing logic: Indexed if level is 1, 2, or 3
      const isIndexed = mockResult.level !== null && mockResult.level !== "Absent" && typeof mockResult.level === 'number' && mockResult.level >= 1;
      const status = isIndexed ? 'Indexed' : 'Not Indexed';
      
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
        level: "Absent", 
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
      level: "Absent", 
      norwegianLevel: null, 
      indexed: false, 
      evaluated: false, 
      checked: true, 
      status: 'Not Indexed' 
    };
  }
};
