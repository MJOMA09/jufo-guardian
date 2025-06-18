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
 * Strict ISSN normalization for exact matching
 */
const normalizeISSN = (issn: string): string => {
  if (!issn) return '';
  
  // Remove all non-alphanumeric characters except X, convert to uppercase
  const cleaned = issn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // ISSN must be exactly 8 characters
  if (cleaned.length === 8) {
    return cleaned;
  }
  
  return ''; // Return empty for invalid format
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
 * Strict ISSN matching - both must be valid 8-digit ISSNs
 */
const issnMatches = (issn1: string, issn2: string): boolean => {
  if (!issn1 || !issn2) return false;
  
  const normalized1 = normalizeISSN(issn1);
  const normalized2 = normalizeISSN(issn2);
  
  // Both must be valid 8-character ISSNs and match exactly
  return normalized1 === normalized2 && normalized1.length === 8;
};

/**
 * Strict ISBN normalization
 */
const normalizeISBN = (isbn: string): string => {
  if (!isbn) return '';
  
  const cleaned = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // ISBN must be 10 or 13 digits
  if (cleaned.length === 10 || cleaned.length === 13) {
    return cleaned;
  }
  
  return '';
};

/**
 * Strict ISBN matching
 */
const isbnMatches = (isbn1: string, isbn2: string): boolean => {
  if (!isbn1 || !isbn2) return false;
  
  const normalized1 = normalizeISBN(isbn1);
  const normalized2 = normalizeISBN(isbn2);
  
  return normalized1 === normalized2 && (normalized1.length === 10 || normalized1.length === 13);
};

/**
 * Enhanced source name normalization for better matching
 */
const normalizeSourceName = (name: string): string => {
  if (!name) return '';
  
  return name.toLowerCase()
    .replace(/[^\w\s&]/g, '') // Keep ampersands, remove other special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(the|a|an|and|of|in|for|with|on|at|by|from|to)\b/g, '') // Remove common words
    .trim();
};

/**
 * Rigorous JUFO database search with strict ISSN/ISBN matching priority
 */
export const searchJufoDatabase = (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("No JUFO database data available for search");
    return null;
  }
  
  console.log(`=== RIGOROUS JUFO SEARCH ===`);
  console.log(`Input - Source: "${source}"`);
  console.log(`Input - ISSN Print: "${issnPrint}"`);
  console.log(`Input - ISSN Online: "${issnOnline}"`);
  console.log(`Input - ISBN: "${isbn}"`);
  
  // Filter to latest year's rankings first
  const latestYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Searching in ${latestYearEntries.length} entries for year ${latestDatabaseYear}`);
  
  // PRIORITY 1: EXACT ISSN MATCHING (HIGHEST PRIORITY)
  if (issnPrint) {
    console.log(`--- Phase 1A: Checking Print ISSN "${issnPrint}" ---`);
    const normalizedQuery = normalizeISSN(issnPrint);
    
    if (normalizedQuery) {
      // Search latest year first
      let match = latestYearEntries.find(entry => {
        const entryISSN = normalizeISSN(entry.issn);
        const matches = entryISSN === normalizedQuery;
        if (matches) {
          console.log(`✓ EXACT MATCH FOUND in latest year - Query: ${normalizedQuery}, Entry: ${entryISSN}, Source: "${entry.name}"`);
        }
        return matches;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Print ISSN exact match - ${formatISSNDisplay(match.issn)} -> Level: ${match.level}`);
        return match;
      }
      
      // Search full database
      match = jufoDatabase.find(entry => {
        const entryISSN = normalizeISSN(entry.issn);
        const matches = entryISSN === normalizedQuery;
        if (matches) {
          console.log(`✓ EXACT MATCH FOUND in full database - Query: ${normalizedQuery}, Entry: ${entryISSN}, Source: "${entry.name}"`);
        }
        return matches;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Print ISSN exact match (historical) - ${formatISSNDisplay(match.issn)} -> Level: ${match.level}`);
        return match;
      }
    } else {
      console.log(`❌ Invalid Print ISSN format: "${issnPrint}"`);
    }
  }
  
  if (issnOnline) {
    console.log(`--- Phase 1B: Checking Online ISSN "${issnOnline}" ---`);
    const normalizedQuery = normalizeISSN(issnOnline);
    
    if (normalizedQuery) {
      // Search latest year first
      let match = latestYearEntries.find(entry => {
        const entryISSN = normalizeISSN(entry.issn);
        const matches = entryISSN === normalizedQuery;
        if (matches) {
          console.log(`✓ EXACT MATCH FOUND in latest year - Query: ${normalizedQuery}, Entry: ${entryISSN}, Source: "${entry.name}"`);
        }
        return matches;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Online ISSN exact match - ${formatISSNDisplay(match.issn)} -> Level: ${match.level}`);
        return match;
      }
      
      // Search full database
      match = jufoDatabase.find(entry => {
        const entryISSN = normalizeISSN(entry.issn);
        const matches = entryISSN === normalizedQuery;
        if (matches) {
          console.log(`✓ EXACT MATCH FOUND in full database - Query: ${normalizedQuery}, Entry: ${entryISSN}, Source: "${entry.name}"`);
        }
        return matches;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Online ISSN exact match (historical) - ${formatISSNDisplay(match.issn)} -> Level: ${match.level}`);
        return match;
      }
    } else {
      console.log(`❌ Invalid Online ISSN format: "${issnOnline}"`);
    }
  }
  
  // PRIORITY 2: EXACT ISBN MATCHING
  if (isbn) {
    console.log(`--- Phase 2: Checking ISBN "${isbn}" ---`);
    const normalizedISBN = normalizeISBN(isbn);
    
    if (normalizedISBN) {
      // Search latest year first
      let match = latestYearEntries.find(entry => {
        const entryISBN = normalizeISBN(entry.issn); // Some databases store ISBN in ISSN field
        const matches = entryISBN === normalizedISBN;
        if (matches) {
          console.log(`✓ EXACT ISBN MATCH FOUND in latest year - Query: ${normalizedISBN}, Entry: ${entryISBN}, Source: "${entry.name}"`);
        }
        return matches;
      });
      
      if (match) {
        console.log(`🎯 FOUND: ISBN exact match - ${match.issn} -> Level: ${match.level}`);
        return match;
      }
      
      // Search full database
      match = jufoDatabase.find(entry => {
        const entryISBN = normalizeISBN(entry.issn);
        const matches = entryISBN === normalizedISBN;
        if (matches) {
          console.log(`✓ EXACT ISBN MATCH FOUND in full database - Query: ${normalizedISBN}, Entry: ${entryISBN}, Source: "${entry.name}"`);
        }
        return matches;
      });
      
      if (match) {
        console.log(`🎯 FOUND: ISBN exact match (historical) - ${match.issn} -> Level: ${match.level}`);
        return match;
      }
    } else {
      console.log(`❌ Invalid ISBN format: "${isbn}"`);
    }
  }
  
  // PRIORITY 3: SOURCE NAME MATCHING (ONLY AS FALLBACK)
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    console.log(`--- Phase 3: Checking Source Name "${source}" ---`);
    const normalizedQuery = normalizeSourceName(source);
    
    if (normalizedQuery.length > 5) { // Minimum length for meaningful search
      // Exact match in latest year
      let match = latestYearEntries.find(entry => {
        const entryName = normalizeSourceName(entry.name);
        const matches = entryName === normalizedQuery;
        if (matches) {
          console.log(`✓ EXACT SOURCE NAME MATCH in latest year - Query: "${normalizedQuery}", Entry: "${entryName}"`);
        }
        return matches;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Source name exact match - "${match.name}" -> Level: ${match.level}`);
        return match;
      }
      
      // Exact match in full database
      match = jufoDatabase.find(entry => {
        const entryName = normalizeSourceName(entry.name);
        const matches = entryName === normalizedQuery;
        if (matches) {
          console.log(`✓ EXACT SOURCE NAME MATCH in full database - Query: "${normalizedQuery}", Entry: "${entryName}"`);
        }
        return matches;
      });
      
      if (match) {
        console.log(`🎯 FOUND: Source name exact match (historical) - "${match.name}" -> Level: ${match.level}`);
        return match;
      }
      
      console.log(`❌ No exact source name matches found for "${normalizedQuery}"`);
    } else {
      console.log(`❌ Source name too short for reliable matching: "${normalizedQuery}"`);
    }
  }
  
  console.log(`❌ NO MATCHES FOUND for any criteria`);
  console.log(`=== END SEARCH ===`);
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
