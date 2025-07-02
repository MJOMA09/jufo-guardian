
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
 * Enhanced ISSN normalization with better flexibility
 */
const normalizeISSN = (issn: string): string => {
  if (!issn) return '';
  
  // Remove all non-alphanumeric characters except X, preserve structure
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
  return cleaned;
};

/**
 * Improved ISSN matching with multiple strategies
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
  
  // Handle cases where database might have multiple ISSNs separated by various delimiters
  const issn1Parts = issn1.split(/[,;|\s]+/).map(part => normalizeISSN(part.trim())).filter(Boolean);
  const issn2Parts = issn2.split(/[,;|\s]+/).map(part => normalizeISSN(part.trim())).filter(Boolean);
  
  // Check if any part of one ISSN matches any part of the other
  for (const part1 of issn1Parts) {
    for (const part2 of issn2Parts) {
      if (part1 === part2 && part1.length >= 7) {
        console.log(`✅ PARTIAL ISSN MATCH: ${part1} found in both ${issn1} and ${issn2}`);
        return true;
      }
    }
  }
  
  // Partial match for different lengths (medium confidence)
  if (normalized1.length >= 6 && normalized2.length >= 6) {
    // Check if one is contained in the other (for partial ISSNs)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      console.log(`✅ SUBSTRING ISSN MATCH: ${issn1} ~ ${issn2}`);
      return true;
    }
    
    // Check if the last 6 digits match (common for ISSN variants)
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
 * Enhanced ISBN normalization
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
  
  return cleaned;
};

/**
 * Improved ISBN matching
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
  
  // Handle cases where database might have multiple ISBNs
  const isbn1Parts = isbn1.split(/[,;|\s]+/).map(part => normalizeISBN(part.trim())).filter(Boolean);
  const isbn2Parts = isbn2.split(/[,;|\s]+/).map(part => normalizeISBN(part.trim())).filter(Boolean);
  
  for (const part1 of isbn1Parts) {
    for (const part2 of isbn2Parts) {
      if (part1 === part2 && part1.length >= 9) {
        console.log(`✅ PARTIAL ISBN MATCH: ${part1} found in both ${isbn1} and ${isbn2}`);
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Enhanced source name normalization with multiple strategies
 */
const normalizeSourceName = (name: string): string => {
  if (!name) return '';
  
  let normalized = name.trim().toLowerCase();
  
  // Remove common prefixes that might be added to journal names
  const prefixesToRemove = [
    'international journal of',
    'journal of',
    'proceedings of',
    'conference on',
    'international conference on',
    'european journal of',
    'american journal of',
    'the journal of',
    'annals of',
    'advances in',
    'current',
    'new',
    'modern',
    'contemporary'
  ];
  
  // Create variations without these prefixes
  const variations = [normalized];
  
  for (const prefix of prefixesToRemove) {
    if (normalized.startsWith(prefix + ' ')) {
      variations.push(normalized.substring(prefix.length + 1).trim());
    }
  }
  
  return variations[0]; // Return original for exact matching, but store variations
};

/**
 * Advanced source name matching with multiple strategies
 */
const sourceNameMatches = (query: string, dbEntry: string): { exact: boolean, similarity: number } => {
  if (!query || !dbEntry) return { exact: false, similarity: 0 };
  
  const normalizedQuery = normalizeSourceName(query);
  const normalizedDb = normalizeSourceName(dbEntry);
  
  // Exact match (100% accuracy)
  if (normalizedQuery === normalizedDb) {
    console.log(`✅ 100% EXACT SOURCE MATCH: "${query}" === "${dbEntry}"`);
    return { exact: true, similarity: 1.0 };
  }
  
  // Check variations without common prefixes
  const queryVariations = getSourceVariations(query);
  const dbVariations = getSourceVariations(dbEntry);
  
  for (const qVar of queryVariations) {
    for (const dbVar of dbVariations) {
      if (qVar === dbVar && qVar.length > 10) { // Only match substantial names
        console.log(`✅ VARIATION MATCH: "${qVar}" found in both "${query}" and "${dbEntry}"`);
        return { exact: true, similarity: 0.95 };
      }
    }
  }
  
  // Calculate similarity for logging but don't use for matching
  const similarity = calculateSimilarity(normalizedQuery, normalizedDb);
  
  console.log(`❌ SOURCE NOT EXACT MATCH: "${query}" vs "${dbEntry}" (similarity: ${similarity.toFixed(2)})`);
  return { exact: false, similarity };
};

/**
 * Get source name variations for better matching
 */
const getSourceVariations = (name: string): string[] => {
  if (!name) return [];
  
  const normalized = name.trim().toLowerCase();
  const variations = [normalized];
  
  // Remove common prefixes and suffixes
  const prefixes = ['international journal of', 'journal of', 'proceedings of', 'conference on', 'the '];
  const suffixes = [' journal', ' proceedings', ' conference', ' series'];
  
  let current = normalized;
  
  // Try removing prefixes
  for (const prefix of prefixes) {
    if (current.startsWith(prefix + ' ')) {
      const withoutPrefix = current.substring(prefix.length + 1).trim();
      if (withoutPrefix.length > 5) { // Only keep substantial names
        variations.push(withoutPrefix);
        current = withoutPrefix;
      }
    }
  }
  
  // Try removing suffixes
  for (const suffix of suffixes) {
    if (current.endsWith(suffix)) {
      const withoutSuffix = current.substring(0, current.length - suffix.length).trim();
      if (withoutSuffix.length > 5) {
        variations.push(withoutSuffix);
      }
    }
  }
  
  // Remove duplicates and return
  return [...new Set(variations)];
};

