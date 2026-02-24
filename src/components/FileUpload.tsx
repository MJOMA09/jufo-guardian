
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { processFileAndExtractPublications } from "@/utils/document-processor";
import { Publication } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, FileText, FileUp, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FileUploadProps {
  onExtractPublications: (publications: Partial<Publication>[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onExtractPublications }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const extractingRef = useRef(false);
  const { toast } = useToast();

  // Security configuration
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/xml',
    'application/xml'
  ];

  const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.xml'];

  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { 
        isValid: false, 
        error: `File size exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
      };
    }

    // Check MIME type
    const hasMimeType = ALLOWED_MIME_TYPES.includes(file.type);
    
    // Check file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    
    if (!hasMimeType && !hasValidExtension) {
      return { 
        isValid: false, 
        error: 'Unsupported file format. Please upload PDF, Word, Excel, CSV, or XML files only.' 
      };
    }

    // Security check: warn about potentially risky files
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return { 
        isValid: false, 
        error: 'Invalid file name. File names cannot contain path characters.' 
      };
    }

    return { isValid: true };
  };

  const scanFileContent = async (file: File): Promise<{ isSafe: boolean; warning?: string }> => {
    // Basic content scanning for suspicious patterns
    try {
      const text = await file.text().catch(() => '');
      
      // Check for suspicious patterns (basic heuristics)
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /eval\(/i,
        /document\.write/i
      ];

      const foundSuspicious = suspiciousPatterns.some(pattern => pattern.test(text));
      
      if (foundSuspicious) {
        return { 
          isSafe: false, 
          warning: 'File contains potentially suspicious content. Please verify the source.' 
        };
      }

      return { isSafe: true };
    } catch {
      // If we can't scan the content, proceed with caution
      return { 
        isSafe: true, 
        warning: 'Could not verify file content. Proceeding with caution.' 
      };
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSecurityWarning(null);
    
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Validate file
      const validation = validateFile(selectedFile);
      if (!validation.isValid) {
        toast({
          title: "File Validation Failed",
          description: validation.error,
          variant: "destructive",
        });
        e.target.value = ''; // Clear the input
        return;
      }

      // Scan for suspicious content (for text-based files)
      if (selectedFile.type.startsWith('text/') || selectedFile.name.endsWith('.xml')) {
        const scanResult = await scanFileContent(selectedFile);
        if (!scanResult.isSafe) {
          setSecurityWarning(scanResult.warning || 'File flagged as potentially unsafe');
          toast({
            title: "Security Warning",
            description: scanResult.warning,
            variant: "destructive",
          });
          e.target.value = ''; // Clear the input
          return;
        } else if (scanResult.warning) {
          setSecurityWarning(scanResult.warning);
        }
      }

      setFile(selectedFile);
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

    if (extractingRef.current) {
      toast({
        title: "Extraction In Progress",
        description: "Please wait for the current extraction to finish.",
      });
      return;
    }

    // Final security check
    const validation = validateFile(file);
    if (!validation.isValid) {
      toast({
        title: "Security Check Failed",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    extractingRef.current = true;
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
        description: `An error occurred while processing ${file.name}. Please verify the file is not corrupted.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      extractingRef.current = false;
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
        {securityWarning && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> {securityWarning}
            </AlertDescription>
          </Alert>
        )}
        
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
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>Supported file types: PDF, Word, Excel, CSV, XML</p>
          <p>Maximum file size: 10MB</p>
          <p>Files are processed locally and not stored on any server</p>
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
