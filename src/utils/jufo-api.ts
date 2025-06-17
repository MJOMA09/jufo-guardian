
import { JufoResponse } from "@/types";
import { searchJufoDatabase, hasDatabaseData } from "./jufo-data";

/**
 * Check publication quality in the JUFO portal
 * First checks the imported database, falls back to mock data if not available
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
      const result = searchJufoDatabase(source, issnPrint, issnOnline, isbn);
      if (result) {
        const isIndexed = result.level !== null && result.level !== 0;
        console.log(`JUFO database match found: Level ${result.level}, Norwegian Level ${result.norwegianLevel !== null ? result.norwegianLevel : 'N/A'}`);
        return {
          level: result.level,
          norwegianLevel: result.norwegianLevel,
          indexed: isIndexed,
          evaluated: result.evaluated,
          checked: true,
          status: isIndexed ? 'Indexed' : 'Not Indexed'
        };
      } else {
        console.log(`No match found in JUFO database for: ${source}`);
      }
    }
    
    // Fall back to mock database if no imported data or no match found
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
      "predatory journal": { level: 0, norwegianLevel: null, indexed: true, evaluated: true },
      "new journal": { level: null, norwegianLevel: null, indexed: true, evaluated: false },
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
      const isIndexed = mockResult.level !== null && mockResult.level !== 0;
      return { 
        ...mockResult, 
        checked: true,
        status: isIndexed ? 'Indexed' : 'Not Indexed'
      };
    } else {
      return { level: null, norwegianLevel: null, indexed: false, evaluated: false, checked: true, status: 'Not Indexed' };
    }
  } catch (error) {
    console.error("Error checking JUFO quality:", error);
    return { level: null, norwegianLevel: null, indexed: false, evaluated: false, checked: true, status: 'Not Indexed' };
  }
};
