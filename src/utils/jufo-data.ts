
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
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log("Excel data loaded, sample:", jsonData[0]);
        
        // Extract only the relevant metadata
        const processedData: JufoData[] = jsonData.map((row: any) => {
          // Get current year
          const currentYear = new Date().getFullYear();
          
          return {
            name: row.Name || row.name || row.Title || row['Journal/Series'] || '',
            issn: row.ISSN || row.issn || row.ISBN || row.isbn || '',
            level: parseInt(row.Level || row.level || row.JUFO || row.jufo || 0, 10),
            norwegianLevel: row.Norwegian || row.NorwegianLevel || null,
            publisher: row.Publisher || row.publisher || '',
            type: row.Type || row.type || 'journal',
            year: row.Year || row.year || currentYear,
            evaluated: row.Level !== undefined && row.Level !== null
          };
        });
        
        // Filter out entries with empty names
        const validData = processedData.filter(item => item.name.trim() !== '');
        
        // Store the processed data
        jufoDatabase = validData;
        
        console.log(`Processed ${validData.length} valid entries from Excel file`);
        
        resolve({ 
          success: true, 
          count: validData.length 
        });
      } catch (error) {
        console.error("Error processing JUFO Excel file:", error);
        reject({ 
          success: false, 
          error: "Failed to process the Excel file. Please ensure it's a valid JUFO export." 
        });
      }
    };
    
    reader.onerror = () => {
      reject({ 
        success: false, 
        error: "Error reading the file" 
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Search for a publication in the imported JUFO database
 */
export const searchJufoDatabase = (source: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    return null;
  }
  
  const normalizedQuery = source.toLowerCase().trim();
  const currentYear = new Date().getFullYear();
  
  // Filter to current year's rankings first
  const currentYearEntries = jufoDatabase.filter(entry => 
    entry.year === currentYear || !entry.year
  );
  
  // Try current year data first
  if (currentYearEntries.length > 0) {
    // Try exact match first
    const exactMatch = currentYearEntries.find(entry => 
      entry.name.toLowerCase() === normalizedQuery ||
      entry.issn.toLowerCase() === normalizedQuery
    );
    
    if (exactMatch) {
      return exactMatch;
    }
    
    // Try fuzzy match
    const fuzzyMatch = currentYearEntries.find(entry => 
      entry.name.toLowerCase().includes(normalizedQuery) ||
      normalizedQuery.includes(entry.name.toLowerCase())
    );
    
    if (fuzzyMatch) {
      return fuzzyMatch;
    }
  }
  
  // Fall back to full database if no current year match
  
  // Try exact match first
  const exactMatch = jufoDatabase.find(entry => 
    entry.name.toLowerCase() === normalizedQuery ||
    entry.issn.toLowerCase() === normalizedQuery
  );
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // Try fuzzy match
  const fuzzyMatch = jufoDatabase.find(entry => 
    entry.name.toLowerCase().includes(normalizedQuery) ||
    normalizedQuery.includes(entry.name.toLowerCase())
  );
  
  return fuzzyMatch || null;
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
