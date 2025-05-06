
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { v4 as uuidv4 } from "uuid";
import { Publication } from "@/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface PublicationFormProps {
  onAddPublication: (publication: Publication) => void;
}

const PublicationForm: React.FC<PublicationFormProps> = ({ onAddPublication }) => {
  const [authors, setAuthors] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [source, setSource] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!authors.trim()) newErrors.authors = "Authors are required";
    if (!title.trim()) newErrors.title = "Title is required";
    if (!year || year < 1900 || year > new Date().getFullYear() + 1) {
      newErrors.year = "Please provide a valid year";
    }
    if (!source.trim()) newErrors.source = "Publication source is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      const newPublication: Publication = {
        id: uuidv4(),
        authors,
        title,
        year,
        source,
        jufoLevel: null,
        norwegianLevel: null,
        indexed: false,
        checked: false,
      };
      
      onAddPublication(newPublication);
      
      // Reset form
      setAuthors("");
      setTitle("");
      setYear(new Date().getFullYear());
      setSource("");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Publication Manually</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="authors" className="font-medium">
              Authors
            </Label>
            <Input
              id="authors"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="e.g., Smith, J., Johnson, A., & Brown, T."
              className={`${errors.authors ? "border-red-500" : ""}`}
            />
            {errors.authors && (
              <p className="text-sm text-red-500">{errors.authors}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title" className="font-medium">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Publication title"
              className={`${errors.title ? "border-red-500" : ""}`}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="year" className="font-medium">
              Year
            </Label>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              min={1900}
              max={new Date().getFullYear() + 1}
              className={`${errors.year ? "border-red-500" : ""}`}
            />
            {errors.year && (
              <p className="text-sm text-red-500">{errors.year}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="source" className="font-medium">
              Publication Source
            </Label>
            <Input
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Journal or conference name"
              className={`${errors.source ? "border-red-500" : ""}`}
            />
            {errors.source && (
              <p className="text-sm text-red-500">{errors.source}</p>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} className="w-full">
          Add Publication
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PublicationForm;
