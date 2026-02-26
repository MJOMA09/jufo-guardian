import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileSpreadsheet, Upload, Database, Shield } from "lucide-react";
import { importJufoExcel, getDatabaseStats, loadFromCloud, subscribeToChanges } from "@/utils/jufo-data";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, setAuthenticated } from "@/utils/auth";
import Header from "@/components/Header";

const Admin: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
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
      loadFromCloud().then(() => {
        setStats(getDatabaseStats());
      });
    }
  }, [navigate]);

  // Subscribe to real-time changes
  useEffect(() => {
    const unsubscribe = subscribeToChanges(() => {
      setStats(getDatabaseStats());
    });
    return unsubscribe;
  }, []);

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
    setProgress(5);
    setProgressMessage("Reading file...");

    try {
      const result = await importJufoExcel(file, (p, msg) => {
        setProgress(p);
        setProgressMessage(msg);
      });
      
      toast({
        title: "Import Successful",
        description: `Imported ${result.count} entries to cloud database. All users will see the update in real-time.`,
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
      setProgress(0);
      setProgressMessage("");
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
    <div className="min-h-screen flex flex-col">
      <Header />
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
                Import and manage JUFO publication ranking data. Changes sync to all users in real-time.
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
                    <Button 
                      onClick={() => document.getElementById('jufo-file')?.click()}
                      disabled={isImporting}
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Update Database
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 mt-4">
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
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center border border-dashed rounded-md p-10">
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-2">No JUFO database loaded</p>
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
                </div>
              )}
              
              {isImporting && (
                <div className="space-y-2 mt-4">
                  <Progress value={progress} />
                  <p className="text-xs text-center text-muted-foreground">
                    {progressMessage || "Processing JUFO data..."}
                  </p>
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
    </div>
  );
};

export default Admin;
