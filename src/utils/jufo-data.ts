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
 * Advanced ISSN normalization - STRICT format validation
 */
const normalizeISSN = (issn: string): string => {
  if (!issn) return '';
  
  // Remove all non-alphanumeric characters except X
  const cleaned = issn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // Standard ISSN must be exactly 8 characters (7 digits + check digit which can be X)
  if (cleaned.length === 8) {
    return cleaned;
  }
  
  // Handle 7-character ISSNs (missing leading zero) ONLY if valid pattern
  if (cleaned.length === 7 && /^\d{7}[0-9X]$/i.test(cleaned)) {
    return '0' + cleaned;
  }
  
  console.warn(`Invalid ISSN format rejected: ${issn} -> ${cleaned} (length: ${cleaned.length})`);
  return ''; // Return empty string for invalid ISSNs
};

/**
 * STRICT ISSN matching - exact match only for high accuracy
 */
const issnMatches = (issn1: string, issn2: string): boolean => {
  if (!issn1 || !issn2) return false;
  
  const normalized1 = normalizeISSN(issn1);
  const normalized2 = normalizeISSN(issn2);
  
  // Only exact matches for highest accuracy
  if (normalized1 && normalized2 && normalized1.length === 8 && normalized2.length === 8) {
    const match = normalized1 === normalized2;
    if (match) {
      console.log(`✅ STRICT ISSN MATCH: ${issn1} = ${issn2} (normalized: ${normalized1})`);
    }
    return match;
  }
  
  return false;
};

/**
 * Advanced ISBN normalization - STRICT format validation
 */
const normalizeISBN = (isbn: string): string => {
  if (!isbn) return '';
  
  const cleaned = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // Only accept valid ISBN lengths
  if (cleaned.length === 10 || cleaned.length === 13) {
    return cleaned;
  }
  
  console.warn(`Invalid ISBN format rejected: ${isbn} -> ${cleaned} (length: ${cleaned.length})`);
  return '';
};

/**
 * STRICT ISBN matching - exact match only for high accuracy
 */
const isbnMatches = (isbn1: string, isbn2: string): boolean => {
  if (!isbn1 || !isbn2) return false;
  
  const normalized1 = normalizeISBN(isbn1);
  const normalized2 = normalizeISBN(isbn2);
  
  // Only exact matches for highest accuracy
  if (normalized1 && normalized2 && 
      (normalized1.length === 10 || normalized1.length === 13) &&
      (normalized2.length === 10 || normalized2.length === 13)) {
    
    // Direct comparison
    if (normalized1 === normalized2) {
      console.log(`✅ STRICT ISBN MATCH: ${isbn1} = ${isbn2} (normalized: ${normalized1})`);
      return true;
    }
    
    // Handle ISBN-10 to ISBN-13 conversion (978 prefix)
    if (normalized1.length === 10 && normalized2.length === 13) {
      const isbn13from10 = '978' + normalized1.substring(0, 9);
      if (normalized2.startsWith(isbn13from10)) {
        console.log(`✅ STRICT ISBN CONVERSION MATCH: ${isbn1} -> ${isbn2}`);
        return true;
      }
    } else if (normalized1.length === 13 && normalized2.length === 10) {
      const isbn13from10 = '978' + normalized2.substring(0, 9);
      if (normalized1.startsWith(isbn13from10)) {
        console.log(`✅ STRICT ISBN CONVERSION MATCH: ${isbn2} -> ${isbn1}`);
        return true;
      }
    }
  }
  
  return false;
};

/**
 * STRICT source name normalization for exact matching
 */
