import * as XLSX from 'xlsx';
import { JufoData } from "@/types";

// Store for imported JUFO data
let jufoDatabase: JufoData[] = [];
// Track the latest year available in the database
let latestDatabaseYear: number = new Date().getFullYear();

/**
 * Process and import JUFO data from an Excel file
 * ENHANCED FOR MAXIMUM RELIABILITY
 */
export const importJufoExcel = (file: File): Promise<{ success: boolean, count: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let jsonData;
        
        // Handle different file formats with high reliability
        if (file.name.endsWith('.csv')) {
          const csvData = e.target?.result as string;
          const workbook = XLSX.read(csvData, { type: 'string' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        } else {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }
        
        console.log("✅ RELIABLE DATA PROCESSING: File loaded successfully");
        console.log("Sample row:", jsonData[0]);
        
        const currentYear = new Date().getFullYear();
        let maxYear = currentYear;
        
        // ENHANCED DATA PROCESSING for maximum reliability
        const processedData: JufoData[] = jsonData.map((row: any) => {
          const year = parseInt(row.Year || row.year || currentYear, 10);
          if (year > maxYear) maxYear = year;
          
          return {
            name: (row.Name || row.name || row.Title || row['Journal/Series'] || 
                   row.Jufo_ID && row['__EMPTY'] || row['Journal_name'] || '').toString().trim(),
            issn: (row.ISSN || row.issn || row.ISBN || row.isbn || row.ISSNL || 
                   row.ISSN1 || row['Print ISSN'] || row['Online ISSN'] || '').toString().trim(),
            level: parseInt(row.Level || row.level || row.JUFO || row.jufo || row['JUFO Level'] || 0, 10),
            norwegianLevel: row.Norwegian || row.NorwegianLevel || row['Norwegian Level'] ||
                          (row.indicators && typeof row.indicators === 'string' && 
                           row.indicators.includes('level_norway') ? 
                           parseInt(row.indicators.match(/"level_norway":(\d+)/)?.[1] || '0', 10) : null),
            publisher: (row.Publisher || row.publisher || '').toString().trim(),
            type: (row.Type || row.type || row.Type_en || 'journal').toString().toLowerCase(),
            year: year,
            evaluated: row.Level !== undefined && row.Level !== null || 
                      row.level !== undefined && row.level !== null ||
                      (row.isScientific === 'true' || row.isScientific === true)
          };
        });
        
        // Filter valid entries with high reliability
        const validData = processedData.filter(item => 
          item.name && item.name.trim() !== '' && item.name.length > 2
        );
        
        jufoDatabase = validData;
        latestDatabaseYear = maxYear;
        
        console.log(`✅ RELIABLE PROCESSING COMPLETE: ${validData.length} valid entries, latest year: ${maxYear}`);
        
        resolve({ 
          success: true, 
          count: validData.length 
        });
      } catch (error) {
        console.error("❌ CRITICAL ERROR processing JUFO file:", error);
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
 * ENHANCED ISSN normalization with maximum reliability
 */
const normalizeISSN = (issn: string): string => {
  if (!issn) return '';
  
  const cleaned = issn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  if (cleaned.length === 8) {
    return cleaned;
  }
  
  if (cleaned.length === 7 && /^\d{7}[0-9X]$/i.test(cleaned)) {
    return '0' + cleaned;
  }
  
  if (cleaned.length >= 4 && cleaned.length < 8 && /^\d+[0-9X]?$/i.test(cleaned)) {
    return cleaned.padStart(8, '0');
  }
  
  return cleaned;
};

/**
 * ENHANCED ISSN matching with maximum reliability
 */
const issnMatches = (issn1: string, issn2: string): boolean => {
  if (!issn1 || !issn2) return false;
  
  const normalized1 = normalizeISSN(issn1);
  const normalized2 = normalizeISSN(issn2);
  
  if (!normalized1 || !normalized2) return false;
  
  // Exact match (highest confidence)
  if (normalized1 === normalized2) {
    console.log(`✅ EXACT ISSN MATCH: ${issn1} === ${issn2}`);
    return true;
  }
  
  // Handle multiple ISSNs separated by delimiters
  const issn1Parts = issn1.split(/[,;|\s]+/).map(part => normalizeISSN(part.trim())).filter(Boolean);
  const issn2Parts = issn2.split(/[,;|\s]+/).map(part => normalizeISSN(part.trim())).filter(Boolean);
  
  for (const part1 of issn1Parts) {
    for (const part2 of issn2Parts) {
      if (part1 === part2 && part1.length >= 7) {
        console.log(`✅ PARTIAL ISSN MATCH: ${part1} in both ${issn1} and ${issn2}`);
        return true;
      }
    }
  }
  
  // Substring matching for high confidence
  if (normalized1.length >= 6 && normalized2.length >= 6) {
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      console.log(`✅ SUBSTRING ISSN MATCH: ${issn1} ~ ${issn2}`);
      return true;
    }
    
    const suffix1 = normalized1.slice(-6);
    const suffix2 = normalized2.slice(-6);
    if (suffix1 === suffix2 && suffix1.length === 6) {
      console.log(`✅ SUFFIX ISSN MATCH: ${issn1} ~ ${issn2} (suffix: ${suffix1})`);
      return true;
    }
  }
  
  return false;
};

/**
 * ENHANCED ISBN normalization
 */
const normalizeISBN = (isbn: string): string => {
  if (!isbn) return '';
  
  const cleaned = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  if (cleaned.length === 10 || cleaned.length === 13) {
    return cleaned;
  }
  
  if (cleaned.length >= 6 && cleaned.length < 13) {
    return cleaned;
  }
  
  return cleaned;
};

/**
 * ENHANCED ISBN matching
 */
const isbnMatches = (isbn1: string, isbn2: string): boolean => {
  if (!isbn1 || !isbn2) return false;
  
  const normalized1 = normalizeISBN(isbn1);
  const normalized2 = normalizeISBN(isbn2);
  
  if (!normalized1 || !normalized2) return false;
  
  if (normalized1 === normalized2) {
    console.log(`✅ EXACT ISBN MATCH: ${isbn1} === ${isbn2}`);
    return true;
  }
  
  // ISBN-10 to ISBN-13 conversion
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
  
  // Multiple ISBN handling
  const isbn1Parts = isbn1.split(/[,;|\s]+/).map(part => normalizeISBN(part.trim())).filter(Boolean);
  const isbn2Parts = isbn2.split(/[,;|\s]+/).map(part => normalizeISBN(part.trim())).filter(Boolean);
  
  for (const part1 of isbn1Parts) {
    for (const part2 of isbn2Parts) {
      if (part1 === part2 && part1.length >= 9) {
        console.log(`✅ PARTIAL ISBN MATCH: ${part1} in both ${isbn1} and ${isbn2}`);
        return true;
      }
    }
  }
  
  return false;
};

/**
 * ENHANCED source name normalization
 */
const normalizeSourceName = (name: string): string => {
  if (!name) return '';
  return name.trim().toLowerCase();
};

/**
 * ENHANCED source name matching with maximum reliability
 */
const sourceNameMatches = (query: string, dbEntry: string): { exact: boolean, similarity: number } => {
  if (!query || !dbEntry) return { exact: false, similarity: 0 };
  
  const normalizedQuery = normalizeSourceName(query);
  const normalizedDb = normalizeSourceName(dbEntry);
  
  // Exact match (100% confidence)
  if (normalizedQuery === normalizedDb) {
    console.log(`✅ 100% EXACT SOURCE MATCH: "${query}" === "${dbEntry}"`);
    return { exact: true, similarity: 1.0 };
  }
  
  // Check variations without common prefixes
  const queryVariations = getSourceVariations(query);
  const dbVariations = getSourceVariations(dbEntry);
  
  for (const qVar of queryVariations) {
    for (const dbVar of dbVariations) {
      if (qVar === dbVar && qVar.length > 8) {
        console.log(`✅ VARIATION MATCH: "${qVar}" in both "${query}" and "${dbEntry}"`);
        return { exact: true, similarity: 0.95 };
      }
    }
  }
  
  const similarity = calculateSimilarity(normalizedQuery, normalizedDb);
  return { exact: false, similarity };
};

/**
 * Get source name variations for better matching
 */
const getSourceVariations = (name: string): string[] => {
  if (!name) return [];
  
  const normalized = name.trim().toLowerCase();
  const variations = [normalized];
  
  const prefixes = ['international journal of', 'journal of', 'proceedings of', 'conference on', 'the '];
  const suffixes = [' journal', ' proceedings', ' conference', ' series'];
  
  let current = normalized;
  
  for (const prefix of prefixes) {
    if (current.startsWith(prefix + ' ')) {
      const withoutPrefix = current.substring(prefix.length + 1).trim();
      if (withoutPrefix.length > 5) {
        variations.push(withoutPrefix);
        current = withoutPrefix;
      }
    }
  }
  
  for (const suffix of suffixes) {
    if (current.endsWith(suffix)) {
      const withoutSuffix = current.substring(0, current.length - suffix.length).trim();
      if (withoutSuffix.length > 5) {
        variations.push(withoutSuffix);
      }
    }
  }
  
  return [...new Set(variations)];
};

/**
 * Calculate string similarity
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

/**
 * Calculate Levenshtein distance
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

/**
 * ENHANCED JUFO database search with maximum reliability
 */
export const searchJufoDatabase = (source?: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("❌ No JUFO database data available");
    return null;
  }
  
  console.log(`=== ENHANCED JUFO SEARCH (MAXIMUM RELIABILITY) ===`);
  console.log(`Database: ${jufoDatabase.length} entries`);
  
  const currentYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Priority: ${currentYearEntries.length} current year entries (${latestDatabaseYear})`);
  
  // PRIORITY 1: Enhanced source name search
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    console.log(`=== PRIORITY 1: SOURCE NAME SEARCH ===`);
    console.log(`Query: "${source}"`);
    
    const exactSourceMatch = searchByEnhancedSourceName(currentYearEntries, source, "current year");
    if (exactSourceMatch) {
      console.log(`🎯 CURRENT YEAR SOURCE MATCH: Level ${exactSourceMatch.level}`);
      return exactSourceMatch;
    }
    
    const historicalExactSourceMatch = searchByEnhancedSourceName(jufoDatabase, source, "historical");
    if (historicalExactSourceMatch) {
      console.log(`🎯 HISTORICAL SOURCE MATCH: Level ${historicalExactSourceMatch.level}`);
      return historicalExactSourceMatch;
    }
  }
  
  // PRIORITY 2: Enhanced identifier search
  if (issnPrint || issnOnline || isbn) {
    console.log(`=== PRIORITY 2: IDENTIFIER SEARCH ===`);
    
    const identifierMatch = searchByEnhancedIdentifiers(currentYearEntries, issnPrint, issnOnline, isbn, "current year");
    if (identifierMatch) {
      console.log(`🎯 CURRENT YEAR IDENTIFIER MATCH: Level ${identifierMatch.level}`);
      return identifierMatch;
    }
    
    const historicalIdentifierMatch = searchByEnhancedIdentifiers(jufoDatabase, issnPrint, issnOnline, isbn, "historical");
    if (historicalIdentifierMatch) {
      console.log(`🎯 HISTORICAL IDENTIFIER MATCH: Level ${historicalIdentifierMatch.level}`);
      return historicalIdentifierMatch;
    }
  }
  
  console.log(`❌ NO MATCHES FOUND`);
  return null;
};

/**
 * Enhanced source name search
 */
const searchByEnhancedSourceName = (dataset: JufoData[], source: string, datasetName: string): JufoData | null => {
  console.log(`--- Source search in ${datasetName} data (${dataset.length} entries) ---`);
  
  for (const entry of dataset) {
    const matchResult = sourceNameMatches(source, entry.name);
    if (matchResult.exact) {
      console.log(`✓ EXACT MATCH - Query: "${source}", Entry: "${entry.name}", Level: ${entry.level}`);
      return entry;
    }
  }
  
  return null;
};

/**
 * Enhanced identifier search
 */
const searchByEnhancedIdentifiers = (dataset: JufoData[], issnPrint?: string, issnOnline?: string, isbn?: string, datasetName?: string): JufoData | null => {
  console.log(`--- Identifier search in ${datasetName} data (${dataset.length} entries) ---`);
  
  const identifiersToSearch = [
    { type: 'ISSN Print', value: issnPrint },
    { type: 'ISSN Online', value: issnOnline },
    { type: 'ISBN', value: isbn }
  ].filter(id => id.value);
  
  for (const identifier of identifiersToSearch) {
    console.log(`Checking ${identifier.type}: "${identifier.value}"`);
    
    for (const entry of dataset) {
      let matches = false;
      
      if (identifier.type.includes('ISSN') && identifier.value) {
        matches = issnMatches(identifier.value, entry.issn);
      } else if (identifier.type === 'ISBN' && identifier.value) {
        matches = isbnMatches(identifier.value, entry.issn);
      }
      
      if (matches) {
        console.log(`✓ ${identifier.type} MATCH - Query: ${identifier.value}, Entry: ${entry.issn}, Source: "${entry.name}", Level: ${entry.level}`);
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
