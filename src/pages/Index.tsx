import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicationForm from "@/components/PublicationForm";
import FileUpload from "@/components/FileUpload";
import PublicationList from "@/components/PublicationList";
import JufoImport from "@/components/JufoImport";
import ResultSummary from "@/components/ResultSummary";
import { Publication } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { checkJufoQuality } from "@/utils/jufo-api";
import { exportToCSV, exportToExcel } from "@/utils/export-utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { v4 as uuidv4 } from "uuid";
import { Filter, CheckCircle, Loader2, Clock, FileText, FileSpreadsheet } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Index = () => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [checkingProgress, setCheckingProgress] = useState(0);
  const [currentlyChecking, setCurrentlyChecking] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("excel");
  const { toast } = useToast();

  const addPublication = (publication: Publication) => {
    setPublications((prev) => [...prev, publication]);
  };

  const extractPublications = (extractedPubs: Partial<Publication>[]) => {
    const newPublications = extractedPubs.map((pub) => ({
      ...pub,
      id: pub.id || uuidv4(),
      checked: false,
      indexed: false,
      jufoLevel: null,
      norwegianLevel: null,
      evaluated: true,
    } as Publication));
    
    setPublications((prev) => [...prev, ...newPublications]);
  };

  const checkAllPublications = async () => {
    if (publications.length === 0) {
      toast({
        title: "No Publications",
        description: "Please add publications to check their JUFO quality.",
        variant: "destructive",
      });
      return;
    }

    const uncheckedPublications = publications.filter(pub => !pub.checked);
    
    if (uncheckedPublications.length === 0) {
      toast({
        title: "All Publications Checked",
        description: "All publications have already been checked for JUFO quality.",
      });
      return;
    }

    setIsChecking(true);
    setCheckingProgress(0);
    setCurrentlyChecking("");
    
    console.log(`=== STARTING BATCH JUFO CHECK (ACCURACY FIXED) ===`);
    console.log(`Total publications to check: ${uncheckedPublications.length}`);
    
    const updatedPublications = [...publications];
    let checkedCount = 0;
    let indexedCount = 0;
    let evaluatedCount = 0;
    
    // Check each unchecked publication
    for (let i = 0; i < updatedPublications.length; i++) {
      if (!updatedPublications[i].checked) {
        try {
          const shortTitle = updatedPublications[i].title.length > 50 
            ? updatedPublications[i].title.substring(0, 50) + "..."
            : updatedPublications[i].title;
          setCurrentlyChecking(shortTitle);
          
          console.log(`--- Checking publication ${checkedCount + 1}/${uncheckedPublications.length} ---`);
          console.log(`Title: ${updatedPublications[i].title}`);
          console.log(`Source: ${updatedPublications[i].source}`);
          
          // CRITICAL: Preserve ALL original identifiers
          const originalData = {
            issnPrint: updatedPublications[i].issnPrint,
            issnOnline: updatedPublications[i].issnOnline,
            isbn: updatedPublications[i].isbn,
            issn: updatedPublications[i].issn,
          };
          
          console.log(`Identifiers - Print: "${originalData.issnPrint || 'N/A'}", Online: "${originalData.issnOnline || 'N/A'}", ISBN: "${originalData.isbn || 'N/A'}", General: "${originalData.issn || 'N/A'}"`);
          
          // Check JUFO quality
          const result = await checkJufoQuality(
            updatedPublications[i].source,
            originalData.issnPrint,
            originalData.issnOnline,
            originalData.isbn
          );
          
          console.log(`RESULT: Level ${result.level}, Indexed: ${result.indexed}, Status: ${result.status}`);
          
          // Update with results while preserving ALL identifiers
          updatedPublications[i] = {
            ...updatedPublications[i],
            jufoLevel: result.level,
            norwegianLevel: result.norwegianLevel,
            indexed: result.indexed,
            evaluated: result.evaluated,
            checked: true,
            status: result.status,
            // PRESERVE ALL IDENTIFIERS
            issnPrint: originalData.issnPrint,
            issnOnline: originalData.issnOnline,
            isbn: originalData.isbn,
            issn: originalData.issn,
          };
          
          checkedCount++;
          if (result.indexed) indexedCount++;
          if (result.evaluated) evaluatedCount++;
          
          setCheckingProgress((checkedCount / uncheckedPublications.length) * 100);
          setPublications([...updatedPublications]);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error("Error checking publication:", error);
          
          // Preserve identifiers on failure
          const originalData = {
            issnPrint: updatedPublications[i].issnPrint,
            issnOnline: updatedPublications[i].issnOnline,
            isbn: updatedPublications[i].isbn,
            issn: updatedPublications[i].issn,
          };
          
          updatedPublications[i] = {
            ...updatedPublications[i],
            jufoLevel: "Not found",
            norwegianLevel: null,
            indexed: false,
            evaluated: false,
            checked: true,
            status: 'Not Indexed',
            // PRESERVE ALL IDENTIFIERS
            issnPrint: originalData.issnPrint,
            issnOnline: originalData.issnOnline,
            isbn: originalData.isbn,
            issn: originalData.issn,
          };
          
          checkedCount++;
        }
      }
    }
    
    setPublications(updatedPublications);
    setIsChecking(false);
    setCheckingProgress(100);
    setCurrentlyChecking("");
    
    console.log(`=== BATCH CHECK COMPLETE ===`);
    console.log(`Checked: ${checkedCount}, Indexed: ${indexedCount}, Evaluated: ${evaluatedCount}`);
    
    toast({
      title: "JUFO Quality Check Complete",
      description: `Successfully checked ${checkedCount} publications. Found ${indexedCount} indexed sources.`,
    });
    
    setTimeout(() => setCheckingProgress(0), 2000);
  };

  const handleExport = (publicationsToExport: Publication[] = publications) => {
    if (publicationsToExport.length === 0) {
      toast({
        title: "No Publications",
        description: "Please add publications to export.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      if (exportFormat === "csv") {
        exportToCSV(publicationsToExport);
      } else {
        exportToExcel(publicationsToExport);
      }
      
      toast({
        title: "Export Successful",
        description: `Exported ${publicationsToExport.length} publications to ${exportFormat.toUpperCase()}.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the data.",
        variant: "destructive",
      });
    }
  };

  const getCheckButtonContent = () => {
    if (isChecking) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking JUFO Quality...
        </>
      );
    }
    
    const uncheckedCount = publications.filter(pub => !pub.checked).length;
    if (uncheckedCount === 0 && publications.length > 0) {
      return (
        <>
          <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
          All Checked
        </>
      );
    }
    
    return (
      <>
        <Clock className="mr-2 h-4 w-4" />
        Check JUFO Quality {uncheckedCount > 0 && `(${uncheckedCount})`}
      </>
    );
  };

  return (
    <div className="container mx-auto py-8 min-h-screen flex flex-col">
      {/* Top navigation with Admin Link */}
      <nav className="flex justify-end mb-4">
        <Link 
          to="/login" 
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Admin Sign In
        </Link>
      </nav>
      
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center">
          <Filter className="mr-2 h-6 w-6 text-purple-600" /> SciFilter
        </h1>
        <p className="text-lg font-medium text-purple-600 mb-2">
          Filter the noise. Trust the science.
        </p>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          SciFilter is an AI-powered academic publication quality intelligent screening tool that evaluates the credibility of academic 
          publications by referencing the JUFO and Norwegian sources quality rankings. Whether 
          uploaded in bulk or entered manually, SciFilter ensures that only high-quality sources 
          pass your research standards.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Quality Screening Dashboard</CardTitle>
                <CardDescription>
                  Add publications manually, upload documents, or check JUFO quality rankings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="manual" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                    <TabsTrigger value="upload">File Upload</TabsTrigger>
                  </TabsList>
                  <TabsContent value="manual" className="pt-4">
                    <PublicationForm onAddPublication={addPublication} />
                  </TabsContent>
                  <TabsContent value="upload" className="pt-4">
                    <FileUpload onExtractPublications={extractPublications} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <JufoImport />
          </div>
        </div>

        {publications.length > 0 && (
          <ResultSummary publications={publications} />
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Button 
                onClick={checkAllPublications} 
                disabled={isChecking || publications.length === 0}
                className="min-w-[200px]"
              >
                {getCheckButtonContent()}
              </Button>
              
              {isChecking && (
                <div className="space-y-2">
                  <Progress value={checkingProgress} className="w-[300px]" />
                  <p className="text-sm text-muted-foreground">
                    {currentlyChecking && `Checking: ${currentlyChecking}`}
                    {checkingProgress > 0 && ` (${Math.round(checkingProgress)}%)`}
                  </p>
                </div>
              )}
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={publications.length === 0}>
                  Export Results
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Publications</DialogTitle>
                  <DialogDescription>
                    Export your publication quality screening results in your preferred format.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="format" className="text-right">
                      Format
                    </Label>
                    <Select 
                      value={exportFormat} 
                      onValueChange={(value) => setExportFormat(value as "csv" | "excel")}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select export format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excel">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Excel (.xlsx)
                          </div>
                        </SelectItem>
                        <SelectItem value="csv">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            CSV (.csv)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => handleExport()}>
                    Export {publications.length} Publications
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <PublicationList publications={publications} onExport={handleExport} />
      </div>
    </div>
  );
};

export default Index;