const normalizeSourceName = (name: string): string => {
  if (!name) return '';
  
  return name.toLowerCase()
    .replace(/[^\w\s&]/g, '') // Keep alphanumeric, spaces, and ampersands only
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

/**
 * STRICT source name matching for highest accuracy
 */
const sourceNameMatches = (name1: string, name2: string): boolean => {
  if (!name1 || !name2) return false;
  
  const normalized1 = normalizeSourceName(name1);
  const normalized2 = normalizeSourceName(name2);
  
  // Exact match only
  if (normalized1 === normalized2 && normalized1.length > 3) {
    console.log(`✅ STRICT SOURCE NAME MATCH: "${name1}" = "${name2}"`);
    return true;
  }
  
  return false;
};

/**
 * HIGH-ACCURACY JUFO database search with STRICT matching only
 */
export const searchJufoDatabase = (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("No JUFO database data available for search");
    return null;
  }
  
  console.log(`=== HIGH-ACCURACY JUFO SEARCH ===`);
  console.log(`Input - Source: "${source}"`);
  console.log(`Input - ISSN Print: "${issnPrint}"`);
  console.log(`Input - ISSN Online: "${issnOnline}"`);
  console.log(`Input - ISBN: "${isbn}"`);
  console.log(`Database entries: ${jufoDatabase.length}`);
  
  // Get current year entries first, then all entries as fallback
  const currentYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Priority search in ${currentYearEntries.length} current year entries (${latestDatabaseYear})`);
  
  // PHASE 1: STRICT ISSN MATCHING (highest priority)
  if (issnPrint) {
    console.log(`--- Phase 1A: STRICT Print ISSN Search "${issnPrint}" ---`);
    
    // Search current year first
    let match = currentYearEntries.find(entry => {
      const entryISSN = entry.issn;
      const matches = issnMatches(issnPrint, entryISSN);
      if (matches) {
        console.log(`✓ STRICT PRINT ISSN MATCH (current year) - Query: ${issnPrint}, Entry: ${entryISSN}, Source: "${entry.name}", Level: ${entry.level}`);
        return true;
      }
      return false;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Print ISSN strict match (current year) - Level: ${match.level}`);
      return match;
    }
    
    // Search all years as fallback
    match = jufoDatabase.find(entry => {
      const entryISSN = entry.issn;
      const matches = issnMatches(issnPrint, entryISSN);
      if (matches) {
        console.log(`✓ STRICT PRINT ISSN MATCH (historical) - Query: ${issnPrint}, Entry: ${entryISSN}, Source: "${entry.name}", Level: ${entry.level}`);
        return true;
      }
      return false;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Print ISSN strict match (historical) - Level: ${match.level}`);
      return match;
    }
  }
  
  if (issnOnline) {
    console.log(`--- Phase 1B: STRICT Online ISSN Search "${issnOnline}" ---`);
    
    // Search current year first
    let match = currentYearEntries.find(entry => {
      const entryISSN = entry.issn;
      const matches = issnMatches(issnOnline, entryISSN);
      if (matches) {
        console.log(`✓ STRICT ONLINE ISSN MATCH (current year) - Query: ${issnOnline}, Entry: ${entryISSN}, Source: "${entry.name}", Level: ${entry.level}`);
        return true;
      }
      return false;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Online ISSN strict match (current year) - Level: ${match.level}`);
      return match;
    }
    
    // Search all years as fallback
    match = jufoDatabase.find(entry => {
      const entryISSN = entry.issn;
      const matches = issnMatches(issnOnline, entryISSN);
      if (matches) {
        console.log(`✓ STRICT ONLINE ISSN MATCH (historical) - Query: ${issnOnline}, Entry: ${entryISSN}, Source: "${entry.name}", Level: ${entry.level}`);
        return true;
      }
      return false;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Online ISSN strict match (historical) - Level: ${match.level}`);
      return match;
    }
  }
  
  // PHASE 2: STRICT ISBN MATCHING
  if (isbn) {
    console.log(`--- Phase 2: STRICT ISBN Search "${isbn}" ---`);
    
    // Search current year first
    let match = currentYearEntries.find(entry => {
      const entryIdentifier = entry.issn; // Some databases store ISBN in ISSN field
      const matches = isbnMatches(isbn, entryIdentifier);
      if (matches) {
        console.log(`✓ STRICT ISBN MATCH (current year) - Query: ${isbn}, Entry: ${entryIdentifier}, Source: "${entry.name}", Level: ${entry.level}`);
        return true;
      }
      return false;
    });
    
    if (match) {
      console.log(`🎯 FOUND: ISBN strict match (current year) - Level: ${match.level}`);
      return match;
    }
    
    // Search all years as fallback
    match = jufoDatabase.find(entry => {
      const entryIdentifier = entry.issn;
      const matches = isbnMatches(isbn, entryIdentifier);
      if (matches) {
        console.log(`✓ STRICT ISBN MATCH (historical) - Query: ${isbn}, Entry: ${entryIdentifier}, Source: "${entry.name}", Level: ${entry.level}`);
        return true;
      }
      return false;
    });
    
    if (match) {
      console.log(`🎯 FOUND: ISBN strict match (historical) - Level: ${match.level}`);
      return match;
    }
  }
  
  // PHASE 3: STRICT SOURCE NAME MATCHING
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    console.log(`--- Phase 3: STRICT Source Name Search "${source}" ---`);
    
    // Search current year first
    let match = currentYearEntries.find(entry => {
      const matches = sourceNameMatches(source, entry.name);
      if (matches) {
        console.log(`✓ STRICT SOURCE NAME MATCH (current year) - Query: "${source}", Entry: "${entry.name}", Level: ${entry.level}`);
        return true;
      }
      return false;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Source name strict match (current year) - Level: ${match.level}`);
      return match;
    }
    
    // Search historical data
    match = jufoDatabase.find(entry => {
      const matches = sourceNameMatches(source, entry.name);
      if (matches) {
        console.log(`✓ STRICT SOURCE NAME MATCH (historical) - Query: "${source}", Entry: "${entry.name}", Level: ${entry.level}`);
        return true;
      }
      return false;
    });
    
    if (match) {
      console.log(`🎯 FOUND: Source name strict match (historical) - Level: ${match.level}`);
      return match;
    }
  }
  
  console.log(`❌ NO STRICT MATCHES FOUND for any search criteria`);
  console.log(`=== END HIGH-ACCURACY SEARCH ===`);
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
