
import { JufoResponse } from "@/types";
import { searchJufoDatabase, hasDatabaseData } from "./jufo-data";

/**
 * Check publication quality in the JUFO portal
 * First checks the imported database, falls back to mock data if not available
 */
export const checkJufoQuality = async (source: string): Promise<JufoResponse> => {
  try {
    console.log(`Checking JUFO quality for: ${source}`);
    
    // If we have imported data, use that first
    if (hasDatabaseData()) {
      const result = searchJufoDatabase(source);
      if (result) {
        return {
          level: result.level,
          norwegianLevel: result.norwegianLevel,
          indexed: true,
          evaluated: result.evaluated
        };
      }
    }
    
    // Fall back to mock database if no imported data or no match found
    const normalizedSource = source.toLowerCase().trim();
    
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
    };
    
    // Fuzzy matching simulation
    const matchedKey = Object.keys(mockDatabase).find(k => 
      normalizedSource.includes(k) || k.includes(normalizedSource)
    );
    
    // Return mock data or not indexed response
    return matchedKey 
      ? mockDatabase[matchedKey as keyof typeof mockDatabase]
      : { level: null, norwegianLevel: null, indexed: false, evaluated: false };
  } catch (error) {
    console.error("Error checking JUFO quality:", error);
    return { level: null, norwegianLevel: null, indexed: false, evaluated: false };
  }
};
