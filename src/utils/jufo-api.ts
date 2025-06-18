
import { JufoResponse } from "@/types";
import { searchJufoDatabase, hasDatabaseData } from "./jufo-data";

/**
 * Check publication quality in the JUFO portal
 * Priority: ISSN (print/online) or ISBN first, then source name
 */
export const checkJufoQuality = async (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): Promise<JufoResponse & { status: 'Indexed' | 'Not Indexed' }> => {
  try {
    console.log(`Checking JUFO quality for: ${source}, ISSN Print: ${issnPrint}, ISSN Online: ${issnOnline}, ISBN: ${isbn}`);
    
    // Check if source is empty or contains "unknown" text
    if (!source || source.trim() === "" || source.toLowerCase().includes("unknown")) {
      console.log("Unknown or empty source detected");
      return { level: null, norwegianLevel: null, indexed: false, evaluated: false, checked: true, status: 'Not Indexed' };
    }
    
    // If we have imported data, use that first
    if (hasDatabaseData()) {
      let foundResult = null;
      
      // Priority 1: Check by ISSN (print or online) first
      if (issnPrint || issnOnline) {
        foundResult = searchJufoDatabase("", issnPrint, issnOnline, isbn);
        if (foundResult) {
          console.log(`JUFO database ISSN match found: Level ${foundResult.level}, Norwegian Level ${foundResult.norwegianLevel !== null ? foundResult.norwegianLevel : 'N/A'}`);
        }
      }
      
      // Priority 2: Check by ISBN if no ISSN match
      if (!foundResult && isbn) {
        foundResult = searchJufoDatabase("", undefined, undefined, isbn);
        if (foundResult) {
          console.log(`JUFO database ISBN match found: Level ${foundResult.level}, Norwegian Level ${foundResult.norwegianLevel !== null ? foundResult.norwegianLevel : 'N/A'}`);
        }
      }
      
      // Priority 3: Check by source name if no ISSN/ISBN match
      if (!foundResult && source) {
        foundResult = searchJufoDatabase(source);
        if (foundResult) {
          console.log(`JUFO database source match found: Level ${foundResult.level}, Norwegian Level ${foundResult.norwegianLevel !== null ? foundResult.norwegianLevel : 'N/A'}`);
        }
      }
      
      // Process the result if found
      if (foundResult) {
        // Determine indexing status: Indexed if level is 1, 2, or 3
        const isIndexed = foundResult.level !== null && foundResult.level >= 1;
        const status = isIndexed ? 'Indexed' : 'Not Indexed';
        
        console.log(`Final result: Level ${foundResult.level}, Indexed: ${isIndexed}, Status: ${status}`);
        
        return {
          level: foundResult.level,
          norwegianLevel: foundResult.norwegianLevel,
          indexed: isIndexed,
          evaluated: foundResult.evaluated,
          checked: true,
          status: status
        };
      } else {
        console.log(`No match found in JUFO database for: ${source}`);
        // No match found in database - mark as Not Indexed
        return { 
          level: null, 
          norwegianLevel: null, 
          indexed: false, 
          evaluated: false, 
          checked: true, 
          status: 'Not Indexed' 
        };
      }
    }
    
    // Fall back to mock database if no imported data
    const normalizedSource = source.toLowerCase().trim();
    console.log(`Falling back to mock database for: ${normalizedSource}`);
    
    // Mock database - in real implementation this would be an API call
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
      "new journal": { level: null, norwegianLevel: null, indexed: false, evaluated: false },
      "management learning": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international journal of human-computer interaction": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
      "international journal of human–computer interaction": { level: 2, norwegianLevel: 1, indexed: true, evaluated: true },
    };
    
    // Fuzzy matching simulation with improved matching logic
    const matchedKey = Object.keys(mockDatabase).find(k => {
      // Normalize both strings for comparison: lowercase, remove dashes, hyphens, and special characters
      const normalizedKey = k.toLowerCase()
        .replace(/[\-–—]/g, '') // Replace various types of hyphens/dashes
        .replace(/[^\w\s]/g, ''); // Remove special characters
      
      const normalizedQuery = normalizedSource
        .replace(/[\-–—]/g, '')
        .replace(/[^\w\s]/g, '');
        
      return normalizedKey.includes(normalizedQuery) || normalizedQuery.includes(normalizedKey);
    });
    
    // Return mock data or not indexed response
    if (matchedKey) {
      const mockResult = mockDatabase[matchedKey as keyof typeof mockDatabase];
      // Apply the same indexing logic: Indexed if level is 1, 2, or 3
      const isIndexed = mockResult.level !== null && mockResult.level >= 1;
      const status = isIndexed ? 'Indexed' : 'Not Indexed';
      
      return { 
        ...mockResult,
        indexed: isIndexed,
        checked: true,
        status: status
      };
    } else {
      return { level: null, norwegianLevel: null, indexed: false, evaluated: false, checked: true, status: 'Not Indexed' };
    }
  } catch (error) {
    console.error("Error checking JUFO quality:", error);
    return { level: null, norwegianLevel: null, indexed: false, evaluated: false, checked: true, status: 'Not Indexed' };
  }
};
