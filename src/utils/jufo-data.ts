
import * as XLSX from 'xlsx';
import { JufoData } from "@/types";

// Store for imported JUFO data
let jufoDatabase: JufoData[] = [];
// Track the latest year available in the database
let latestDatabaseYear: number = new Date().getFullYear();

/**
 * Process and import JUFO data from an Excel file
 */
export const importJufoExcel = (file: File): Promise<{ success: boolean, count: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let jsonData;
        
        // Handle different file formats (Excel or CSV)
        if (file.name.endsWith('.csv')) {
          const csvData = e.target?.result as string;
          // Parse CSV data
          const workbook = XLSX.read(csvData, { type: 'string' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        } else {
          // Handle Excel files (.xlsx, .xls)
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }
        
        console.log("Data loaded, first row sample:", jsonData[0]);
        
        // Get current year
        const currentYear = new Date().getFullYear();
        
        // Determine latest year in data
        let maxYear = currentYear;
        
        // Extract only the relevant metadata
        const processedData: JufoData[] = jsonData.map((row: any) => {
          // Handle various field naming conventions from different JUFO export formats
          const year = parseInt(row.Year || row.year || currentYear, 10);
          
          // Track max year
          if (year > maxYear) {
            maxYear = year;
          }
          
          return {
            name: row.Name || row.name || row.Title || row['Journal/Series'] || row.Jufo_ID && row['__EMPTY'] || row['Journal_name'] || '',
            issn: row.ISSN || row.issn || row.ISBN || row.isbn || row.ISSNL || row.ISSN1 || 
                  row['Print ISSN'] || row['Online ISSN'] || '',
            level: parseInt(row.Level || row.level || row.JUFO || row.jufo || row['JUFO Level'] || 0, 10),
            norwegianLevel: row.Norwegian || row.NorwegianLevel || row['Norwegian Level'] ||
                          (row.indicators && typeof row.indicators === 'string' && 
                           row.indicators.includes('level_norway') ? 
                           parseInt(row.indicators.match(/"level_norway":(\d+)/)?.[1] || '0', 10) : null),
            publisher: row.Publisher || row.publisher || '',
            type: row.Type || row.type || row.Type_en || 'journal',
            year: year,
            evaluated: row.Level !== undefined && row.Level !== null || 
                      row.level !== undefined && row.level !== null ||
                      (row.isScientific === 'true' || row.isScientific === true)
          };
        });
        
        // Filter out entries with empty names
        const validData = processedData.filter(item => item.name.trim() !== '');
        
        // Store the processed data
        jufoDatabase = validData;
        
        // Update the latest year
        latestDatabaseYear = maxYear;
        console.log(`Latest year in database: ${latestDatabaseYear}`);
        
        console.log(`Processed ${validData.length} valid entries from file`);
        
        resolve({ 
          success: true, 
          count: validData.length 
        });
      } catch (error) {
        console.error("Error processing JUFO file:", error);
        reject({ 
          success: false, 
          error: "Failed to process the file. Please ensure it's a valid JUFO export." 
        });
      }
    };
    
    reader.onerror = () => {
      reject({ 
        success: false, 
        error: "Error reading the file" 
      });
    };
    
    // Read the file based on its type
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

/**
 * Get the latest year available in the database
 */
export const getLatestDatabaseYear = (): number => {
  return latestDatabaseYear;
};

/**
 * Flexible ISSN normalization - more permissive for better recall
 */
const normalizeISSN = (issn: string): string => {
  if (!issn) return '';
  
  // Remove all non-alphanumeric characters except X, convert to uppercase
  const cleaned = issn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // Accept 7-8 characters (some databases may have slight variations)
  if (cleaned.length >= 7 && cleaned.length <= 8) {
    // Pad to 8 characters if needed (with leading zero)
    return cleaned.padStart(8, '0');
  }
  
  return ''; // Return empty for clearly invalid format
};

/**
 * Format ISSN to standard display format (XXXX-XXXX)
 */
const formatISSNDisplay = (issn: string): string => {
  const normalized = normalizeISSN(issn);
  if (normalized.length === 8) {
    return `${normalized.substring(0, 4)}-${normalized.substring(4)}`;
  }
  return issn;
};

/**
 * Flexible ISSN matching - multiple attempts for better recall
 */
const issnMatches = (issn1: string, issn2: string): boolean => {
  if (!issn1 || !issn2) return false;
  
  const normalized1 = normalizeISSN(issn1);
  const normalized2 = normalizeISSN(issn2);
  
  if (normalized1 === normalized2 && normalized1.length >= 7) {
    return true;
  }
  
  // Try partial matching for cases where one ISSN might be truncated
  if (normalized1.length >= 7 && normalized2.length >= 7) {
    const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
    const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
    return longer.startsWith(shorter) || longer.endsWith(shorter);
  }
  
  return false;
};

/**
 * Flexible ISBN normalization
 */
const normalizeISBN = (isbn: string): string => {
  if (!isbn) return '';
  
  const cleaned = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // Accept 10 or 13 digits, or close variants
  if (cleaned.length >= 9 && cleaned.length <= 13) {
    return cleaned;
  }
  
  return '';
};

/**
 * Flexible ISBN matching
 */
const isbnMatches = (isbn1: string, isbn2: string): boolean => {
  if (!isbn1 || isbn2) return false;
  
  const normalized1 = normalizeISBN(isbn1);
  const normalized2 = normalizeISBN(isbn2);
  
  if (normalized1 === normalized2 && normalized1.length >= 9) {
    return true;
  }
  
  // Handle ISBN-10 to ISBN-13 conversion patterns
  if ((normalized1.length === 10 && normalized2.length === 13) || 
      (normalized1.length === 13 && normalized2.length === 10)) {
    const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
    const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
    return longer.includes(shorter);
  }
  
  return false;
};

/**
 * Improved source name normalization for better matching
 */
const normalizeSourceName = (name: string): string => {
  if (!name) return '';
  
  return name.toLowerCase()
    .replace(/[^\w\s&]/g, '') // Keep alphanumeric, spaces, and ampersands
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(the|a|an|and|of|in|for|with|on|at|by|from|to)\b/g, '') // Remove common words
    .replace(/\s+/g, ' ') // Clean up extra spaces
    .trim();
};

