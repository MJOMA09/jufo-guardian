import React, { useState } from "react";
import { Publication } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, MoreHorizontal } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PublicationListProps {
  publications: Publication[];
  onExport: () => void;
}

const PublicationList: React.FC<PublicationListProps> = ({ publications, onExport }) => {
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("none");
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleViewDetails = (publication: Publication) => {
    setSelectedPublication(publication);
    setDialogOpen(true);
  };

  return (
    <>
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
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPublications.map((pub) => (
                    <TableRow key={pub.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span 
                                className="cursor-pointer hover:underline" 
                                onClick={() => handleViewDetails(pub)}
                              >
                                {pub.authors}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Click to view details</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell 
                        className="max-w-[200px] truncate cursor-pointer hover:underline" 
                        onClick={() => handleViewDetails(pub)}
                      >
                        {pub.title}
                      </TableCell>
                      <TableCell>{pub.year}</TableCell>
                      <TableCell 
                        className="max-w-[200px] truncate cursor-pointer hover:underline" 
                        onClick={() => handleViewDetails(pub)}
                      >
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
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleViewDetails(pub)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
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

      {/* Publication Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Publication Details</DialogTitle>
            <DialogDescription>
              Complete information about the publication
            </DialogDescription>
          </DialogHeader>
          
          {selectedPublication && (
            <div className="space-y-4 mt-2">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Title</h3>
                <p className="text-md break-words">{selectedPublication.title}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Authors</h3>
                <p className="text-md break-words">{selectedPublication.authors}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Year</h3>
                  <p>{selectedPublication.year}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Source</h3>
                  <p className="break-words">{selectedPublication.source}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">JUFO Level</h3>
                  <Badge 
                    className={`${getJufoLevelColor(selectedPublication.jufoLevel, selectedPublication.evaluated)}`}
                    variant="outline"
                  >
                    {getJufoLevelText(selectedPublication)}
                  </Badge>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Norwegian Level</h3>
                  <p>{getNorwegianLevelText(selectedPublication)}</p>
                </div>
              </div>
              
              {selectedPublication.issn && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">ISSN</h3>
                  <p>{selectedPublication.issn}</p>
                </div>
              )}
              
              {selectedPublication.isbn && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">ISBN</h3>
                  <p>{selectedPublication.isbn}</p>
                </div>
              )}
              
              {selectedPublication.doi && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">DOI</h3>
                  <p>
                    <a 
                      href={`https://doi.org/${selectedPublication.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {selectedPublication.doi}
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PublicationList;
