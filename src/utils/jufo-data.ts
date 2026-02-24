
import * as XLSX from 'xlsx';
import { JufoData } from "@/types";
import { supabase } from "@/integrations/supabase/client";

// In-memory cache
let jufoDatabase: JufoData[] = [];
let latestDatabaseYear: number = new Date().getFullYear();
let databaseVersion: number = 0;
let isLoaded = false;

/**
 * Load JUFO data from Supabase cloud
 */
export const loadFromCloud = async (): Promise<boolean> => {
  try {
    // Get metadata first
    const { data: metaData } = await supabase.from("jufo_metadata").select("*").limit(1).maybeSingle();
    
    if (!metaData || metaData.entry_count === 0) {
      jufoDatabase = [];
      isLoaded = true;
      return false;
    }

    // Load all entries (may need pagination for large datasets)
    let allEntries: any[] = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from("jufo_entries")
        .select("*")
        .range(from, from + pageSize - 1);
      
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allEntries = allEntries.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    jufoDatabase = allEntries.map(entry => ({
      name: entry.name,
      issn: entry.issn || '',
      level: entry.level,
      norwegianLevel: entry.norwegian_level,
      publisher: entry.publisher || '',
      type: entry.type || 'journal',
      year: entry.year,
      evaluated: entry.evaluated ?? false,
    }));

    latestDatabaseYear = metaData.latest_year || new Date().getFullYear();
    databaseVersion = metaData.version || 0;
    isLoaded = true;

    console.log(`✅ JUFO database loaded from cloud: ${jufoDatabase.length} entries, version ${databaseVersion}`);
    return jufoDatabase.length > 0;
  } catch (error) {
    console.error('Failed to load JUFO database from cloud:', error);
    isLoaded = true;
    return false;
  }
};

/**
 * Subscribe to real-time changes on JUFO data
 */
