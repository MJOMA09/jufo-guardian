
import * as XLSX from 'xlsx';
import { JufoData } from "@/types";

// Store for imported JUFO data
let jufoDatabase: JufoData[] = [];

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
        
        // Extract only the relevant metadata
        const processedData: JufoData[] = jsonData.map((row: any) => {
          // Get current year
          const currentYear = new Date().getFullYear();
          
          // Handle various field naming conventions from different JUFO export formats
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
            year: row.Year || row.year || currentYear,
            evaluated: row.Level !== undefined && row.Level !== null || 
                      row.level !== undefined && row.level !== null ||
                      (row.isScientific === 'true' || row.isScientific === true)
          };
        });
        
        // Filter out entries with empty names
        const validData = processedData.filter(item => item.name.trim() !== '');
        
        // Store the processed data
        jufoDatabase = validData;
        
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
 * Search for a publication in the imported JUFO database
 * Uses multiple strategies to find the best match
 */
export const searchJufoDatabase = (source: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("No database data available for search");
    return null;
  }
  
  const normalizedQuery = source.toLowerCase().trim();
  console.log(`Searching for: "${normalizedQuery}" in database of ${jufoDatabase.length} entries`);
  
  const currentYear = new Date().getFullYear();
  
  // Filter to current year's rankings first
  const currentYearEntries = jufoDatabase.filter(entry => 
    entry.year === currentYear || !entry.year
  );
  
  console.log(`Found ${currentYearEntries.length} entries for current year ${currentYear}`);
  
  // Try different search strategies in order of precision
  
  // Strategy 1: Exact match on name
  let match = findExactMatch(normalizedQuery, currentYearEntries);
  if (match) {
    console.log("Found exact name match:", match.name);
    return match;
  }
  
  // Strategy 2: Check for ISSN match
  match = findIssnMatch(normalizedQuery, currentYearEntries);
  if (match) {
    console.log("Found ISSN match:", match.issn);
    return match;
  }
  
  // Strategy 3: Check for normalized name match (removing special characters & punctuation)
  match = findNormalizedMatch(normalizedQuery, currentYearEntries);
  if (match) {
    console.log("Found normalized match:", match.name);
    return match;
  }
  
  // Strategy 4: Check if the publication name is contained within any database entry
  match = findContainsMatch(normalizedQuery, currentYearEntries);
  if (match) {
    console.log("Found contains match:", match.name);
    return match;
  }
  
  // Strategy 5: Check if any database entry is contained within the publication name
  match = findReversedContainsMatch(normalizedQuery, currentYearEntries);
  if (match) {
    console.log("Found reversed contains match:", match.name);
    return match;
  }
  
  // Strategy 6: Try a tokenized word match approach
  match = findTokenMatch(normalizedQuery, currentYearEntries);
  if (match) {
    console.log("Found token match:", match.name);
    return match;
  }
  
  // If no match in current year data, fall back to the full database with the same strategies
  console.log("No match in current year data, trying full database");
  
  // Strategy 1: Exact match on name
  match = findExactMatch(normalizedQuery, jufoDatabase);
  if (match) {
    console.log("Found exact name match in full database:", match.name);
    return match;
  }
  
  // Strategy 2: Check for ISSN match
  match = findIssnMatch(normalizedQuery, jufoDatabase);
  if (match) {
    console.log("Found ISSN match in full database:", match.issn);
    return match;
  }
  
  // Strategy 3: Check for normalized name match (removing special characters)
  match = findNormalizedMatch(normalizedQuery, jufoDatabase);
  if (match) {
    console.log("Found normalized match in full database:", match.name);
    return match;
  }
  
  // Strategy 4: Check if the publication name is contained within any database entry
  match = findContainsMatch(normalizedQuery, jufoDatabase);
  if (match) {
    console.log("Found contains match in full database:", match.name);
    return match;
  }
  
  // Strategy 5: Check if any database entry is contained within the publication name
  match = findReversedContainsMatch(normalizedQuery, jufoDatabase);
  if (match) {
    console.log("Found reversed contains match in full database:", match.name);
    return match;
  }
  
  // Strategy 6: Try a tokenized word match approach
  match = findTokenMatch(normalizedQuery, jufoDatabase);
  if (match) {
    console.log("Found token match in full database:", match.name);
    return match;
  }
  
  console.log("No match found for:", normalizedQuery);
  return null;
};

