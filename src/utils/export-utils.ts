
import { Publication } from "@/types";
import * as XLSX from 'xlsx';

export const exportToCSV = (publications: Publication[]): void => {
  // Create CSV content
  const headers = ["Authors", "Title", "Year", "Source", "JUFO Level", "Norwegian Level", "Indexed", "Status"];
  const rows = publications.map(pub => [
    `"${pub.authors.replace(/"/g, '""')}"`,
    `"${pub.title.replace(/"/g, '""')}"`,
    pub.year.toString(),
    `"${pub.source.replace(/"/g, '""')}"`,
    pub.checked ? (pub.jufoLevel !== null ? pub.jufoLevel.toString() : "Not found") : "Pending",
    pub.checked ? (pub.norwegianLevel !== null ? pub.norwegianLevel.toString() : "N/A") : "Pending",
    pub.indexed ? "Yes" : "No",
    pub.status || "Not Indexed"
  ]);
  
  const csvContent = 
    headers.join(",") + 
    "\n" + 
    rows.map(row => row.join(",")).join("\n");
  
  // Create a blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `jufo-publications-${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToExcel = (publications: Publication[]): void => {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  
  // Prepare data for Excel
  const data = publications.map(pub => ({
    "Authors": pub.authors,
    "Title": pub.title,
    "Year": pub.year,
    "Source": pub.source,
    "ISSN Print": pub.issnPrint || "",
    "ISSN Online": pub.issnOnline || "",
    "ISBN": pub.isbn || "",
    "JUFO Level": pub.checked ? (pub.jufoLevel !== null ? pub.jufoLevel.toString() : "Not found") : "Pending",
    "Norwegian Level": pub.checked ? (pub.norwegianLevel !== null ? pub.norwegianLevel.toString() : "N/A") : "Pending",
    "Indexed": pub.indexed ? "Yes" : "No",
    "Status": pub.status || "Not Indexed",
    "Evaluated": pub.evaluated ? "Yes" : "No"
  }));
  
  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Auto-size columns
  const columnWidths = [
    { wch: 25 }, // Authors
    { wch: 40 }, // Title
    { wch: 8 },  // Year
    { wch: 30 }, // Source
    { wch: 12 }, // ISSN Print
    { wch: 12 }, // ISSN Online
    { wch: 15 }, // ISBN
    { wch: 12 }, // JUFO Level
    { wch: 15 }, // Norwegian Level
    { wch: 10 }, // Indexed
    { wch: 12 }, // Status
    { wch: 10 }  // Evaluated
  ];
  worksheet['!cols'] = columnWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Publications");
  
  // Generate Excel file and download
  const fileName = `jufo-publications-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