export const subscribeToChanges = (callback: () => void): (() => void) => {
  const channel = supabase
    .channel('jufo-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jufo_metadata' }, () => {
      console.log('📡 JUFO metadata changed, reloading...');
      loadFromCloud().then(() => callback());
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Get database metadata from cloud
 */
export const getDatabaseMetadata = () => {
  if (!isLoaded) return null;
  if (jufoDatabase.length === 0) return null;
  return {
    latestYear: latestDatabaseYear,
    version: databaseVersion,
    entryCount: jufoDatabase.length,
  };
};

/**
 * Reload from cloud
 */
export const reloadFromStorage = (): boolean => {
  // Trigger async reload, return current state
  loadFromCloud();
  return jufoDatabase.length > 0;
};

export const getDatabaseVersion = (): number => databaseVersion;

/**
 * Process and import JUFO data from an Excel file - now uploads to cloud
 */
export const importJufoExcel = async (
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<{ success: boolean; count: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
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

        onProgress?.(10, "File parsed, processing entries...");

        const currentYear = new Date().getFullYear();
        let maxYear = currentYear;

        const processedData = jsonData.map((row: any) => {
          const year = parseInt(row.Year || row.year || currentYear, 10);
          if (year > maxYear) maxYear = year;

          return {
            name: (row.Name || row.name || row.Title || row['Journal/Series'] ||
              row.Jufo_ID && row['__EMPTY'] || row['Journal_name'] || '').toString().trim(),
            issn: (row.ISSN || row.issn || row.ISBN || row.isbn || row.ISSNL ||
              row.ISSN1 || row['Print ISSN'] || row['Online ISSN'] || '').toString().trim(),
            level: parseInt(row.Level || row.level || row.JUFO || row.jufo || row['JUFO Level'] || 0, 10),
            norwegian_level: row.Norwegian || row.NorwegianLevel || row['Norwegian Level'] ||
              (row.indicators && typeof row.indicators === 'string' &&
                row.indicators.includes('level_norway') ?
                parseInt(row.indicators.match(/"level_norway":(\d+)/)?.[1] || '0', 10) : null),
            publisher: (row.Publisher || row.publisher || '').toString().trim(),
            type: (row.Type || row.type || row.Type_en || 'journal').toString().toLowerCase(),
            year: year,
            evaluated: row.Level !== undefined && row.Level !== null ||
              row.level !== undefined && row.level !== null ||
              (row.isScientific === 'true' || row.isScientific === true),
          };
        });

        const validData = processedData.filter((item: any) =>
          item.name && item.name.trim() !== '' && item.name.length > 2
        );

        onProgress?.(20, `${validData.length} valid entries, uploading to cloud...`);

        // Get admin token from session
        const session = sessionStorage.getItem('scifilter-session');
        const adminToken = session ? JSON.parse(session).timestamp?.toString() || 'admin' : 'admin';

        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const headers = {
          "Content-Type": "application/json",
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "x-admin-token": adminToken,
        };

        // Step 1: Clear existing data
        onProgress?.(25, "Clearing old data...");
        const clearRes = await fetch(`${baseUrl}/functions/v1/import-jufo`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "clear" }),
        });
        if (!clearRes.ok) throw new Error("Failed to clear existing data");

        // Step 2: Upload in batches
        const BATCH_SIZE = 500;
        let uploaded = 0;

        for (let i = 0; i < validData.length; i += BATCH_SIZE) {
          const batch = validData.slice(i, i + BATCH_SIZE);
          const progress = 30 + Math.round((uploaded / validData.length) * 60);
          onProgress?.(progress, `Uploading batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validData.length / BATCH_SIZE)}...`);

          const batchRes = await fetch(`${baseUrl}/functions/v1/import-jufo`, {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "batch", entries: batch }),
          });
          if (!batchRes.ok) {
            const err = await batchRes.json();
            throw new Error(err.error || "Failed to upload batch");
          }
          uploaded += batch.length;
        }

        // Step 3: Update metadata
        onProgress?.(92, "Updating metadata...");
        const metaRes = await fetch(`${baseUrl}/functions/v1/import-jufo`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "metadata",
            metadata: {
              latestYear: maxYear,
              entryCount: validData.length,
            },
          }),
        });
        if (!metaRes.ok) throw new Error("Failed to update metadata");

        // Reload local cache from cloud
        onProgress?.(95, "Syncing local cache...");
        await loadFromCloud();

        onProgress?.(100, "Import complete!");

        resolve({ success: true, count: validData.length });
      } catch (error: any) {
        console.error("❌ Error processing JUFO file:", error);
        reject({ success: false, error: error.message || "Failed to process the file." });
      }
    };

    reader.onerror = () => {
      reject({ success: false, error: "Error reading the file" });
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

export const getLatestDatabaseYear = (): number => latestDatabaseYear;

/**
 * EXACT JUFO database search with 100% matching requirement
 */
export const searchJufoDatabase = (source?: string, issnPrint?: string, issnOnline?: string, isbn?: string): JufoData | null => {
  if (!jufoDatabase || jufoDatabase.length === 0) {
    console.log("❌ No JUFO database data available");
    return null;
  }

  const currentYearEntries = jufoDatabase.filter(entry =>
    entry.year === latestDatabaseYear || !entry.year
  );

  // PRIORITY 1: Exact source name matching
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    const normalizedQuery = source.toLowerCase().trim();

    for (const entry of currentYearEntries) {
      if (normalizedQuery === entry.name.toLowerCase().trim()) {
        return entry;
      }
    }
    for (const entry of jufoDatabase) {
      if (normalizedQuery === entry.name.toLowerCase().trim()) {
        return entry;
      }
    }
  }

  // PRIORITY 2: ISSN/ISBN identifier matching
  if (issnPrint || issnOnline || isbn) {
    const identifiers = [issnPrint, issnOnline, isbn].filter(Boolean);

    for (const identifier of identifiers) {
      const normalizedQuery = normalizeIdentifier(identifier!);

      for (const entry of currentYearEntries) {
        const normalizedEntry = normalizeIdentifier(entry.issn);
        if (normalizedQuery && normalizedEntry) {
          if (normalizedQuery === normalizedEntry) return entry;
          const entryParts = entry.issn.split(/[,;|\s]+/).map(p => normalizeIdentifier(p.trim())).filter(Boolean);
          if (entryParts.includes(normalizedQuery)) return entry;
        }
      }

      for (const entry of jufoDatabase) {
        const normalizedEntry = normalizeIdentifier(entry.issn);
        if (normalizedQuery && normalizedEntry) {
          if (normalizedQuery === normalizedEntry) return entry;
          const entryParts = entry.issn.split(/[,;|\s]+/).map(p => normalizeIdentifier(p.trim())).filter(Boolean);
          if (entryParts.includes(normalizedQuery)) return entry;
        }
      }
    }
  }

  return null;
};

const normalizeIdentifier = (identifier: string): string => {
  if (!identifier) return '';
  return identifier.replace(/[^0-9X]/gi, '').toUpperCase();
};

export const hasDatabaseData = (): boolean => jufoDatabase.length > 0;

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
