
import { Publication } from "@/types";

export const exportToCSV = (publications: Publication[]): void => {
  // Create CSV content
  const headers = ["Authors", "Title", "Year", "Source", "JUFO Level", "Norwegian Level", "Indexed"];
  const rows = publications.map(pub => [
    `"${pub.authors.replace(/"/g, '""')}"`,
    `"${pub.title.replace(/"/g, '""')}"`,
    pub.year.toString(),
    `"${pub.source.replace(/"/g, '""')}"`,
    pub.checked ? (pub.jufoLevel !== null ? pub.jufoLevel.toString() : "Not found") : "Pending",
    pub.checked ? (pub.norwegianLevel !== null ? pub.norwegianLevel.toString() : "N/A") : "Pending",
    pub.indexed ? "Yes" : "No"
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
};

export const exportToExcel = (publications: Publication[]): void => {
  // For actual Excel export, we would use a library like xlsx
  // For this demo, we'll just use CSV with an .xlsx extension
  const headers = ["Authors", "Title", "Year", "Source", "JUFO Level", "Norwegian Level", "Indexed"];
  const rows = publications.map(pub => [
    `"${pub.authors.replace(/"/g, '""')}"`,
    `"${pub.title.replace(/"/g, '""')}"`,
    pub.year.toString(),
    `"${pub.source.replace(/"/g, '""')}"`,
    pub.checked ? (pub.jufoLevel !== null ? pub.jufoLevel.toString() : "Not found") : "Pending",
    pub.checked ? (pub.norwegianLevel !== null ? pub.norwegianLevel.toString() : "N/A") : "Pending",
    pub.indexed ? "Yes" : "No"
  ]);
  
  const csvContent = 
    headers.join(",") + 
    "\n" + 
    rows.map(row => row.join(",")).join("\n");
  
  // Create a blob and download
  const blob = new Blob([csvContent], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `jufo-publications-${new Date().toISOString().slice(0, 10)}.xlsx`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
