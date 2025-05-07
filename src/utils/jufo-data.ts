
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
        
        // Process the data - adjust field names based on JUFO Excel structure
        // This assumes specific column names - may need adjustment based on actual JUFO Excel format
        const processedData: JufoData[] = jsonData.map((row: any) => ({
          name: row.Name || row.name || row.Title || row['Journal/Series'] || '',
          issn: row.ISSN || row.issn || row.ISBN || row.isbn || '',
          level: parseInt(row.Level || row.level || row.JUFO || row.jufo || 0, 10),
          norwegianLevel: row.Norwegian || row.NorwegianLevel || null,
          publisher: row.Publisher || row.publisher || '',
          type: row.Type || row.type || 'journal'
        }));
        
        // Store the processed data
        jufoDatabase = processedData;
        
        resolve({ 
          success: true, 
          count: processedData.length 
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
  return {
    totalEntries: jufoDatabase.length,
    level0: jufoDatabase.filter(entry => entry.level === 0).length,
    level1: jufoDatabase.filter(entry => entry.level === 1).length,
    level2: jufoDatabase.filter(entry => entry.level === 2).length,
    level3: jufoDatabase.filter(entry => entry.level === 3).length,
  };
};
