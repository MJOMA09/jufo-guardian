
import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { getDatabaseStats, getDatabaseMetadata, reloadFromStorage, subscribeToChanges } from "@/utils/jufo-data";
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
  
  const hasData = stats.totalEntries > 0;

  // Refresh stats from storage
  const refreshData = useCallback(() => {
    reloadFromStorage();
    setStats(getDatabaseStats());
    setMetadata(getDatabaseMetadata());
  }, []);

  // Auto-load database on mount and subscribe to cross-tab changes
  useEffect(() => {
    // Initial load
    refreshData();
    
    // Subscribe to changes from other tabs (admin uploads)
    const unsubscribe = subscribeToChanges(() => {
      console.log('📡 Database updated, refreshing client view...');
      refreshData();
    });
    
    // Cleanup subscription on unmount
    return unsubscribe;
  }, [refreshData]);

  // Refresh database from storage (in case admin updated it)
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      reloadFromStorage();
      setStats(getDatabaseStats());
      setMetadata(getDatabaseMetadata());
      setIsRefreshing(false);
    }, 500);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
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
        {hasData ? (
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
                {metadata?.updatedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {formatDate(metadata.updatedAt)}
                  </p>
                )}
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
            
            <div className="grid grid-cols-5 gap-2">
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.level3.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Level 3</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.level2.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Level 2</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.level1.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Level 1</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.level0.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Level 0</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.notEvaluated.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Not Evaluated</div>
              </div>
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
