import { Publication } from "@/types";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from 'xlsx';

/**
 * Comprehensive ISSN extraction with multiple pattern matching
 */
const extractISSN = (text: string): { print?: string, online?: string } => {
  const result: { print?: string, online?: string } = {};
  
  // Enhanced ISSN patterns - more comprehensive matching
  const printPatterns = [
    /(?:ISSN[\s]*(?:Print|print|PRINT|\(Print\)|\[Print\])[\s:]*|Print[\s]*ISSN[\s:]*|ISSN-P[\s:]*|pISSN[\s:]*|Print[\s]*ISSN[\s:]*|ISSN[\s]*\(Print\)[\s:]*)(\d{4}[\s\-]?\d{3}[\dXx])/gi,
    /Print[\s]*ISSN[\s:]*(\d{4}[\s\-]?\d{3}[\dXx])/gi,
    /ISSN[\s]*\(Print\)[\s:]*(\d{4}[\s\-]?\d{3}[\dXx])/gi,
    /pISSN[\s:]*(\d{4}[\s\-]?\d{3}[\dXx])/gi
  ];
  
  const onlinePatterns = [
    /(?:ISSN[\s]*(?:Online|online|ONLINE|Electronic|electronic|E-|\(Online\)|\[Online\])[\s:]*|Online[\s]*ISSN[\s:]*|Electronic[\s]*ISSN[\s:]*|E-ISSN[\s:]*|eISSN[\s:]*|ISSN-E[\s:]*|Electronic[\s]*ISSN[\s:]*|ISSN[\s]*\(Online\)[\s:]*)(\d{4}[\s\-]?\d{3}[\dXx])/gi,
    /Electronic[\s]*ISSN[\s:]*(\d{4}[\s\-]?\d{3}[\dXx])/gi,
    /E-ISSN[\s:]*(\d{4}[\s\-]?\d{3}[\dXx])/gi,
    /eISSN[\s:]*(\d{4}[\s\-]?\d{3}[\dXx])/gi,
    /Online[\s]*ISSN[\s:]*(\d{4}[\s\-]?\d{3}[\dXx])/gi
  ];
  
  // Check for print ISSN
  for (const pattern of printPatterns) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(text);
    if (match) {
      result.print = formatISSN(match[1]);
      console.log(`Extracted Print ISSN: ${result.print} from pattern: ${pattern}`);
      break;
    }
  }
  
  // Check for online ISSN
  for (const pattern of onlinePatterns) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(text);
    if (match) {
      result.online = formatISSN(match[1]);
      console.log(`Extracted Online ISSN: ${result.online} from pattern: ${pattern}`);
      break;
    }
  }
  
  // If no specific print/online found, look for general ISSN patterns
  if (!result.print && !result.online) {
    const generalPatterns = [
      /ISSN[\s:]*(\d{4}[\s\-]?\d{3}[\dXx])/gi,
      /(\d{4}[\s\-]?\d{3}[\dXx])/g
    ];
    
    const matches = [];
    for (const pattern of generalPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null && matches.length < 3) {
        const formatted = formatISSN(match[1]);
        if (formatted && !matches.includes(formatted)) {
          matches.push(formatted);
        }
      }
      if (matches.length > 0) break;
    }
    
    console.log(`Found general ISSN matches: ${matches.join(', ')}`);
    
    if (matches.length === 1) {
      result.print = matches[0];
    } else if (matches.length > 1) {
      result.print = matches[0];
      result.online = matches[1];
    }
  }
  
  return result;
};

/**
 * Strict ISSN formatting - ensures proper 8-digit format with dash
 */
