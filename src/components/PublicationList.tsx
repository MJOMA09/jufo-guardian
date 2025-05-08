
import React, { useState } from "react";
import { Publication } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

interface PublicationListProps {
  publications: Publication[];
  onExport: () => void;
}

const PublicationList: React.FC<PublicationListProps> = ({ publications, onExport }) => {
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("none");

  const getJufoLevelColor = (level: number | null | undefined, evaluated: boolean = true): string => {
    if (!evaluated) return "bg-jufo-unknown";
    if (level === null || level === undefined) return "bg-jufo-unknown";
    return `bg-jufo-${level}`;
  };

  const getJufoLevelText = (publication: Publication): string => {
    // For unknown sources or empty sources
    if (!publication.source || publication.source.toLowerCase().includes("unknown")) {
      return "Not checked";
    }
    
    if (!publication.checked) return "Not checked";
    if (!publication.indexed) return "Not indexed";
    if (publication.evaluated === false) return "Not evaluated";
    
    return publication.jufoLevel !== null && publication.jufoLevel !== undefined
      ? publication.jufoLevel.toString()
      : "Unknown";
  };

  const getNorwegianLevelText = (publication: Publication): string => {
    // For unknown sources or empty sources
    if (!publication.source || publication.source.toLowerCase().includes("unknown")) {
      return "Not checked";
    }
    
    if (!publication.checked) return "Not checked";
    if (!publication.indexed) return "N/A";
    if (publication.evaluated === false) return "N/A";
    
    return publication.norwegianLevel !== null && publication.norwegianLevel !== undefined
      ? publication.norwegianLevel.toString()
      : "N/A";
  };

  const filteredPublications = publications.filter((pub) => {
    if (filterLevel === "all") return true;
    if (filterLevel === "notIndexed") return !pub.indexed;
    if (filterLevel === "pending") return !pub.checked;
    if (filterLevel === "notEvaluated") return pub.evaluated === false;
    return pub.jufoLevel?.toString() === filterLevel;
  });

  const sortedPublications = [...filteredPublications].sort((a, b) => {
    switch (sortBy) {
      case "yearAsc":
        return a.year - b.year;
      case "yearDesc":
        return b.year - a.year;
      case "jufoLevel":
        const aLevel = a.jufoLevel ?? -1;
        const bLevel = b.jufoLevel ?? -1;
        return bLevel - aLevel;
      case "source":
        return a.source.localeCompare(b.source);
      default:
        return 0;
    }
  });

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Publications ({publications.length})</CardTitle>
        <div className="flex space-x-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filter:</span>
            <Select
              value={filterLevel}
              onValueChange={setFilterLevel}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Publications</SelectItem>
                <SelectItem value="3">JUFO Level 3</SelectItem>
                <SelectItem value="2">JUFO Level 2</SelectItem>
                <SelectItem value="1">JUFO Level 1</SelectItem>
                <SelectItem value="0">JUFO Level 0</SelectItem>
                <SelectItem value="notEvaluated">Not Evaluated</SelectItem>
                <SelectItem value="notIndexed">Not Indexed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Sort:</span>
            <Select
              value={sortBy}
              onValueChange={setSortBy}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default</SelectItem>
                <SelectItem value="yearDesc">Year (Newest)</SelectItem>
                <SelectItem value="yearAsc">Year (Oldest)</SelectItem>
                <SelectItem value="jufoLevel">JUFO Level</SelectItem>
                <SelectItem value="source">Source Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {publications.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Authors</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>JUFO Level</TableHead>
                  <TableHead>Norwegian Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPublications.map((pub) => (
                  <TableRow key={pub.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {pub.authors}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={pub.title}>
                      {pub.title}
                    </TableCell>
                    <TableCell>{pub.year}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={pub.source}>
                      {pub.source}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={`${getJufoLevelColor(pub.jufoLevel, pub.evaluated)}`}
                        variant="outline"
                      >
                        {getJufoLevelText(pub)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getNorwegianLevelText(pub)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No publications added yet. Add publications manually or upload a document.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PublicationList;
