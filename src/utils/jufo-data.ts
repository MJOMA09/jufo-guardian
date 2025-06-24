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
 * Enhanced ISSN normalization - MORE FLEXIBLE for better matching
 */
const normalizeISSN = (issn: string): string => {
  if (!issn) return '';
  
  // Remove all non-alphanumeric characters except X
  const cleaned = issn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // Handle standard 8-character ISSN
  if (cleaned.length === 8) {
    return cleaned;
  }
  
  // Handle 7-character ISSNs (missing leading zero)
  if (cleaned.length === 7 && /^\d{7}[0-9X]$/i.test(cleaned)) {
    return '0' + cleaned;
  }
  
  // For shorter numbers, try padding with zeros at the beginning
  if (cleaned.length >= 4 && cleaned.length < 8 && /^\d+[0-9X]?$/i.test(cleaned)) {
    const padded = cleaned.padStart(8, '0');
    console.log(`ISSN padded: ${issn} -> ${padded}`);
    return padded;
  }
  
  console.log(`ISSN normalization: ${issn} -> ${cleaned} (length: ${cleaned.length})`);
  return cleaned; // Return what we have for partial matching
};

/**
 * FLEXIBLE ISSN matching - exact and partial matching for better recall
 */
const issnMatches = (issn1: string, issn2: string): boolean => {
  if (!issn1 || !issn2) return false;
  
  const normalized1 = normalizeISSN(issn1);
  const normalized2 = normalizeISSN(issn2);
  
  if (!normalized1 || !normalized2) return false;
  
  // Exact match (highest confidence)
  if (normalized1 === normalized2) {
    console.log(`✅ EXACT ISSN MATCH: ${issn1} = ${issn2}`);
    return true;
  }
  
  // Partial match for different lengths (medium confidence)
  if (normalized1.length >= 4 && normalized2.length >= 4) {
    // Check if one is contained in the other (for partial ISSNs)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      console.log(`✅ PARTIAL ISSN MATCH: ${issn1} ~ ${issn2}`);
      return true;
    }
    
    // Check if the last 4 digits match (common for ISSN variants)
    const suffix1 = normalized1.slice(-4);
    const suffix2 = normalized2.slice(-4);
    if (suffix1 === suffix2 && suffix1.length === 4) {
      console.log(`✅ SUFFIX ISSN MATCH: ${issn1} ~ ${issn2} (suffix: ${suffix1})`);
      return true;
    }
  }
  
  return false;
};

/**
 * Enhanced ISBN normalization - MORE FLEXIBLE for better matching
 */
const normalizeISBN = (isbn: string): string => {
  if (!isbn) return '';
  
  const cleaned = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // Accept standard ISBN lengths
  if (cleaned.length === 10 || cleaned.length === 13) {
    return cleaned;
  }
  
  // For shorter numbers, try to identify if it could be a partial ISBN
  if (cleaned.length >= 6 && cleaned.length < 13) {
    console.log(`Partial ISBN detected: ${isbn} -> ${cleaned}`);
    return cleaned;
  }
  
  console.log(`ISBN normalization: ${isbn} -> ${cleaned} (length: ${cleaned.length})`);
  return cleaned;
};

/**
 * FLEXIBLE ISBN matching - exact and partial matching for better recall
 */
const isbnMatches = (isbn1: string, isbn2: string): boolean => {
  if (!isbn1 || !isbn2) return false;
  
  const normalized1 = normalizeISBN(isbn1);
  const normalized2 = normalizeISBN(isbn2);
  
  if (!normalized1 || !normalized2) return false;
  
  // Exact match
  if (normalized1 === normalized2) {
    console.log(`✅ EXACT ISBN MATCH: ${isbn1} = ${isbn2}`);
    return true;
  }
  
  // Handle ISBN-10 to ISBN-13 conversion
  if (normalized1.length === 10 && normalized2.length === 13) {
    const isbn13from10 = '978' + normalized1.substring(0, 9);
    if (normalized2.startsWith(isbn13from10)) {
      console.log(`✅ ISBN CONVERSION MATCH: ${isbn1} -> ${isbn2}`);
      return true;
    }
  } else if (normalized1.length === 13 && normalized2.length === 10) {
    const isbn13from10 = '978' + normalized2.substring(0, 9);
    if (normalized1.startsWith(isbn13from10)) {
      console.log(`✅ ISBN CONVERSION MATCH: ${isbn2} -> ${isbn1}`);
      return true;
    }
  }
  
  // Partial matching for incomplete ISBNs
  if (normalized1.length >= 6 && normalized2.length >= 6) {
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      console.log(`✅ PARTIAL ISBN MATCH: ${isbn1} ~ ${isbn2}`);
      return true;
    }
  }
  
  return false;
};