const formatISSN = (issn: string): string => {
  if (!issn) return '';
  
  // Remove all non-alphanumeric characters except X
  const cleaned = issn.replace(/[^0-9X]/gi, '').toUpperCase();
  
  // ISSN must be exactly 8 characters
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4)}`;
  }
  
  console.warn(`Invalid ISSN length: ${cleaned} (length: ${cleaned.length})`);
  return ''; // Return empty string for invalid ISSNs
};

/**
 * Enhanced ISBN extraction with better validation
 */
const extractISBN = (text: string): string | undefined => {
  const isbnPatterns = [
    /ISBN[\s:]*(\d{3}[\s\-]?\d{1,5}[\s\-]?\d{1,7}[\s\-]?\d{1,7}[\s\-]?[\dXx])/gi,
    /ISBN[\s:]*(\d{10}|\d{13})/gi,
    /ISBN-13[\s:]*(\d{3}[\s\-]?\d{1,5}[\s\-]?\d{1,7}[\s\-]?\d{1,7}[\s\-]?[\dXx])/gi,
    /ISBN-10[\s:]*(\d{1,5}[\s\-]?\d{1,7}[\s\-]?\d{1,7}[\s\-]?[\dXx])/gi
  ];
  
  for (const pattern of isbnPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      const cleaned = match[1].replace(/[^0-9X]/gi, '').toUpperCase();
      if (cleaned.length === 10 || cleaned.length === 13) {
        console.log(`Extracted ISBN: ${match[1]} -> ${cleaned}`);
        return match[1]; // Return original format
      }
    }
  }
  return undefined;
};

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
        
        // Extract ISSN and ISBN patterns
        const issnData = extractISSN(line);
        const isbn = extractISBN(line);
        
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
          title = parts.slice(1, -1).join('.').trim();
          source = lastPart.replace(/\b(19|20)\d{2}\b/, '').trim();
        }
        
        publications.push({
          id: uuidv4(),
          authors: parts[0].trim(),
          title: title || "Unknown title",
          year,
          source: source || "Unknown source",
          issnPrint: issnData.print,
          issnOnline: issnData.online,
          isbn: isbn,
          checked: false,
          indexed: false,
        });
      }
    }
  }
  
  return publications;
};

/**
 * Extract publications from Excel or CSV files with enhanced ISSN/ISBN detection
 */
export const extractPublicationsFromSpreadsheet = (data: ArrayBuffer): Partial<Publication>[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Processing ${jsonData.length} rows from spreadsheet`);
  console.log('Sample row:', jsonData[0]);
  
  const publications: Partial<Publication>[] = [];
  
  jsonData.forEach((row: any, index: number) => {
    // Enhanced author field mapping
    const authors = row.Authors || row.authors || row.Author || row.AUTHOR || 
                   row['Author(s)'] || row.writer || row.Writers || row.Contributor || 
                   row.Contributors || row.Creator || row.creators || '';
    
    // Enhanced title field mapping
    const title = row.Title || row.title || row.Name || row.name || 
                 row['Article Title'] || row['Publication Title'] || row.Heading || 
                 row['Document Title'] || row.Subject || '';
    
    // Enhanced year field mapping
    const yearValue = row.Year || row.year || row.Date || row.date || 
                     row['Publication Year'] || row.PublicationYear || 
                     row['Pub Year'] || row['Published Year'] || new Date().getFullYear();
    const year = typeof yearValue === 'number' ? yearValue : 
                parseInt(String(yearValue).match(/\b(19|20)\d{2}\b/)?.[0] || String(new Date().getFullYear()));
    
    // Enhanced source field mapping
    const source = row.Source || row.source || row.Journal || row.journal || 
                  row['Publication'] || row['Journal/Series'] || row['Journal Name'] || 
                  row['journal_name'] || row['Publication Name'] || row.Venue || 
                  row['Publication Venue'] || row.Publisher || row['Journal Title'] || 
                  row['Container Title'] || row['Publication Title'] || '';
    
    // Comprehensive ISSN field mapping with case variations
    const issnPrintFields = [
      'ISSN Print', 'ISSN_Print', 'issnPrint', 'Print ISSN', 'printISSN', 'ISSN-P', 
      'ISSN (Print)', 'Print_ISSN', 'pISSN', 'ISSN Print:', 'Print-ISSN',
      'Print ISSN:', 'ISSN_PRINT', 'issn_print', 'ISSN-Print', 'PrintISSN'
    ];
    
    const issnOnlineFields = [
      'ISSN Online', 'ISSN_Online', 'issnOnline', 'Online ISSN', 'onlineISSN', 
      'Electronic ISSN', 'E-ISSN', 'ISSN-E', 'ISSN (Online)', 'Online_ISSN', 
      'Electronic_ISSN', 'eISSN', 'ISSN Online:', 'Electronic-ISSN',
      'Online ISSN:', 'ISSN_ONLINE', 'issn_online', 'ISSN-Online', 'OnlineISSN'
    ];
    
    let issnPrint = '';
    let issnOnline = '';
    
    // Find ISSN Print
    for (const field of issnPrintFields) {
      if (row[field]) {
        issnPrint = String(row[field]).trim();
        break;
      }
    }
    
    // Find ISSN Online
    for (const field of issnOnlineFields) {
      if (row[field]) {
        issnOnline = String(row[field]).trim();
        break;
      }
    }
    
    // Check for general ISSN field
    const generalISSN = row.ISSN || row.issn || row.ISSNL || row['ISSN-L'] || '';
    
    // Enhanced ISBN field mapping
    const isbnFields = [
      'ISBN', 'isbn', 'ISBN-13', 'ISBN-10', 'ISBN13', 'ISBN10', 
      'isbn13', 'isbn10', 'ISBN_13', 'ISBN_10'
    ];
    
    let isbn = '';
    for (const field of isbnFields) {
      if (row[field]) {
        isbn = String(row[field]).trim();
        break;
      }
    }
    
    // Extract from full text of all fields if not found in specific fields
    const allTextFields = Object.values(row).join(' ');
    const extractedISSN = extractISSN(allTextFields);
    const extractedISBN = extractISBN(allTextFields);
    
    // Use extracted values if manual fields are empty
    if (!issnPrint && extractedISSN.print) {
      issnPrint = extractedISSN.print;
      console.log(`Row ${index + 1}: Extracted Print ISSN from text: ${issnPrint}`);
    }
    if (!issnOnline && extractedISSN.online) {
      issnOnline = extractedISSN.online;
      console.log(`Row ${index + 1}: Extracted Online ISSN from text: ${issnOnline}`);
    }
    if (!isbn && extractedISBN) {
      isbn = extractedISBN;
      console.log(`Row ${index + 1}: Extracted ISBN from text: ${isbn}`);
    }
    
    // Use general ISSN if no specific print/online found
    if (!issnPrint && !issnOnline && generalISSN) {
      issnPrint = String(generalISSN).trim();
      console.log(`Row ${index + 1}: Using general ISSN as print: ${issnPrint}`);
    }
    
    // Format ISSNs to standard format
    if (issnPrint) {
      const formatted = formatISSN(issnPrint);
      if (formatted) {
        issnPrint = formatted;
      } else {
        console.warn(`Row ${index + 1}: Invalid Print ISSN format: ${issnPrint}`);
        issnPrint = ''; // Clear invalid ISSN
      }
    }
    
    if (issnOnline) {
      const formatted = formatISSN(issnOnline);
      if (formatted) {
        issnOnline = formatted;
      } else {
        console.warn(`Row ${index + 1}: Invalid Online ISSN format: ${issnOnline}`);
        issnOnline = ''; // Clear invalid ISSN
      }
    }
    
    // Only add publication if it has a title
    if (title && title.trim() !== '') {
      const publication = {
        id: uuidv4(),
        authors: typeof authors === 'string' ? authors : String(authors || ''),
        title: typeof title === 'string' ? title : String(title),
        year: year,
        source: typeof source === 'string' ? source : String(source || ''),
        issnPrint: issnPrint || undefined,
        issnOnline: issnOnline || undefined,
        isbn: isbn || undefined,
        checked: false,
        indexed: false,
      };
      
      console.log(`Row ${index + 1}: Created publication with ISSN Print: ${publication.issnPrint}, ISSN Online: ${publication.issnOnline}, ISBN: ${publication.isbn}`);
      publications.push(publication);
    } else {
      console.warn(`Row ${index + 1}: Skipping row - no title found`);
    }
  });
  
  console.log(`Successfully processed ${publications.length} publications from spreadsheet`);
  return publications;
};

