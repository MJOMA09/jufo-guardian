
import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { getDatabaseStats, getDatabaseMetadata, loadFromCloud, subscribeToChanges } from "@/utils/jufo-data";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface DatabaseStats {
  totalEntries: number;
  currentYearEntries: number;
  latestYear: number;
  level0: number;
  level1: number;
  level2: number;
  level3: number;
  notEvaluated: number;
}

const JufoImport: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats>(getDatabaseStats());
  const [metadata, setMetadata] = useState(getDatabaseMetadata());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const hasData = stats.totalEntries > 0;

  const refreshData = useCallback(async () => {
    await loadFromCloud();
    setStats(getDatabaseStats());
    setMetadata(getDatabaseMetadata());
  }, []);

  useEffect(() => {
    // Initial load from cloud
    refreshData().then(() => setIsInitialLoading(false));
    
    // Subscribe to real-time changes
    const unsubscribe = subscribeToChanges(() => {
      console.log('📡 Database updated via real-time, refreshing...');
      setStats(getDatabaseStats());
      setMetadata(getDatabaseMetadata());
    });
    
    return unsubscribe;
  }, [refreshData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="mr-2 h-5 w-5" />
          JUFO Reference Database
        </CardTitle>
        <CardDescription>
          Publication ranking data from the JUFO portal
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isInitialLoading ? (
          <div className="text-center py-6">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading database from cloud...</p>
          </div>
        ) : hasData ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Database Status: <span className="text-green-600">Active</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {stats.totalEntries.toLocaleString()} publications indexed ({stats.currentYearEntries.toLocaleString()} for {stats.latestYear})
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh database"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: stats.level3, label: "Level 3" },
                { value: stats.level2, label: "Level 2" },
                { value: stats.level1, label: "Level 1" },
                { value: stats.level0, label: "Level 0" },
                { value: stats.notEvaluated, label: "Not Evaluated" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border p-4 text-center">
                  <div className="text-2xl font-bold">{item.value.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
            
            <Alert>
              <AlertDescription className="text-sm text-muted-foreground">
                <p>"Not evaluated" = Professional and general series and scientific channels that have not yet been evaluated.</p>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="text-center py-6">
            <AlertCircle className="h-10 w-10 text-amber-500 mb-3 mx-auto" />
            <p className="text-sm font-medium text-amber-600 mb-2">
              Reference Database Not Available
            </p>
            <p className="text-xs text-muted-foreground">
              The JUFO reference database has not been configured yet. Please contact an administrator to set up the database.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="mt-4"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Check for Updates
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JufoImport;
