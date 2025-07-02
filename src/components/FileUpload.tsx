
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { processFileAndExtractPublications } from "@/utils/document-processor";
import { Publication } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import { FileSpreadsheet, FileText, FileUp, Loader2 } from "lucide-react";

interface FileUploadProps {
  onExtractPublications: (publications: Partial<Publication>[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onExtractPublications }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const fileType = selectedFile.type;
      const fileName = selectedFile.name.toLowerCase();
      
      // Check if file is a supported format
      if (
        fileType === "application/pdf" ||
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        fileType === "application/vnd.ms-excel" ||
        fileType === "text/csv" ||
        fileType === "text/xml" ||
        fileType === "application/xml" ||
        fileName.endsWith('.pdf') ||
        fileName.endsWith('.docx') ||
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls') ||
        fileName.endsWith('.csv') ||
        fileName.endsWith('.xml')
      ) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Unsupported File Format",
          description: "Please upload a PDF, Word document, Excel, CSV, or XML file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const publications = await processFileAndExtractPublications(file);
      
      if (publications.length === 0) {
        toast({
          title: "No Publications Found",
          description: "No publications could be extracted from the document.",
          variant: "destructive",
        });
      } else {
        onExtractPublications(publications);
        toast({
          title: "Publications Extracted",
          description: `Successfully extracted ${publications.length} publications from ${file.name}.`,
        });
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "Processing Error",
        description: `An error occurred while processing ${file.name}.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get appropriate icon based on file type
  const getFileIcon = () => {
    if (!file) return <FileUp className="h-10 w-10 text-gray-400" />;
    
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      return <FileSpreadsheet className="h-10 w-10 text-green-600" />;
    } else if (fileName.endsWith('.xml')) {
      return <FileText className="h-10 w-10 text-blue-600" />;
    } else {
      return <FileText className="h-10 w-10 text-orange-600" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
          <input
            id="file-upload"
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.csv,.xml"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-blue-500 hover:text-blue-600"
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              {getFileIcon()}
              <span className="text-sm font-medium">
                {file ? file.name : "Click to select file"}
              </span>
            </div>
          </label>
        </div>
        {file && (
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
            <div className="flex items-center justify-between">
              <span>Selected file:</span>
              <span className="font-medium">{file.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Size:</span>
              <span>{(file.size / 1024).toFixed(2)} KB</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Type:</span>
              <span>{file.type || "Unknown"}</span>
            </div>
          </div>
        )}
        <div className="text-xs text-gray-500">
          <p>Supported file types: PDF, Word, Excel, CSV, XML</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleUpload}
          disabled={!file || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Extract Publications"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default FileUpload;