/**
 * Extract publications from XML files with enhanced ISSN/ISBN detection
 */
export const extractPublicationsFromXML = (xmlString: string): Partial<Publication>[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const publications: Partial<Publication>[] = [];
  
  // Handle different possible XML structures
  let records = xmlDoc.getElementsByTagName('record');
  
  if (records.length === 0) {
    records = xmlDoc.getElementsByTagName('publication');
  }
  
  if (records.length === 0) {
    records = xmlDoc.getElementsByTagName('article');
  }
  
  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    const getElementText = (tagName: string): string => {
      const elements = record.getElementsByTagName(tagName);
      return elements.length > 0 ? elements[0].textContent || '' : '';
    };
    
    const authors = getElementText('authors') || getElementText('author') || getElementText('contributors');
    const title = getElementText('title') || getElementText('article-title');
    const yearText = getElementText('year') || getElementText('publication-date') || getElementText('pub-date');
    
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
    
    // Enhanced ISSN extraction with multiple tag variations
    const issnPrint = getElementText('issn-print') || getElementText('issn_print') || 
                     getElementText('printISSN') || getElementText('print-issn') ||
                     getElementText('ISSN-P') || getElementText('issn-p') ||
                     getElementText('pISSN');
                     
    const issnOnline = getElementText('issn-online') || getElementText('issn_online') || 
                      getElementText('onlineISSN') || getElementText('electronic-issn') ||
                      getElementText('e-issn') || getElementText('ISSN-E') || 
                      getElementText('issn-e') || getElementText('online-issn') ||
                      getElementText('eISSN');
                      
    const generalISSN = getElementText('issn') || getElementText('ISSN');
    const isbn = getElementText('isbn') || getElementText('ISBN') || 
                getElementText('isbn-13') || getElementText('isbn-10');
    
    // Extract from full text if specific fields not found
    const fullText = record.textContent || '';
    const extractedISSN = extractISSN(fullText);
    const extractedISBN = extractISBN(fullText);
    
    // Use best available ISSN values
    let finalIssnPrint = issnPrint || extractedISSN.print || (generalISSN && !issnOnline ? generalISSN : '');
    let finalIssnOnline = issnOnline || extractedISSN.online || '';
    
    // Format ISSNs
    if (finalIssnPrint) {
      finalIssnPrint = formatISSN(finalIssnPrint);
    }
    if (finalIssnOnline) {
      finalIssnOnline = formatISSN(finalIssnOnline);
    }
    
    const yearMatch = yearText.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
    
    publications.push({
      id: uuidv4(),
      authors: authors || "Unknown authors",
      title: title || "Unknown title",
      year,
      source: source || "Unknown source",
      issnPrint: finalIssnPrint || undefined,
      issnOnline: finalIssnOnline || undefined,
      isbn: (isbn || extractedISBN) || undefined,
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
