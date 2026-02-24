
import * as XLSX from 'xlsx';
import { JufoData } from "@/types";
import { supabase } from "@/integrations/supabase/client";

// In-memory cache for fast lookups during batch checks
let jufoCache: JufoData[] = [];
let latestDatabaseYear: number = new Date().getFullYear();
let cacheVersion: number = 0;

/**
 * Load JUFO data from the cloud into local cache
 */
export const loadFromCloud = async (): Promise<boolean> => {
  try {
    // Load metadata first
    const { data: meta } = await supabase
      .from("jufo_metadata")
      .select("*")
      .limit(1)
      .single();

    if (!meta || meta.entry_count === 0) {
      jufoCache = [];
      return false;
    }

    // Check if cache is already up-to-date
    if (cacheVersion === meta.version && jufoCache.length > 0) {
      return true;
    }

    latestDatabaseYear = meta.latest_year;
    cacheVersion = meta.version;

    // Load all entries (paginated to handle >1000 rows)
    let allEntries: JufoData[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("jufo_entries")
        .select("name, issn, level, norwegian_level, publisher, type, year, evaluated")
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error("Error loading JUFO entries:", error.message);
        return false;
      }

      if (data && data.length > 0) {
        const mapped = data.map((row: any) => ({
          name: row.name,
          issn: row.issn,
          level: row.level,
          norwegianLevel: row.norwegian_level,
          publisher: row.publisher,
          type: row.type,
          year: row.year,
          evaluated: row.evaluated,
        }));
        allEntries = allEntries.concat(mapped);
        offset += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    jufoCache = allEntries;
    console.log(`✅ JUFO cloud cache loaded: ${jufoCache.length} entries, year ${latestDatabaseYear}`);
    return true;
  } catch (error) {
    console.error("Failed to load JUFO data from cloud:", error);
    return false;
  }
};

/**
 * Get database metadata from cloud
 */
export const getDatabaseMetadata = async () => {
  try {
    const { data } = await supabase
      .from("jufo_metadata")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      return {
        latestYear: data.latest_year,
        version: data.version,
        updatedAt: data.updated_at,
        entryCount: data.entry_count,
      };
    }
  } catch (error) {
    console.error("Failed to get database metadata:", error);
  }
  return null;
};

/**
 * Subscribe to real-time JUFO database changes
 */
