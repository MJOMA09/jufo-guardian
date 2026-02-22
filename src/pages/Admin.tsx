import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileSpreadsheet, Upload, Database, Shield } from "lucide-react";
import { importJufoExcel, getDatabaseStats } from "@/utils/jufo-data";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, setAuthenticated } from "@/utils/auth";

const Admin: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ 
    totalEntries: 0, 
    currentYearEntries: 0,
    latestYear: new Date().getFullYear(),
    level0: 0, 
    level1: 0, 
    level2: 0, 
    level3: 0,
    notEvaluated: 0 
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
    } else {
      setStats(getDatabaseStats());
    }
  }, [navigate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select an Excel or CSV file (.xlsx, .xls, .csv)",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setProgress(25);

    try {
      setTimeout(() => setProgress(50), 500);
      const result = await importJufoExcel(file);
      setTimeout(() => setProgress(100), 200);
      
      toast({
        title: "Import Successful",
        description: `Imported ${result.count} entries from JUFO database.`,
      });
      
      setStats(getDatabaseStats());
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.error || "Failed to import JUFO data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };
  
  const handleLogout = () => {
    setAuthenticated(false);
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
    navigate('/login');
  };

  return (
    <div className="container mx-auto py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center">
          <Shield className="mr-2 h-6 w-6 text-purple-600" /> SciFilter Admin
        </h1>
        <p className="text-lg font-medium text-purple-600 mb-2">
          Database Management System
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>
            Return to Main Application
          </Button>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="text-red-500 hover:bg-red-50"
          >
            Logout
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              JUFO Reference Database Management
            </CardTitle>
            <CardDescription>
              Import and manage JUFO publication ranking data from the official JUFO portal Excel or CSV export
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.totalEntries > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Database Status: <span className="text-green-600">Active</span></p>
                    <p className="text-sm text-muted-foreground">
                      {stats.totalEntries} publications indexed ({stats.currentYearEntries} for {stats.latestYear})
                    </p>
                  </div>
                  <Button onClick={() => document.getElementById('jufo-file')?.click()}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Update Database
                  </Button>
                </div>
                
                <div className="grid grid-cols-5 gap-3 mt-4">
                  <div className="rounded-md border p-3">
                    <div className="text-2xl font-bold">{stats.level3}</div>
                    <div className="text-xs text-muted-foreground">Level 3</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-2xl font-bold">{stats.level2}</div>
                    <div className="text-xs text-muted-foreground">Level 2</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-2xl font-bold">{stats.level1}</div>
                    <div className="text-xs text-muted-foreground">Level 1</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-2xl font-bold">{stats.level0}</div>
                    <div className="text-xs text-muted-foreground">Level 0</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-2xl font-bold">{stats.notEvaluated}</div>
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
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center border border-dashed rounded-md p-10">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No JUFO database loaded
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('jufo-file')?.click()}
                    disabled={isImporting}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting ? "Importing..." : "Import JUFO Data"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Download Excel/CSV data from the JUFO portal at <a href="https://jfp.csc.fi/" className="underline" target="_blank" rel="noopener">jfp.csc.fi</a>
                  </p>
                </div>
                
                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-xs text-center text-muted-foreground">
                      Processing JUFO data...
                    </p>
                  </div>
                )}
              </div>
            )}
            
            <input 
              id="jufo-file" 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleFileChange} 
              className="hidden" 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
