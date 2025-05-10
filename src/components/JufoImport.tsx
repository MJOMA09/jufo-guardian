
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, ArrowRight } from "lucide-react";
import { getDatabaseStats } from "@/utils/jufo-data";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";

const JufoImport: React.FC = () => {
  const navigate = useNavigate();
  const stats = getDatabaseStats();
  const hasData = stats.totalEntries > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="mr-2 h-5 w-5" />
          JUFO Reference Database
        </CardTitle>
        <CardDescription>
          Publication ranking data from the JUFO portal
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-4">
            <div>
              <p className="font-medium">Database Status: <span className="text-green-600">Active</span></p>
              <p className="text-sm text-muted-foreground">
                {stats.totalEntries} publications indexed ({stats.currentYearEntries} for {stats.latestYear})
              </p>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.level3}</div>
                <div className="text-xs text-muted-foreground">Level 3</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.level2}</div>
                <div className="text-xs text-muted-foreground">Level 2</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.level1}</div>
                <div className="text-xs text-muted-foreground">Level 1</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.level0}</div>
                <div className="text-xs text-muted-foreground">Level 0</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xl font-bold">{stats.notEvaluated}</div>
                <div className="text-xs text-muted-foreground">Not Evaluated</div>
              </div>
            </div>
            
            <Alert>
              <AlertDescription className="text-sm text-muted-foreground">
                <p>"Not evaluated" = Professional and general series and scientific channels that have not yet been evaluated.</p>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="text-center py-6">
            <Database className="h-10 w-10 text-muted-foreground mb-3 mx-auto" />
            <p className="text-sm text-muted-foreground mb-2">
              No JUFO database has been imported yet
            </p>
            <p className="text-xs text-muted-foreground">
              Contact an administrator to import JUFO data
            </p>
          </div>
        )}

        <div className="mt-4 text-right">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin')}
            className="text-xs"
          >
            Admin Access
            <ArrowRight className="ml-2 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default JufoImport;
