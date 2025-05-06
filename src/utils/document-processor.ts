
import { Publication } from "@/types";
import { v4 as uuidv4 } from "uuid";

/**
 * Extract publications from text content
 * In a production scenario, this would use more advanced NLP techniques
 * For the demo, we use simplified extraction logic
 */
export const extractPublicationsFromText = (text: string): Partial<Publication>[] => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const publications: Partial<Publication>[] = [];
  
  // Very simple extraction logic - in real implementation would use better NLP
  // For demo, assume each line could be a publication entry
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
        // This is a simplified approach - real implementation would use NLP
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
 * Extract text from PDF or DOCX files
 * In a real implementation, this would use a PDF/DOCX parser library
 */
export const extractTextFromFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error("Failed to read file"));
      }
      
      // For a real implementation, use libraries like pdf.js for PDF or 
      // mammoth.js for DOCX to properly extract text
      // This is just a simple text extraction for demonstration
      
      // Check if this is a PDF file (starts with %PDF-)
      const content = event.target.result as ArrayBuffer;
      const uint8Array = new Uint8Array(content);
      const header = new TextDecoder('utf-8').decode(uint8Array.slice(0, 5));
      
      if (header === '%PDF-') {
        // In real implementation: use pdf.js or similar library
        // For demo: return placeholder text
        resolve("Smith, J. (2023). \"The impact of academic publishing on career advancement.\" Journal of Informetrics. 2023.\n" +
                "Johnson et al. \"Quality metrics in scientific journals.\" Nature. 2022.\n" +
                "Brown, A. \"Predatory journals and academic integrity.\" Predatory Journal. 2021.");
      } else {
        // Assume DOCX or text
        // In real implementation: use mammoth.js or similar for DOCX
        // For demo: return placeholder text
        resolve("Garcia, M. et al. \"Bibliometric analysis of open access journals.\" PLOS ONE. 2023.\n" +
                "Wang et al. \"Machine learning applications in scientometrics.\" Scientific Reports. 2022.\n" +
                "Taylor, S. \"Information retrieval in digital libraries.\" Information Processing & Management. 2021.");
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    
    // Read file as array buffer
    reader.readAsArrayBuffer(file);
  });
};
