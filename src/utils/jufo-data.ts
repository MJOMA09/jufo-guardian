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
 * Normalize ISSN format for comparison (removes hyphens and spaces, ensures proper format)
 */
const normalizeISSN = (issn: string): string => {
  if (!issn) return '';
  const cleaned = issn.replace(/[^0-9X]/gi, '').toUpperCase();
  // ISSN should be exactly 8 characters
  if (cleaned.length === 8) {
    return cleaned;
  }
  return '';
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
 * Check if two ISSNs match (handles different formatting)
 */
const issnMatches = (issn1: string, issn2: string): boolean => {
  if (!issn1 || !issn2) return false;
  const normalized1 = normalizeISSN(issn1);
  const normalized2 = normalizeISSN(issn2);
  
  // Must be exact match for ISSN and have correct length
  return normalized1 === normalized2 && normalized1.length === 8;
};

/**
 * Normalize ISBN for comparison
 */
const normalizeISBN = (isbn: string): string => {
  if (!isbn) return '';
  const cleaned = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
  // ISBN can be 10 or 13 digits
  if (cleaned.length === 10 || cleaned.length === 13) {
    return cleaned;
  }
  return '';
};

/**
 * Check if two ISBNs match
 */
const isbnMatches = (isbn1: string, isbn2: string): boolean => {
  if (!isbn1 || !isbn2) return false;
  const normalized1 = normalizeISBN(isbn1);
  const normalized2 = normalizeISBN(isbn2);
  
  return normalized1 === normalized2 && (normalized1.length === 10 || normalized1.length === 13);
};

/**
 * Normalize source name for comparison
 */
const normalizeSourceName = (name: string): string => {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

/**
 * Enhanced search for a publication in the imported JUFO database
 * Strict priority: ISSN/ISBN exact matches first, then source name exact matches
 */
export const searchJufoDatabase = (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("No database data available for search");
    return null;
  }
  
  console.log(`Enhanced JUFO search - ISSN Print: ${issnPrint}, ISSN Online: ${issnOnline}, ISBN: ${isbn}, Source: "${source}"`);
  
  // Filter to latest year's rankings first
  const latestYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Searching in ${latestYearEntries.length} entries for latest year ${latestDatabaseYear}`);
  
  // Priority 1: Exact ISSN matches (most reliable)
  if (issnPrint || issnOnline) {
    console.log("Phase 1: Checking exact ISSN matches...");
    
    // Check print ISSN in latest year data
    if (issnPrint) {
      const normalizedQuery = normalizeISSN(issnPrint);
      if (normalizedQuery) {
        let match = latestYearEntries.find(entry => {
          const entryISSN = normalizeISSN(entry.issn);
          return entryISSN === normalizedQuery;
        });
        
        if (match) {
          console.log(`✓ Found exact ISSN Print match in latest year: ${formatISSNDisplay(match.issn)} (Level: ${match.level})`);
          return match;
        }
        
        // Search in full database if not found in latest year
        match = jufoDatabase.find(entry => {
          const entryISSN = normalizeISSN(entry.issn);
          return entryISSN === normalizedQuery;
        });
        
        if (match) {
          console.log(`✓ Found exact ISSN Print match in full database: ${formatISSNDisplay(match.issn)} (Level: ${match.level})`);
          return match;
        }
      }
    }
    
    // Check online ISSN in latest year data
    if (issnOnline) {
      const normalizedQuery = normalizeISSN(issnOnline);
      if (normalizedQuery) {
        let match = latestYearEntries.find(entry => {
          const entryISSN = normalizeISSN(entry.issn);
          return entryISSN === normalizedQuery;
        });
        
        if (match) {
          console.log(`✓ Found exact ISSN Online match in latest year: ${formatISSNDisplay(match.issn)} (Level: ${match.level})`);
          return match;
        }
        
        // Search in full database if not found in latest year
        match = jufoDatabase.find(entry => {
          const entryISSN = normalizeISSN(entry.issn);
          return entryISSN === normalizedQuery;
        });
        
        if (match) {
          console.log(`✓ Found exact ISSN Online match in full database: ${formatISSNDisplay(match.issn)} (Level: ${match.level})`);
          return match;
        }
      }
    }
  }
  
  // Priority 2: Exact ISBN matches
  if (isbn) {
    console.log("Phase 2: Checking exact ISBN matches...");
    const normalizedISBN = normalizeISBN(isbn);
    
    if (normalizedISBN) {
      let match = latestYearEntries.find(entry => {
        const entryISBN = normalizeISBN(entry.issn); // Some databases store ISBN in ISSN field
        return entryISBN === normalizedISBN;
      });
      
      if (match) {
        console.log(`✓ Found exact ISBN match in latest year: ${match.issn} (Level: ${match.level})`);
        return match;
      }
      
      // Search in full database
      match = jufoDatabase.find(entry => {
        const entryISBN = normalizeISBN(entry.issn);
        return entryISBN === normalizedISBN;
      });
      
      if (match) {
        console.log(`✓ Found exact ISBN match in full database: ${match.issn} (Level: ${match.level})`);
        return match;
      }
    }
  }
  
  // Priority 3: Exact source name matches only
  if (source && source.trim() !== "") {
    console.log("Phase 3: Checking exact source name matches...");
    const normalizedQuery = normalizeSourceName(source);
    
    if (normalizedQuery.length > 3) { // Minimum length for meaningful search
      // Exact match in latest year
      let match = latestYearEntries.find(entry => {
        const entryName = normalizeSourceName(entry.name);
        return entryName === normalizedQuery;
      });
      
      if (match) {
        console.log(`✓ Found exact source name match in latest year: "${match.name}" (Level: ${match.level})`);
        return match;
      }
      
      // Exact match in full database
      match = jufoDatabase.find(entry => {
        const entryName = normalizeSourceName(entry.name);
        return entryName === normalizedQuery;
      });
      
      if (match) {
        console.log(`✓ Found exact source name match in full database: "${match.name}" (Level: ${match.level})`);
        return match;
      }
      
      // Only try partial matching for longer, more specific source names
      if (normalizedQuery.length > 15) {
        console.log("Phase 4: Checking partial source name matches for long titles...");
        match = latestYearEntries.find(entry => {
          const entryName = normalizeSourceName(entry.name);
          return entryName.includes(normalizedQuery) || normalizedQuery.includes(entryName);
        });
        
        if (match) {
          console.log(`✓ Found partial source name match: "${match.name}" (Level: ${match.level})`);
          return match;
        }
      }
    }
  }
  
  console.log("✗ No match found for any criteria");
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
