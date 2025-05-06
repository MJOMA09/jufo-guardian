
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { extractTextFromFile, extractPublicationsFromText } from "@/utils/document-processor";
import { Publication } from "@/types";
import { useToast } from "@/components/ui/use-toast";

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
      
      // Check if file is PDF or DOCX
      if (
        fileType === "application/pdf" ||
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Unsupported File Format",
          description: "Please upload a PDF or Word document (.docx) file.",
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
      const text = await extractTextFromFile(file);
      const publications = extractPublicationsFromText(text);
      
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
          description: `Successfully extracted ${publications.length} publications.`,
        });
        setFile(null);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "Processing Error",
        description: "An error occurred while processing the file.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-blue-500 hover:text-blue-600"
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm font-medium">
                {file ? file.name : "Click to select PDF or DOCX file"}
              </span>
            </div>
          </label>
        </div>
        {file && (
          <p className="text-sm text-gray-500 text-center">
            Selected: {file.name}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleUpload}
          disabled={!file || isLoading}
          className="w-full"
        >
          {isLoading ? "Processing..." : "Extract Publications"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default FileUpload;