/**
 * ENHANCED source name normalization for better matching
 */
const normalizeSourceName = (name: string): string => {
  if (!name) return '';
  
  return name.toLowerCase()
    .replace(/[^\w\s&]/g, '') // Keep alphanumeric, spaces, and ampersands
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

/**
 * ENHANCED source name matching - exact and fuzzy matching
 */
const sourceNameMatches = (name1: string, name2: string): { match: boolean, confidence: 'exact' | 'high' | 'medium' } => {
  if (!name1 || !name2) return { match: false, confidence: 'medium' };
  
  const normalized1 = normalizeSourceName(name1);
  const normalized2 = normalizeSourceName(name2);
  
  if (!normalized1 || !normalized2) return { match: false, confidence: 'medium' };
  
  // Exact match (highest confidence)
  if (normalized1 === normalized2) {
    console.log(`✅ EXACT SOURCE MATCH: "${name1}" = "${name2}"`);
    return { match: true, confidence: 'exact' };
  }
  
  // High confidence fuzzy matching
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    console.log(`✅ CONTAINS SOURCE MATCH: "${name1}" ~ "${name2}"`);
    return { match: true, confidence: 'high' };
  }
  
  // Medium confidence - check for significant word overlap
  const words1 = normalized1.split(' ').filter(w => w.length > 2);
  const words2 = normalized2.split(' ').filter(w => w.length > 2);
  
  if (words1.length > 0 && words2.length > 0) {
    const commonWords = words1.filter(w => words2.includes(w));
    const overlapRatio = commonWords.length / Math.max(words1.length, words2.length);
    
    if (overlapRatio >= 0.6) { // 60% word overlap
      console.log(`✅ WORD OVERLAP SOURCE MATCH: "${name1}" ~ "${name2}" (${Math.round(overlapRatio * 100)}% overlap)`);
      return { match: true, confidence: 'medium' };
    }
  }
  
  return { match: false, confidence: 'medium' };
};

/**
 * PRIORITIZED JUFO database search
 * Priority 1: Source name only
 * Priority 2: ISSN/ISBN only (when source search fails)
 */
