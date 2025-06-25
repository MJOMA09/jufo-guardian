
import React from "react";
import { Publication } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

interface ResultSummaryProps {
  publications: Publication[];
}

const ResultSummary: React.FC<ResultSummaryProps> = ({ publications }) => {
  const indexedCount = publications.filter(pub => pub.indexed).length;
  const notIndexedCount = publications.filter(pub => !pub.indexed && pub.checked).length;
  const pendingCount = publications.filter(pub => !pub.checked).length;
  const notEvaluatedCount = publications.filter(pub => pub.evaluated === false).length;
  
  const totalChecked = indexedCount + notIndexedCount;
  const indexedPercentage = totalChecked > 0 ? Math.round((indexedCount / totalChecked) * 100) : 0;

  if (publications.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Results Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{indexedCount}</div>
              <div className="text-sm text-muted-foreground">Indexed</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-600">{notIndexedCount}</div>
              <div className="text-sm text-muted-foreground">Not Indexed</div>
            </div>
          </div>
          
          {pendingCount > 0 && (
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
            </div>
          )}
          
          {notEvaluatedCount > 0 && (
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-yellow-600">{notEvaluatedCount}</div>
                <div className="text-sm text-muted-foreground">Not Evaluated</div>
              </div>
            </div>
          )}
        </div>
        
        {totalChecked > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Quality Rate:</span>
              <Badge 
                variant="outline" 
                className={indexedPercentage >= 70 ? "bg-green-100 text-green-800" : 
                           indexedPercentage >= 50 ? "bg-yellow-100 text-yellow-800" : 
                           "bg-red-100 text-red-800"}
              >
                {indexedPercentage}% Indexed
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalChecked} publications checked
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResultSummary;