/**
 * Calculate string similarity (for logging purposes only)
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
 * Enhanced JUFO database search with improved accuracy
 */
export const searchJufoDatabase = (source?: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("No JUFO database data available for search");
    return null;
  }
  
  console.log(`=== ENHANCED JUFO SEARCH (Accuracy Focus) ===`);
  console.log(`Database entries: ${jufoDatabase.length}`);
  
  // Get current year entries first, then all entries as fallback
  const currentYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Priority search in ${currentYearEntries.length} current year entries (${latestDatabaseYear})`);
  
  // PRIORITY 1: Enhanced source name search with exact matching
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    console.log(`=== PRIORITY 1: ENHANCED SOURCE NAME SEARCH ===`);
    console.log(`Searching for source: "${source}"`);
    
    const exactSourceMatch = searchByEnhancedSourceName(currentYearEntries, source, "current year data");
    if (exactSourceMatch) {
      console.log(`🎯 EXACT SOURCE MATCH FOUND: Level ${exactSourceMatch.level}, Source: "${exactSourceMatch.name}"`);
      return exactSourceMatch;
    }
    
    // Search historical data for exact match
    console.log("Searching historical data for exact source match...");
    const historicalExactSourceMatch = searchByEnhancedSourceName(jufoDatabase, source, "all historical data");
    if (historicalExactSourceMatch) {
      console.log(`🎯 HISTORICAL EXACT SOURCE MATCH FOUND: Level ${historicalExactSourceMatch.level}, Source: "${historicalExactSourceMatch.name}"`);
      return historicalExactSourceMatch;
    }
    
    console.log(`❌ NO EXACT SOURCE MATCH FOUND for: "${source}"`);
  }
  
  // PRIORITY 2: Enhanced ISSN/ISBN search
  if (issnPrint || issnOnline || isbn) {
    console.log(`=== PRIORITY 2: ENHANCED IDENTIFIER SEARCH ===`);
    console.log(`ISSN Print: "${issnPrint || 'N/A'}"`);
    console.log(`ISSN Online: "${issnOnline || 'N/A'}"`);
    console.log(`ISBN: "${isbn || 'N/A'}"`);
    
    const identifierMatch = searchByEnhancedIdentifiers(currentYearEntries, issnPrint, issnOnline, isbn, "current year data");
    if (identifierMatch) {
      console.log(`🎯 IDENTIFIER MATCH FOUND: Level ${identifierMatch.level}, Source: "${identifierMatch.name}"`);
      return identifierMatch;
    }
    
    // Search historical data for identifier match
    console.log("Searching historical data for identifier match...");
    const historicalIdentifierMatch = searchByEnhancedIdentifiers(jufoDatabase, issnPrint, issnOnline, isbn, "all historical data");
    if (historicalIdentifierMatch) {
      console.log(`🎯 HISTORICAL IDENTIFIER MATCH FOUND: Level ${historicalIdentifierMatch.level}, Source: "${historicalIdentifierMatch.name}"`);
      return historicalIdentifierMatch;
    }
  }
  
  console.log(`❌ NO MATCHES FOUND for any search criteria`);
  return null;
};

/**
 * Enhanced source name search with better accuracy
 */
const searchByEnhancedSourceName = (dataset: JufoData[], source: string, datasetName: string): JufoData | null => {
  console.log(`--- Enhanced source name search in ${datasetName} (${dataset.length} entries) ---`);
  
  for (const entry of dataset) {
    const matchResult = sourceNameMatches(source, entry.name);
    if (matchResult.exact) {
      console.log(`✓ EXACT SOURCE NAME MATCH - Query: "${source}", Entry: "${entry.name}", Level: ${entry.level}, Similarity: ${matchResult.similarity}`);
      return entry;
    }
  }
  
  console.log(`❌ No exact source name match found in ${datasetName}`);
  return null;
};

/**
 * Enhanced identifier search with better ISSN/ISBN handling
 */
const searchByEnhancedIdentifiers = (dataset: JufoData[], issnPrint?: string, issnOnline?: string, isbn?: string, datasetName?: string): JufoData | null => {
  console.log(`--- Enhanced identifier search in ${datasetName} (${dataset.length} entries) ---`);
  
  // Collect all identifiers to search
  const identifiersToSearch = [
    { type: 'ISSN Print', value: issnPrint },
    { type: 'ISSN Online', value: issnOnline },
    { type: 'ISBN', value: isbn }
  ].filter(id => id.value);
  
  // Search each identifier
  for (const identifier of identifiersToSearch) {
    console.log(`Searching ${identifier.type}: "${identifier.value}"`);
    
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
