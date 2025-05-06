
import { JufoResponse } from "@/types";

/**
 * Check publication quality in the JUFO portal
 * In a real implementation, this would make actual API calls to JUFO portal
 * For demo, we simulate responses with mock data
 */
export const checkJufoQuality = async (source: string): Promise<JufoResponse> => {
  try {
    // Simulated API call to JUFO portal
    console.log(`Checking JUFO quality for: ${source}`);
    
    // Simple mock logic for demonstration
    const normalizedSource = source.toLowerCase().trim();
    
    // Mock database - in real implementation this would be an API call
    const mockDatabase = {
      "nature": { level: 3, norwegianLevel: 2, indexed: true },
      "science": { level: 3, norwegianLevel: 2, indexed: true },
      "cell": { level: 3, norwegianLevel: 2, indexed: true },
      "plos one": { level: 1, norwegianLevel: 1, indexed: true },
      "scientific reports": { level: 1, norwegianLevel: 1, indexed: true },
      "journal of informetrics": { level: 2, norwegianLevel: 2, indexed: true },
      "information processing & management": { level: 2, norwegianLevel: 1, indexed: true },
      "international conference on information systems": { level: 2, norwegianLevel: null, indexed: true },
      "predatory journal": { level: 0, norwegianLevel: null, indexed: true },
    };
    
    // Fuzzy matching simulation
    const matchedKey = Object.keys(mockDatabase).find(k => 
      normalizedSource.includes(k) || k.includes(normalizedSource)
    );
    
    // Return mock data or not indexed response
    return matchedKey 
      ? mockDatabase[matchedKey as keyof typeof mockDatabase]
      : { level: null, norwegianLevel: null, indexed: false };
  } catch (error) {
    console.error("Error checking JUFO quality:", error);
    return { level: null, norwegianLevel: null, indexed: false };
  }
};
