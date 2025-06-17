import { Publication } from "@/types";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from 'xlsx';

/**
 * Extract and normalize ISSN from text (handles various formats)
 */
const extractISSN = (text: string): { print?: string, online?: string } => {
  const result: { print?: string, online?: string } = {};
  
  // Comprehensive ISSN patterns with better matching
  const printPatterns = [
    /(?:ISSN[\s]*(?:Print|print|PRINT|\(Print\)|\[Print\])[\s:]*|Print[\s]*ISSN[\s:]*|ISSN-P[\s:]*|pISSN[\s:]*)(\d{4}-?\d{3}[\dXx])/gi,
    /Print[\s]*ISSN[\s:]*(\d{4}-?\d{3}[\dXx])/gi,
    /ISSN[\s]*\(Print\)[\s:]*(\d{4}-?\d{3}[\dXx])/gi
  ];
  
  const onlinePatterns = [
    /(?:ISSN[\s]*(?:Online|online|ONLINE|Electronic|electronic|E-|\(Online\)|\[Online\])[\s:]*|Online[\s]*ISSN[\s:]*|Electronic[\s]*ISSN[\s:]*|E-ISSN[\s:]*|eISSN[\s:]*|ISSN-E[\s:]*)(\d{4}-?\d{3}[\dXx])/gi,
    /Electronic[\s]*ISSN[\s:]*(\d{4}-?\d{3}[\dXx])/gi,
    /E-ISSN[\s:]*(\d{4}-?\d{3}[\dXx])/gi
  ];
  
  // Check for print ISSN
  for (const pattern of printPatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.print = formatISSN(match[1]);
      break;
    }
  }
  
  // Reset regex lastIndex for online patterns
  for (const pattern of onlinePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      result.online = formatISSN(match[1]);
      break;
    }
  }
  
  // If no specific print/online found, look for general ISSN
  if (!result.print && !result.online) {
    const generalISSNPattern = /ISSN[\s:]*(\d{4}-?\d{3}[\dXx])/gi;
    const matches = [];
    let match;
    while ((match = generalISSNPattern.exec(text)) !== null) {
      matches.push(formatISSN(match[1]));
    }
    
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
 * Format ISSN to standard format (XXXX-XXXX)
 */
const formatISSN = (issn: string): string => {
  const cleaned = issn.replace(/[^0-9X]/gi, '');
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4)}`;
  }
  return issn; // Return as-is if not standard length
};

/**
 * Extract ISBN from text with better pattern matching
 */
const extractISBN = (text: string): string | undefined => {
  const isbnPatterns = [
    /ISBN[\s:]*(\d{3}-?\d{1,5}-?\d{1,7}-?\d{1,7}-?[\dXx])/gi,
    /ISBN[\s:]*(\d{10}|\d{13})/gi,
    /ISBN-13[\s:]*(\d{3}-?\d{1,5}-?\d{1,7}-?\d{1,7}-?[\dXx])/gi,
    /ISBN-10[\s:]*(\d{1,5}-?\d{1,7}-?\d{1,7}-?[\dXx])/gi
  ];
  
  for (const pattern of isbnPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
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
  
  const publications: Partial<Publication>[] = [];
  
  jsonData.forEach((row: any) => {
    // Enhanced author field mapping
    const authors = row.Authors || row.authors || row.Author || row.AUTHOR || 
                   row['Author(s)'] || row.writer || row.Writers || row.Contributor || 
                   row.Contributors || '';
    
    // Enhanced title field mapping
    const title = row.Title || row.title || row.Name || row.name || 
                 row['Article Title'] || row['Publication Title'] || row.Heading || '';
    
    // Enhanced year field mapping
    const yearValue = row.Year || row.year || row.Date || row.date || 
                     row['Publication Year'] || row.PublicationYear || 
                     row['Pub Year'] || new Date().getFullYear();
    const year = typeof yearValue === 'number' ? yearValue : 
                parseInt(yearValue) || new Date().getFullYear();
    
    // Enhanced source field mapping
    const source = row.Source || row.source || row.Journal || row.journal || 
                  row['Publication'] || row['Journal/Series'] || row['Journal Name'] || 
                  row['journal_name'] || row['Publication Name'] || row.Venue || 
                  row['Publication Venue'] || row.Publisher || '';
    
    // Comprehensive ISSN field mapping with multiple variations
    const issnPrint = row['ISSN Print'] || row['ISSN_Print'] || row.issnPrint || 
                     row['Print ISSN'] || row.printISSN || row['ISSN-P'] || 
                     row['ISSN (Print)'] || row['Print_ISSN'] || row.pISSN || 
                     row['ISSN Print:'] || row['Print-ISSN'] || '';
                     
    const issnOnline = row['ISSN Online'] || row['ISSN_Online'] || row.issnOnline || 
                      row['Online ISSN'] || row.onlineISSN || row['Electronic ISSN'] || 
                      row['E-ISSN'] || row['ISSN-E'] || row['ISSN (Online)'] || 
                      row['Online_ISSN'] || row['Electronic_ISSN'] || row.eISSN ||
                      row['ISSN Online:'] || row['Electronic-ISSN'] || '';
                      
    // Check for general ISSN field and extract print/online if available
    const generalISSN = row.ISSN || row.issn || row.ISSNL || '';
    let finalIssnPrint = issnPrint || '';
    let finalIssnOnline = issnOnline || '';
    
    // If we have a general ISSN but no specific print/online, use it as print
    if (generalISSN && !finalIssnPrint && !finalIssnOnline) {
      finalIssnPrint = generalISSN;
    }
    
    // Enhanced ISBN field mapping
    const isbn = row.ISBN || row.isbn || row['ISBN-13'] || row['ISBN-10'] || 
                row['ISBN13'] || row['ISBN10'] || row.isbn13 || row.isbn10 || '';
    
    // Format ISSNs to standard format
    if (finalIssnPrint) {
      finalIssnPrint = formatISSN(finalIssnPrint.toString());
    }
    if (finalIssnOnline) {
      finalIssnOnline = formatISSN(finalIssnOnline.toString());
    }
    
    // Enhanced text extraction for ISSN/ISBN from any text fields
    const allTextFields = Object.values(row).join(' ');
    const extractedISSN = extractISSN(allTextFields);
    const extractedISBN = extractISBN(allTextFields);
    
    // Use extracted values if manual fields are empty
    if (!finalIssnPrint && extractedISSN.print) {
      finalIssnPrint = extractedISSN.print;
    }
    if (!finalIssnOnline && extractedISSN.online) {
      finalIssnOnline = extractedISSN.online;
    }
    if (!isbn && extractedISBN) {
      const finalISBN = extractedISBN;
    }
    
    if (title) {
      publications.push({
        id: uuidv4(),
        authors: typeof authors === 'string' ? authors : String(authors || ''),
        title: typeof title === 'string' ? title : String(title),
        year: year,
        source: typeof source === 'string' ? source : String(source || ''),
        issnPrint: finalIssnPrint || undefined,
        issnOnline: finalIssnOnline || undefined,
        isbn: (isbn || extractedISBN) || undefined,
        checked: false,
        indexed: false,
      });
    }
  });
  
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