export const subscribeToChanges = (callback: () => void): (() => void) => {
  const channel = supabase
    .channel("jufo-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "jufo_metadata" },
      () => {
        console.log("🔄 JUFO metadata changed, reloading...");
        // Reset cache version to force reload
        cacheVersion = 0;
        callback();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Process and import JUFO data from an Excel file via cloud edge function
 */
export const importJufoExcel = async (file: File): Promise<{ success: boolean; count: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        let jsonData;

        if (file.name.endsWith(".csv")) {
          const csvData = e.target?.result as string;
          const workbook = XLSX.read(csvData, { type: "string" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        } else {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }

        console.log("✅ File loaded successfully");
        console.log("Sample row:", jsonData[0]);

        const currentYear = new Date().getFullYear();
        let maxYear = currentYear;

        const processedData = jsonData.map((row: any) => {
          const year = parseInt(row.Year || row.year || currentYear, 10);
          if (year > maxYear) maxYear = year;

          return {
            name: (
              row.Name || row.name || row.Title || row["Journal/Series"] ||
              (row.Jufo_ID && row["__EMPTY"]) || row["Journal_name"] || ""
            ).toString().trim(),
            issn: (
              row.ISSN || row.issn || row.ISBN || row.isbn || row.ISSNL ||
              row.ISSN1 || row["Print ISSN"] || row["Online ISSN"] || ""
            ).toString().trim(),
            level: parseInt(row.Level || row.level || row.JUFO || row.jufo || row["JUFO Level"] || 0, 10),
            norwegianLevel:
              row.Norwegian || row.NorwegianLevel || row["Norwegian Level"] ||
              (row.indicators && typeof row.indicators === "string" &&
                row.indicators.includes("level_norway")
                ? parseInt(row.indicators.match(/"level_norway":(\d+)/)?.[1] || "0", 10)
                : null),
            publisher: (row.Publisher || row.publisher || "").toString().trim(),
            type: (row.Type || row.type || row.Type_en || "journal").toString().toLowerCase(),
            year: year,
            evaluated:
              row.Level !== undefined && row.Level !== null ||
              row.level !== undefined && row.level !== null ||
              row.isScientific === "true" || row.isScientific === true,
          };
        });

        const validData = processedData.filter(
          (item: any) => item.name && item.name.trim() !== "" && item.name.length > 2
        );

        console.log(`✅ Processing complete: ${validData.length} valid entries, latest year: ${maxYear}`);

        // Send to cloud via edge function
        const adminToken = sessionStorage.getItem("scifilter-admin-token") || "admin";

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-jufo`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "x-admin-token": adminToken,
            },
            body: JSON.stringify({ entries: validData, latestYear: maxYear }),
          }
        );

        const result = await res.json();

        if (!res.ok || result.error) {
          throw { error: result.error || "Cloud import failed" };
        }

        // Reload cache from cloud
        cacheVersion = 0;
        await loadFromCloud();

        resolve({ success: true, count: result.count });
      } catch (error: any) {
        console.error("❌ Error processing JUFO file:", error);
        reject({
          success: false,
          error: error.error || "Failed to process the file. Please ensure it's a valid JUFO export.",
        });
      }
    };

    reader.onerror = () => {
      reject({ success: false, error: "Error reading the file" });
    };

    if (file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

/**
 * Get the latest year available in the database
 */
export const getLatestDatabaseYear = (): number => {
  return latestDatabaseYear;
};

/**
 * EXACT JUFO database search with 100% matching requirement
 */
export const searchJufoDatabase = (
  source?: string,
  issnPrint?: string,
  issnOnline?: string,
  isbn?: string
): JufoData | null => {
  if (!jufoCache || jufoCache.length === 0) {
    console.log("❌ No JUFO database data available");
    return null;
  }

  console.log(`=== JUFO DATABASE SEARCH (100% EXACT MATCHING) ===`);
  console.log(`Database: ${jufoCache.length} entries`);

  const currentYearEntries = jufoCache.filter(
    (entry) => entry.year === latestDatabaseYear || !entry.year
  );

  // PRIORITY 1: 100% EXACT source name matching
  if (source && source.trim() !== "" && !source.toLowerCase().includes("unknown")) {
    const normalizedQuery = source.toLowerCase().trim();

    for (const entry of currentYearEntries) {
      if (normalizedQuery === entry.name.toLowerCase().trim()) {
        console.log(`🎯 CURRENT YEAR EXACT SOURCE MATCH: Level ${entry.level}`);
        return entry;
      }
    }

    for (const entry of jufoCache) {
      if (normalizedQuery === entry.name.toLowerCase().trim()) {
        console.log(`🎯 HISTORICAL EXACT SOURCE MATCH: Level ${entry.level}`);
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
          const entryParts = entry.issn.split(/[,;|\s]+/).map((p) => normalizeIdentifier(p.trim())).filter(Boolean);
          if (entryParts.includes(normalizedQuery)) return entry;
        }
      }

      for (const entry of jufoCache) {
        const normalizedEntry = normalizeIdentifier(entry.issn);
        if (normalizedQuery && normalizedEntry) {
          if (normalizedQuery === normalizedEntry) return entry;
          const entryParts = entry.issn.split(/[,;|\s]+/).map((p) => normalizeIdentifier(p.trim())).filter(Boolean);
          if (entryParts.includes(normalizedQuery)) return entry;
        }
      }
    }
  }

  console.log(`❌ NO MATCHES FOUND`);
  return null;
};

const normalizeIdentifier = (identifier: string): string => {
  if (!identifier) return "";
  return identifier.replace(/[^0-9X]/gi, "").toUpperCase();
};

/**
 * Check if database is populated (from cache)
 */
export const hasDatabaseData = (): boolean => {
  return jufoCache.length > 0;
};

/**
 * Get database stats (from cache)
 */
export const getDatabaseStats = () => {
  const latestYearEntries = jufoCache.filter(
    (entry) => entry.year === latestDatabaseYear || !entry.year
  );

  return {
    totalEntries: jufoCache.length,
    currentYearEntries: latestYearEntries.length,
    latestYear: latestDatabaseYear,
    level0: latestYearEntries.filter((e) => e.level === 0).length,
    level1: latestYearEntries.filter((e) => e.level === 1).length,
    level2: latestYearEntries.filter((e) => e.level === 2).length,
    level3: latestYearEntries.filter((e) => e.level === 3).length,
    notEvaluated: latestYearEntries.filter((e) => !e.evaluated).length,
  };
};

// Legacy compat - no longer needed but kept for imports
export const reloadFromStorage = (): boolean => {
  return jufoCache.length > 0;
};