export const searchJufoDatabase = (source?: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("No JUFO database data available for search");
    return null;
  }
  
  console.log(`=== PRIORITIZED JUFO SEARCH ===`);
  console.log(`Database entries: ${jufoDatabase.length}`);
  
  // Get current year entries first, then all entries as fallback
  const currentYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Priority search in ${currentYearEntries.length} current year entries (${latestDatabaseYear})`);
  
  // PRIORITY 1: SOURCE NAME SEARCH ONLY
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    console.log(`=== PRIORITY 1: SOURCE NAME SEARCH ===`);
    console.log(`Searching for source: "${source}"`);
    
    const sourceMatch = searchBySourceName(currentYearEntries, source, "current year data");
    if (sourceMatch) {
      console.log(`🎯 SOURCE MATCH FOUND: Level ${sourceMatch.level}, Source: "${sourceMatch.name}"`);
      return sourceMatch;
    }
    
    // If no match in current year, search all historical data
    console.log("Searching historical data for source match...");
    const historicalSourceMatch = searchBySourceName(jufoDatabase, source, "all historical data");
    if (historicalSourceMatch) {
      console.log(`🎯 HISTORICAL SOURCE MATCH FOUND: Level ${historicalSourceMatch.level}, Source: "${historicalSourceMatch.name}"`);
      return historicalSourceMatch;
    }
    
    console.log(`❌ NO SOURCE MATCH FOUND for: "${source}"`);
    return null; // Return null for source-only search if no match
  }
  
  // PRIORITY 2: ISSN/ISBN SEARCH ONLY (when no source provided or source search failed)
  if (issnPrint || issnOnline || isbn) {
    console.log(`=== PRIORITY 2: ISSN/ISBN SEARCH ===`);
    console.log(`ISSN Print: "${issnPrint || 'N/A'}"`);
    console.log(`ISSN Online: "${issnOnline || 'N/A'}"`);
    console.log(`ISBN: "${isbn || 'N/A'}"`);
    
    const identifierMatch = searchByIdentifiers(currentYearEntries, issnPrint, issnOnline, isbn, "current year data");
    if (identifierMatch) {
      console.log(`🎯 IDENTIFIER MATCH FOUND: Level ${identifierMatch.level}, Source: "${identifierMatch.name}"`);
      return identifierMatch;
    }
    
    // If no match in current year, search all historical data
    console.log("Searching historical data for identifier match...");
    const historicalIdentifierMatch = searchByIdentifiers(jufoDatabase, issnPrint, issnOnline, isbn, "all historical data");
    if (historicalIdentifierMatch) {
      console.log(`🎯 HISTORICAL IDENTIFIER MATCH FOUND: Level ${historicalIdentifierMatch.level}, Source: "${historicalIdentifierMatch.name}"`);
      return historicalIdentifierMatch;
    }
    
    console.log(`❌ NO IDENTIFIER MATCH FOUND`);
  }
  
  console.log(`❌ NO MATCHES FOUND for any search criteria`);
  console.log(`=== END PRIORITIZED SEARCH ===`);
  return null;
};

/**
 * Search by source name only
 */
const searchBySourceName = (dataset: JufoData[], source: string, datasetName: string): JufoData | null => {
  console.log(`--- Searching source names in ${datasetName} (${dataset.length} entries) ---`);
  
  for (const entry of dataset) {
    const matchResult = sourceNameMatches(source, entry.name);
    if (matchResult.match) {
      console.log(`✓ SOURCE NAME MATCH (${matchResult.confidence}) - Query: "${source}", Entry: "${entry.name}", Level: ${entry.level}`);
      return entry;
    }
  }
  
  return null;
};

/**
 * Search by ISSN/ISBN identifiers only
 */
const searchByIdentifiers = (dataset: JufoData[], issnPrint?: string, issnOnline?: string, isbn?: string, datasetName?: string): JufoData | null => {
  console.log(`--- Searching identifiers in ${datasetName} (${dataset.length} entries) ---`);
  
  // ISSN MATCHING (highest priority)
  if (issnPrint) {
    console.log(`Searching Print ISSN "${issnPrint}"`);
    for (const entry of dataset) {
      if (issnMatches(issnPrint, entry.issn)) {
        console.log(`✓ PRINT ISSN MATCH - Query: ${issnPrint}, Entry: ${entry.issn}, Source: "${entry.name}", Level: ${entry.level}`);
        return entry;
      }
    }
  }
  
  if (issnOnline) {
    console.log(`Searching Online ISSN "${issnOnline}"`);
    for (const entry of dataset) {
      if (issnMatches(issnOnline, entry.issn)) {
        console.log(`✓ ONLINE ISSN MATCH - Query: ${issnOnline}, Entry: ${entry.issn}, Source: "${entry.name}", Level: ${entry.level}`);
        return entry;
      }
    }
  }
  
  // ISBN MATCHING
  if (isbn) {
    console.log(`Searching ISBN "${isbn}"`);
    for (const entry of dataset) {
      if (isbnMatches(isbn, entry.issn)) {
        console.log(`✓ ISBN MATCH - Query: ${isbn}, Entry: ${entry.issn}, Source: "${entry.name}", Level: ${entry.level}`);
        return entry;
      }
    }
  }
  
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
