
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
        
        console.log("✅ File loaded successfully");
        console.log("Sample row:", jsonData[0]);
        
        const currentYear = new Date().getFullYear();
        let maxYear = currentYear;
        
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
        
        const validData = processedData.filter(item => 
          item.name && item.name.trim() !== '' && item.name.length > 2
        );
        
        jufoDatabase = validData;
        latestDatabaseYear = maxYear;
        
        console.log(`✅ Processing complete: ${validData.length} valid entries, latest year: ${maxYear}`);
        
        resolve({ 
          success: true, 
          count: validData.length 
        });
      } catch (error) {
        console.error("❌ Error processing JUFO file:", error);
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
 * EXACT JUFO database search with 100% matching requirement
 */
export const searchJufoDatabase = (source?: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("❌ No JUFO database data available");
    return null;
  }
  
  console.log(`=== JUFO DATABASE SEARCH (100% EXACT MATCHING) ===`);
  console.log(`Database: ${jufoDatabase.length} entries`);
  
  const currentYearEntries = jufoDatabase.filter(entry => 
    entry.year === latestDatabaseYear || !entry.year
  );
  
  console.log(`Priority: ${currentYearEntries.length} current year entries (${latestDatabaseYear})`);
  
  // PRIORITY 1: 100% EXACT source name matching
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    console.log(`=== PRIORITY 1: 100% EXACT SOURCE NAME MATCHING ===`);
    console.log(`Query: "${source}"`);
    
    const exactSourceMatch = searchByExactSourceName(currentYearEntries, source, "current year");
    if (exactSourceMatch) {
      console.log(`🎯 CURRENT YEAR EXACT SOURCE MATCH: Level ${exactSourceMatch.level}`);
      return exactSourceMatch;
    }
    
    const historicalExactSourceMatch = searchByExactSourceName(jufoDatabase, source, "historical");
    if (historicalExactSourceMatch) {
      console.log(`🎯 HISTORICAL EXACT SOURCE MATCH: Level ${historicalExactSourceMatch.level}`);
      return historicalExactSourceMatch;
    }
    
    console.log(`❌ NO 100% EXACT SOURCE MATCH for: "${source}"`);
  }
  
  // PRIORITY 2: ISSN/ISBN identifier matching (only if source name didn't match 100%)
  if (issnPrint || issnOnline || isbn) {
    console.log(`=== PRIORITY 2: ISSN/ISBN IDENTIFIER MATCHING ===`);
    console.log("Source name didn't match 100%, checking identifiers...");
    
    const identifierMatch = searchByExactIdentifiers(currentYearEntries, issnPrint, issnOnline, isbn, "current year");
    if (identifierMatch) {
      console.log(`🎯 CURRENT YEAR IDENTIFIER MATCH: Level ${identifierMatch.level}`);
      return identifierMatch;
    }
    
    const historicalIdentifierMatch = searchByExactIdentifiers(jufoDatabase, issnPrint, issnOnline, isbn, "historical");
    if (historicalIdentifierMatch) {
      console.log(`🎯 HISTORICAL IDENTIFIER MATCH: Level ${historicalIdentifierMatch.level}`);
      return historicalIdentifierMatch;
    }
    
    console.log(`❌ NO IDENTIFIER MATCHES FOUND`);
  }
  
  console.log(`❌ NO MATCHES FOUND`);
  return null;
};

/**
 * Search by 100% exact source name matching only
 */
const searchByExactSourceName = (dataset: JufoData[], source: string, datasetName: string): JufoData | null => {
  console.log(`--- 100% Exact source search in ${datasetName} data (${dataset.length} entries) ---`);
  
  const normalizedQuery = source.toLowerCase().trim();
  
  for (const entry of dataset) {
    const normalizedEntry = entry.name.toLowerCase().trim();
    
    // Only 100% exact matches are allowed
    if (normalizedQuery === normalizedEntry) {
      console.log(`✅ 100% EXACT MATCH - Query: "${source}", Entry: "${entry.name}", Level: ${entry.level}`);
      return entry;
    }
  }
  
  console.log(`❌ NO 100% EXACT MATCHES in ${datasetName} data`);
  return null;
};

/**
 * Search by exact ISSN/ISBN identifiers
 */
const searchByExactIdentifiers = (dataset: JufoData[], issnPrint?: string, issnOnline?: string, isbn?: string, datasetName?: string): JufoData | null => {
  console.log(`--- Exact identifier search in ${datasetName} data (${dataset.length} entries) ---`);
  
  const identifiersToSearch = [
    { type: 'ISSN Print', value: issnPrint },
    { type: 'ISSN Online', value: issnOnline },
    { type: 'ISBN', value: isbn }
  ].filter(id => id.value);
  
  for (const identifier of identifiersToSearch) {
    console.log(`Checking ${identifier.type}: "${identifier.value}"`);
    
    const normalizedQuery = normalizeIdentifier(identifier.value!);
    
    for (const entry of dataset) {
      const normalizedEntry = normalizeIdentifier(entry.issn);
      
      // Check for exact match or exact match within multiple identifiers
      if (normalizedQuery && normalizedEntry) {
        if (normalizedQuery === normalizedEntry) {
          console.log(`✅ EXACT ${identifier.type} MATCH - Query: ${identifier.value}, Entry: ${entry.issn}, Source: "${entry.name}", Level: ${entry.level}`);
          return entry;
        }
        
        // Handle multiple identifiers separated by delimiters
        const entryParts = entry.issn.split(/[,;|\s]+/).map(part => normalizeIdentifier(part.trim())).filter(Boolean);
        if (entryParts.includes(normalizedQuery)) {
          console.log(`✅ EXACT ${identifier.type} MATCH (multi) - Query: ${identifier.value}, Entry: ${entry.issn}, Source: "${entry.name}", Level: ${entry.level}`);
          return entry;
        }
      }
    }
  }
  
  return null;
};

/**
 * Normalize identifier (ISSN/ISBN) for exact matching
 */
const normalizeIdentifier = (identifier: string): string => {
  if (!identifier) return '';
  return identifier.replace(/[^0-9X]/gi, '').toUpperCase();
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