/**
 * Enhanced JUFO database search with improved matching logic
 */
export const searchJufoDatabase = (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("No JUFO database data available for search");
    return null;
  }
  
  console.log(`=== ENHANCED JUFO SEARCH ===`);
  console.log(`Input - Source: "${source}"`);
  console.log(`Input - ISSN Print: "${issnPrint}"`);
  console.log(`Input - ISSN Online: "${issnOnline}"`);
  console.log(`Input - ISBN: "${isbn}"`);
  console.log(`Database entries: ${jufoDatabase.length}`);
  
  // Filter to latest year's rankings first, then full database as fallback
  const latestYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Searching in ${latestYearEntries.length} entries for year ${latestDatabaseYear}`);
  
  // PRIORITY 1: ISSN MATCHING with enhanced flexibility
  if (issnPrint) {
    console.log(`--- Phase 1A: Enhanced Print ISSN "${issnPrint}" ---`);
    
    // Search latest year first
    let match = latestYearEntries.find(entry => {
      const entryISSN = entry.issn;
      const matches = issnMatches(issnPrint, entryISSN);
      if (matches) {
        console.log(`✓ PRINT ISSN MATCH FOUND in latest year - Query: ${issnPrint}, Entry: ${entryISSN}, Source: "${entry.name}"`);
      }
      return matches;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Print ISSN match - ${formatISSNDisplay(match.issn)} -> Level: ${match.level}`);
      return match;
    }
    
    // Search full database
    match = jufoDatabase.find(entry => {
      const entryISSN = entry.issn;
      const matches = issnMatches(issnPrint, entryISSN);
      if (matches) {
        console.log(`✓ PRINT ISSN MATCH FOUND in full database - Query: ${issnPrint}, Entry: ${entryISSN}, Source: "${entry.name}"`);
      }
      return matches;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Print ISSN match (historical) - ${formatISSNDisplay(match.issn)} -> Level: ${match.level}`);
      return match;
    }
  }
  
  if (issnOnline) {
    console.log(`--- Phase 1B: Enhanced Online ISSN "${issnOnline}" ---`);
    
    // Search latest year first
    let match = latestYearEntries.find(entry => {
      const entryISSN = entry.issn;
      const matches = issnMatches(issnOnline, entryISSN);
      if (matches) {
        console.log(`✓ ONLINE ISSN MATCH FOUND in latest year - Query: ${issnOnline}, Entry: ${entryISSN}, Source: "${entry.name}"`);
      }
      return matches;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Online ISSN match - ${formatISSNDisplay(match.issn)} -> Level: ${match.level}`);
      return match;
    }
    
    // Search full database
    match = jufoDatabase.find(entry => {
      const entryISSN = entry.issn;
      const matches = issnMatches(issnOnline, entryISSN);
      if (matches) {
        console.log(`✓ ONLINE ISSN MATCH FOUND in full database - Query: ${issnOnline}, Entry: ${entryISSN}, Source: "${entry.name}"`);
      }
      return matches;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Online ISSN match (historical) - ${formatISSNDisplay(match.issn)} -> Level: ${match.level}`);
      return match;
    }
  }
  
  // PRIORITY 2: ENHANCED ISBN MATCHING
  if (isbn) {
    console.log(`--- Phase 2: Enhanced ISBN "${isbn}" ---`);
    
    // Search latest year first
    let match = latestYearEntries.find(entry => {
      const entryIdentifier = entry.issn; // Some databases store ISBN in ISSN field
      const matches = isbnMatches(isbn, entryIdentifier);
      if (matches) {
        console.log(`✓ ISBN MATCH FOUND in latest year - Query: ${isbn}, Entry: ${entryIdentifier}, Source: "${entry.name}"`);
      }
      return matches;
    });
    
    if (match) {
      console.log(`🎯 FOUND: ISBN match - ${match.issn} -> Level: ${match.level}`);
      return match;
    }
    
    // Search full database
    match = jufoDatabase.find(entry => {
      const entryIdentifier = entry.issn;
      const matches = isbnMatches(isbn, entryIdentifier);
      if (matches) {
        console.log(`✓ ISBN MATCH FOUND in full database - Query: ${isbn}, Entry: ${entryIdentifier}, Source: "${entry.name}"`);
      }
      return matches;
    });
    
    if (match) {
      console.log(`🎯 FOUND: ISBN match (historical) - ${match.issn} -> Level: ${match.level}`);
      return match;
    }
  }
  
  // PRIORITY 3: ENHANCED SOURCE NAME MATCHING
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    console.log(`--- Phase 3: Enhanced Source Name "${source}" ---`);
    const normalizedQuery = normalizeSourceName(source);
    
    if (normalizedQuery.length > 3) { // Lower minimum length for better recall
      // Exact match in latest year
      let match = latestYearEntries.find(entry => {
        const entryName = normalizeSourceName(entry.name);
        const exactMatch = entryName === normalizedQuery;
        if (exactMatch) {
          console.log(`✓ EXACT SOURCE NAME MATCH in latest year - Query: "${normalizedQuery}", Entry: "${entryName}"`);
        }
        return exactMatch;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Source name exact match - "${match.name}" -> Level: ${match.level}`);
        return match;
      }
      
      // Partial match in latest year (for better recall)
      match = latestYearEntries.find(entry => {
        const entryName = normalizeSourceName(entry.name);
        const partialMatch = entryName.includes(normalizedQuery) || normalizedQuery.includes(entryName);
        if (partialMatch && entryName.length > 3 && normalizedQuery.length > 3) {
          console.log(`✓ PARTIAL SOURCE NAME MATCH in latest year - Query: "${normalizedQuery}", Entry: "${entryName}"`);
          return true;
        }
        return false;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Source name partial match - "${match.name}" -> Level: ${match.level}`);
        return match;
      }
      
      // Exact match in full database
      match = jufoDatabase.find(entry => {
        const entryName = normalizeSourceName(entry.name);
        const exactMatch = entryName === normalizedQuery;
        if (exactMatch) {
          console.log(`✓ EXACT SOURCE NAME MATCH in full database - Query: "${normalizedQuery}", Entry: "${entryName}"`);
        }
        return exactMatch;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Source name exact match (historical) - "${match.name}" -> Level: ${match.level}`);
        return match;
      }
      
      // Partial match in full database (for better recall)
      match = jufoDatabase.find(entry => {
        const entryName = normalizeSourceName(entry.name);
        const partialMatch = entryName.includes(normalizedQuery) || normalizedQuery.includes(entryName);
        if (partialMatch && entryName.length > 3 && normalizedQuery.length > 3) {
          console.log(`✓ PARTIAL SOURCE NAME MATCH in full database - Query: "${normalizedQuery}", Entry: "${entryName}"`);
          return true;
        }
        return false;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Source name partial match (historical) - "${match.name}" -> Level: ${match.level}`);
        return match;
      }
      
      console.log(`❌ No source name matches found for "${normalizedQuery}"`);
    } else {
      console.log(`❌ Source name too short for reliable matching: "${normalizedQuery}"`);
    }
  }
  
  console.log(`❌ NO MATCHES FOUND for any criteria`);
  console.log(`=== END ENHANCED SEARCH ===`);
  return null;
};

/**
 * Check if database is populated
 */
export const hasDatabaseData = (): boolean => {
  return jufoDatabase.length > 0;
};

/**
 * Get database stats
 */
export const getDatabaseStats = () => {
  const latestYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  return {
    totalEntries: jufoDatabase.length,
    currentYearEntries: latestYearEntries.length,
    latestYear: latestDatabaseYear,
    level0: latestYearEntries.filter(entry => entry.level === 0).length,
    level1: latestYearEntries.filter(entry => entry.level === 1).length,
    level2: latestYearEntries.filter(entry => entry.level === 2).length,
    level3: latestYearEntries.filter(entry => entry.level === 3).length,
    notEvaluated: latestYearEntries.filter(entry => !entry.evaluated).length,
  };
};
