
import { Publication } from "@/types";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from 'xlsx';

/**
 * Extract publications from text content
 * Uses simplified extraction logic for text-based documents
 */
export const extractPublicationsFromText = (text: string): Partial<Publication>[] => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const publications: Partial<Publication>[] = [];
  
  // Simple extraction logic for text content
  for (const line of lines) {
    // Try to identify author patterns like "Smith, J." or "Smith et al."
    if (/[A-Z][a-z]+,\s[A-Z]\./.test(line) || /[A-Z][a-z]+\set\sal\./.test(line)) {
      const parts = line.split('.');
      if (parts.length >= 3) {
        const lastPart = parts[parts.length - 1].trim();
        // Check if the last part might be a year
        const yearMatch = lastPart.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
        
        // Attempt to identify title and source
        const titleIndex = line.indexOf('"');
        let title = "";
        let source = "";
        
        if (titleIndex > -1) {
          const endTitleIndex = line.lastIndexOf('"');
          title = line.substring(titleIndex + 1, endTitleIndex);
          source = line.substring(endTitleIndex + 1).replace(/\d{4}/, '').trim();
          if (source.startsWith(',')) source = source.substring(1).trim();
        } else {
          // Fallback if no quotes for title
          const authorParts = parts[0].split(',');
          const authors = authorParts[0].trim();
          title = parts.slice(1, -1).join('.').trim();
          source = lastPart.replace(/\b(19|20)\d{2}\b/, '').trim();
        }
        
        publications.push({
          id: uuidv4(),
          authors: parts[0].trim(),
          title: title || "Unknown title",
          year,
          source: source || "Unknown source",
          checked: false,
          indexed: false,
        });
      }
    }
  }
  
  return publications;
};

/**
 * Extract publications from Excel or CSV files
 */
export const extractPublicationsFromSpreadsheet = (data: ArrayBuffer): Partial<Publication>[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  const publications: Partial<Publication>[] = [];
  
  jsonData.forEach((row: any) => {
    // Try to map common column names for publications
    const authors = row.Authors || row.authors || row.Author || row.AUTHOR || row['Author(s)'] || '';
    const title = row.Title || row.title || row.Name || row.name || '';
    const year = row.Year || row.year || row.Date || row.date || new Date().getFullYear();
    const source = row.Source || row.source || row.Journal || row.journal || 
                  row['Publication'] || row['Journal/Series'] || '';
    
    if (title) {
      publications.push({
        id: uuidv4(),
        authors: typeof authors === 'string' ? authors : JSON.stringify(authors),
        title: typeof title === 'string' ? title : JSON.stringify(title),
        year: typeof year === 'number' ? year : parseInt(year) || new Date().getFullYear(),
        source: typeof source === 'string' ? source : JSON.stringify(source),
        checked: false,
        indexed: false,
      });
    }
  });
  
  return publications;
};

/**
 * Extract publications from XML files
 */
export const extractPublicationsFromXML = (xmlString: string): Partial<Publication>[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const publications: Partial<Publication>[] = [];
  
  // Handle different possible XML structures
  // First try records/record structure
  let records = xmlDoc.getElementsByTagName('record');
  
  // If no records found, try publications/publication structure
  if (records.length === 0) {
    records = xmlDoc.getElementsByTagName('publication');
  }
  
  // If still no records found, try articles/article structure
  if (records.length === 0) {
    records = xmlDoc.getElementsByTagName('article');
  }
  
  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    // Helper function to get element text content safely
    const getElementText = (tagName: string): string => {
      const elements = record.getElementsByTagName(tagName);
      return elements.length > 0 ? elements[0].textContent || '' : '';
    };
    
    // Try different common tag names for publication metadata
    const authors = getElementText('authors') || getElementText('author') || getElementText('contributors');
    const title = getElementText('title') || getElementText('article-title');
    const yearText = getElementText('year') || getElementText('publication-date') || getElementText('pub-date');
    
    // Extended source field lookup with additional XML tag mappings
    const source = getElementText('source') || 
                  getElementText('journal') || 
                  getElementText('journal-title') ||
                  getElementText('publish-in') ||
                  getElementText('publish_in') ||
                  getElementText('publishIn') ||
                  getElementText('full-title') ||
                  getElementText('secondary-title') ||
                  getElementText('full_title') ||
                  getElementText('fullTitle') ||
                  getElementText('secondary_title') ||
                  getElementText('secondaryTitle');
    
    // Extract year from year text using regex
    const yearMatch = yearText.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
    
    publications.push({
      id: uuidv4(),
      authors: authors || "Unknown authors",
      title: title || "Unknown title",
      year,
      source: source || "Unknown source",
      checked: false,
      indexed: false,
    });
  }
  
  return publications;
};

