
import React, { useState } from "react";
import PublicationForm from "@/components/PublicationForm";
import FileUpload from "@/components/FileUpload";
import PublicationList from "@/components/PublicationList";
import JufoImport from "@/components/JufoImport";
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

const Index = () => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("csv");
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
        description: "Please add publications to check.",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    
    // Create a copy of publications
    const updatedPublications = [...publications];
    let checkedCount = 0;
    let indexedCount = 0;
    let evaluatedCount = 0;
    
    // Check each publication
    for (let i = 0; i < updatedPublications.length; i++) {
      if (!updatedPublications[i].checked) {
        try {
          // Check JUFO quality
          const result = await checkJufoQuality(updatedPublications[i].source);
          
          // Update publication with result
          updatedPublications[i] = {
            ...updatedPublications[i],
            jufoLevel: result.level,
            norwegianLevel: result.norwegianLevel,
            indexed: result.indexed,
            evaluated: result.evaluated,
            checked: true,
          };
          
          checkedCount++;
          if (result.indexed) indexedCount++;
          if (result.evaluated) evaluatedCount++;
        } catch (error) {
          console.error("Error checking publication:", error);
        }
      }
    }
    
    // Update state with checked publications
    setPublications(updatedPublications);
    setIsChecking(false);
    
    toast({
      title: "Check Complete",
      description: `Checked ${checkedCount} publications. Found ${indexedCount} indexed sources (${evaluatedCount} evaluated).`,
    });
  };

  const handleExport = () => {
    if (publications.length === 0) {
      toast({
        title: "No Publications",
        description: "Please add publications to export.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      if (exportFormat === "csv") {
        exportToCSV(publications);
      } else {
        exportToExcel(publications);
      }
      
      toast({
        title: "Export Successful",
        description: `Exported ${publications.length} publications to ${exportFormat.toUpperCase()}.`,
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

  return (
    <div className="container mx-auto py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">SciFilter</h1>
        <p className="text-muted-foreground">
          AI-Powered Academic Publication Quality Screening System
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

        <div className="flex justify-between items-center">
          <Button 
            onClick={checkAllPublications} 
            disabled={isChecking || publications.length === 0}
            className="mb-4"
          >
            {isChecking ? "Checking..." : "Check JUFO Quality"}
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="mb-4">Export Options</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Publications</DialogTitle>
                <DialogDescription>
                  Choose your preferred export format.
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
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                      <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleExport}>
                  Export
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <PublicationList publications={publications} onExport={handleExport} />
      </div>
    </div>
  );
};

export default Index;