// Helper functions for different search strategies
function findExactMatch(query: string, entries: JufoData[]): JufoData | null {
  return entries.find(entry => entry.name.toLowerCase() === query) || null;
}

function findIssnMatch(query: string, entries: JufoData[]): JufoData | null {
  // Clean up ISSN for comparison (remove hyphens, etc)
  const cleanQuery = query.replace(/[^0-9X]/gi, '');
  return entries.find(entry => {
    const cleanIssn = entry.issn.replace(/[^0-9X]/gi, '');
    return cleanIssn && cleanQuery.includes(cleanIssn) || cleanIssn.includes(cleanQuery);
  }) || null;
}

// New function to normalize text by removing special characters and punctuation
function findNormalizedMatch(query: string, entries: JufoData[]): JufoData | null {
  // Normalize the query: lowercase, remove dashes, hyphens, and special characters
  const normalizedQuery = query
    .replace(/[\-–—]/g, '') // Replace various types of hyphens/dashes
    .replace(/[^\w\s]/g, ''); // Remove special characters
    
  return entries.find(entry => {
    const normalizedName = entry.name.toLowerCase()
      .replace(/[\-–—]/g, '')
      .replace(/[^\w\s]/g, '');
      
    return normalizedName === normalizedQuery || 
           normalizedName.includes(normalizedQuery) || 
           normalizedQuery.includes(normalizedName);
  }) || null;
}

function findContainsMatch(query: string, entries: JufoData[]): JufoData | null {
  return entries.find(entry => entry.name.toLowerCase().includes(query)) || null;
}

function findReversedContainsMatch(query: string, entries: JufoData[]): JufoData | null {
  return entries.find(entry => query.includes(entry.name.toLowerCase())) || null;
}

function findTokenMatch(query: string, entries: JufoData[]): JufoData | null {
  // Split the query into tokens and remove very common words
  const stopWords = ['the', 'of', 'and', 'a', 'an', 'in', 'on', 'for', 'to', 'with'];
  const queryTokens = query.split(/\s+/).filter(token => 
    token.length > 2 && !stopWords.includes(token)
  );
  
  // Find entries that contain most of the significant words from the query
  const matches = entries.map(entry => {
    const entryTokens = entry.name.toLowerCase().split(/\s+/);
    const matchingTokens = queryTokens.filter(token => 
      entryTokens.some(entryToken => entryToken.includes(token) || token.includes(entryToken))
    );
    return {
      entry,
      score: matchingTokens.length / Math.max(queryTokens.length, 1)
    };
  });
  
  // Sort by score and get the best match if it's good enough
  matches.sort((a, b) => b.score - a.score);
  return matches.length > 0 && matches[0].score > 0.5 ? matches[0].entry : null;
}

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
  const currentYear = new Date().getFullYear();
  const currentYearEntries = jufoDatabase.filter(entry => 
    entry.year === currentYear || !entry.year
  );
  
  return {
    totalEntries: jufoDatabase.length,
    currentYearEntries: currentYearEntries.length,
    level0: currentYearEntries.filter(entry => entry.level === 0).length,
    level1: currentYearEntries.filter(entry => entry.level === 1).length,
    level2: currentYearEntries.filter(entry => entry.level === 2).length,
    level3: currentYearEntries.filter(entry => entry.level === 3).length,
    notEvaluated: currentYearEntries.filter(entry => !entry.evaluated).length,
  };
};