/**
 * Extract text from PDF, DOCX, Excel, CSV or XML files
 * Uses appropriate parser based on file type
 */
export const extractTextFromFile = async (file: File): Promise<string | ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    console.log(`Processing file: ${fileName} (${fileType})`);
    
    if (fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
        fileType === "application/vnd.ms-excel" ||
        fileName.endsWith('.xlsx') || 
        fileName.endsWith('.xls') || 
        fileName.endsWith('.csv')) {
      // Handle Excel/CSV
      reader.onload = (e) => {
        if (!e.target?.result) {
          return reject(new Error("Failed to read file"));
        }
        resolve(e.target.result);
      };
      reader.readAsArrayBuffer(file);
    } else if (fileType === "text/xml" || 
              fileType === "application/xml" || 
              fileName.endsWith('.xml')) {
      // Handle XML
      reader.onload = (e) => {
        if (!e.target?.result) {
          return reject(new Error("Failed to read file"));
        }
        resolve(e.target.result as string);
      };
      reader.readAsText(file);
    } else {
      // Handle PDF or DOCX (text-based extraction)
      // In real implementation: use pdf.js or mammoth.js
      reader.onload = (e) => {
        if (!e.target?.result) {
          return reject(new Error("Failed to read file"));
        }
        
        // In real implementation, we'd use proper PDF/DOCX parser libraries
        // For now, we'll just extract a small sample of the binary content for PDF
        if (fileType === "application/pdf" || fileName.endsWith('.pdf')) {
          const content = e.target.result as ArrayBuffer;
          const uint8Array = new Uint8Array(content);
          // Extract text representation of first 100 bytes for demo
          const textSample = Array.from(uint8Array.slice(0, 100))
            .map(byte => String.fromCharCode(byte))
            .join('');
          
          // Return a placeholder text that includes the file name
          resolve(`Sample text extracted from PDF: ${file.name}\n` +
                  `Start of binary content: ${textSample}\n` +
                  `File size: ${file.size} bytes`);
        } else {
          // For DOCX and other text formats
          // Return a placeholder that includes the file name
          resolve(`Sample text extracted from ${file.name}\n` +
                  `File type: ${file.type}\n` +
                  `File size: ${file.size} bytes`);
        }
      };
      reader.readAsArrayBuffer(file);
    }
    
    reader.onerror = () => {
      reject(new Error(`Error reading file: ${file.name}`));
    };
  });
};

/**
 * Process file and extract publications based on file type
 */
export const processFileAndExtractPublications = async (file: File): Promise<Partial<Publication>[]> => {
  console.log(`Processing file for publication extraction: ${file.name}`);
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  try {
    const content = await extractTextFromFile(file);
    
    // Handle different file types
    if (fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
        fileType === "application/vnd.ms-excel" ||
        fileName.endsWith('.xlsx') || 
        fileName.endsWith('.xls') || 
        fileName.endsWith('.csv')) {
      // Excel/CSV processing
      return extractPublicationsFromSpreadsheet(content as ArrayBuffer);
    } else if (fileType === "text/xml" || 
              fileType === "application/xml" || 
              fileName.endsWith('.xml')) {
      // XML processing
      return extractPublicationsFromXML(content as string);
    } else {
      // PDF/DOCX processing (text-based)
      return extractPublicationsFromText(content as string);
    }
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
};
