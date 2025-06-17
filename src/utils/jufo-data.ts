
import * as XLSX from 'xlsx';
import { JufoData } from "@/types";

// Store for imported JUFO data
let jufoDatabase: JufoData[] = [];
// Track the latest year available in the database
let latestDatabaseYear: number = new Date().getFullYear(); // Default to current year

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
 * Normalize ISSN format for comparison (removes hyphens and spaces)
 */
const normalizeISSN = (issn: string): string => {
  return issn.replace(/[^0-9X]/gi, '').toUpperCase();
};

/**
 * Check if two ISSNs match (handles different formatting)
 */
const issnMatches = (issn1: string, issn2: string): boolean => {
  if (!issn1 || !issn2) return false;
  const normalized1 = normalizeISSN(issn1);
  const normalized2 = normalizeISSN(issn2);
  
  // Must be exact match for ISSN
  return normalized1 === normalized2 && normalized1.length >= 7;
};

/**
 * Search for a publication in the imported JUFO database
 * Priority: ISSN/ISBN first (exact matches only), then source name
 */
export const searchJufoDatabase = (source: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("No database data available for search");
    return null;
  }
  
  console.log(`Searching with priority - ISSN Print: ${issnPrint}, ISSN Online: ${issnOnline}, ISBN: ${isbn}, Source: "${source}"`);
  
  // Filter to latest year's rankings first
  const latestYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Found ${latestYearEntries.length} entries for latest year ${latestDatabaseYear}`);
  
  // Priority 1: Check for exact ISSN matches first (most reliable)
  if (issnPrint || issnOnline) {
    console.log("Checking ISSN matches...");
    
    // Check print ISSN first
    if (issnPrint) {
      let match = latestYearEntries.find(entry => issnMatches(entry.issn, issnPrint));
      if (match) {
        console.log(`Found exact ISSN Print match: ${match.issn} for query: ${issnPrint}`);
        return match;
      }
      
      // If no match in latest year, try full database
      match = jufoDatabase.find(entry => issnMatches(entry.issn, issnPrint));
      if (match) {
        console.log(`Found exact ISSN Print match in full database: ${match.issn} for query: ${issnPrint}`);
        return match;
      }
    }
    
    // Check online ISSN
    if (issnOnline) {
      let match = latestYearEntries.find(entry => issnMatches(entry.issn, issnOnline));
      if (match) {
        console.log(`Found exact ISSN Online match: ${match.issn} for query: ${issnOnline}`);
        return match;
      }
      
      // If no match in latest year, try full database
      match = jufoDatabase.find(entry => issnMatches(entry.issn, issnOnline));
      if (match) {
        console.log(`Found exact ISSN Online match in full database: ${match.issn} for query: ${issnOnline}`);
        return match;
      }
    }
  }
  
  // Priority 2: Check for exact ISBN match
  if (isbn) {
    console.log("Checking ISBN matches...");
    const normalizedISBN = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
    
    let match = latestYearEntries.find(entry => {
      const entryISBN = entry.issn.replace(/[^0-9X]/gi, '').toUpperCase();
      return entryISBN === normalizedISBN && normalizedISBN.length >= 10;
    });
    
    if (match) {
      console.log(`Found exact ISBN match: ${match.issn} for query: ${isbn}`);
      return match;
    }
    
    // If no match in latest year, try full database
    match = jufoDatabase.find(entry => {
      const entryISBN = entry.issn.replace(/[^0-9X]/gi, '').toUpperCase();
      return entryISBN === normalizedISBN && normalizedISBN.length >= 10;
    });
    
    if (match) {
      console.log(`Found exact ISBN match in full database: ${match.issn} for query: ${isbn}`);
      return match;
    }
  }
  
  // Priority 3: Only check source name if provided and no ISSN/ISBN matches found
  if (source && source.trim() !== "") {
    const normalizedQuery = source.toLowerCase().trim();
    console.log(`No ISSN/ISBN match found, checking source: "${normalizedQuery}"`);
    
    // Try exact match first
    let match = latestYearEntries.find(entry => entry.name.toLowerCase().trim() === normalizedQuery);
    if (match) {
      console.log(`Found exact source name match: ${match.name}`);
      return match;
    }
    
    // Try normalized match (remove special characters)
    const normalizedQueryClean = normalizedQuery.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    match = latestYearEntries.find(entry => {
      const entryNameClean = entry.name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      return entryNameClean === normalizedQueryClean;
    });
    
    if (match) {
      console.log(`Found normalized source name match: ${match.name}`);
      return match;
    }
    
    // If no exact matches, try partial matching only if query is sufficiently long
    if (normalizedQuery.length > 10) {
      match = latestYearEntries.find(entry => {
        const entryName = entry.name.toLowerCase();
        return entryName.includes(normalizedQuery) || normalizedQuery.includes(entryName);
      });
      
      if (match) {
        console.log(`Found partial source name match: ${match.name}`);
        return match;
      }
    }
    
    // If no match in latest year data, try full database with exact matching only
    match = jufoDatabase.find(entry => entry.name.toLowerCase().trim() === normalizedQuery);
    if (match) {
      console.log(`Found exact source name match in full database: ${match.name}`);
      return match;
    }
  }
  
  console.log("No match found for any criteria");
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
