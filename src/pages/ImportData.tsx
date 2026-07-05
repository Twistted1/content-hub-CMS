import { useState, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, FileText, Database, CheckCircle, XCircle, ArrowRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ImportStep = "upload" | "mapping" | "preview" | "importing";

interface ParsedData {
  headers: string[];
  rows: string[][];
}

interface FieldMapping {
  source: string;
  target: string;
}

const POST_FIELDS = [
  { value: "title", label: "Title" },
  { value: "content", label: "Content" },
  { value: "scheduled_at", label: "Scheduled Date" },
  { value: "status", label: "Status" },
  { value: "type", label: "Type" },
  { value: "skip", label: "Skip this field" },
];

function parseCSV(text: string): ParsedData {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function parseJSON(text: string): ParsedData {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(arr[0]);
  const rows = arr.map(item => headers.map(h => String(item[h] ?? "")));
  return { headers, rows };
}

const ImportData = () => {
  const { user } = useAuth();
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importHistory, setImportHistory] = useState<Array<{
    fileName: string;
    records: number;
    status: "completed" | "failed";
    date: string;
  }>>([]);

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!["csv", "json"].includes(ext || "")) {
      toast.error("Unsupported file type. Please use CSV or JSON.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum 10MB.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = ext === "json" ? parseJSON(text) : parseCSV(text);

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error("File is empty or could not be parsed.");
        return;
      }

      setParsedData(parsed);
      setUploadedFile(file);

      // Auto-map columns by fuzzy matching
      const autoMappings = parsed.headers.map(header => {
        const lower = header.toLowerCase().replace(/[_\s-]/g, "");
        let target = "skip";
        if (lower.includes("title") || lower.includes("name") || lower.includes("subject")) target = "title";
        else if (lower.includes("content") || lower.includes("body") || lower.includes("text") || lower.includes("description")) target = "content";
        else if (lower.includes("date") || lower.includes("schedule") || lower.includes("publish")) target = "scheduled_at";
        else if (lower.includes("status")) target = "status";
        else if (lower.includes("type") || lower.includes("format")) target = "type";
        return { source: header, target };
      });

      setMappings(autoMappings);
      setImportStep("mapping");
      toast.success(`Parsed ${parsed.rows.length} records from ${file.name}`);
    } catch {
      toast.error("Failed to parse file. Please check the format.");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
  }, [handleFileUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
  }, [handleFileUpload]);

  const updateMapping = useCallback((sourceCol: string, newTarget: string) => {
    setMappings(prev => prev.map(m => m.source === sourceCol ? { ...m, target: newTarget } : m));
  }, []);

  const mappedFields = useMemo(() => mappings.filter(m => m.target !== "skip"), [mappings]);
  const hasTitleMapping = mappedFields.some(m => m.target === "title");

  const previewRows = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.rows.slice(0, 5).map(row => {
      const record: Record<string, string> = {};
      mappings.forEach((m, i) => {
        if (m.target !== "skip") record[m.target] = row[i] || "";
      });
      return record;
    });
  }, [parsedData, mappings]);

  const validRecords = useMemo(() => {
    if (!parsedData) return 0;
    const titleIdx = mappings.findIndex(m => m.target === "title");
    if (titleIdx === -1) return 0;
    return parsedData.rows.filter(row => row[titleIdx]?.trim()).length;
  }, [parsedData, mappings]);

  const handleImport = useCallback(async () => {
    if (!parsedData || !user) return;
    setImportStep("importing");
    setImportProgress(0);

    const titleIdx = mappings.findIndex(m => m.target === "title");
    const contentIdx = mappings.findIndex(m => m.target === "content");
    const scheduledIdx = mappings.findIndex(m => m.target === "scheduled_at");
    const statusIdx = mappings.findIndex(m => m.target === "status");
    const typeIdx = mappings.findIndex(m => m.target === "type");

    const validStatuses = ["draft", "scheduled", "published", "failed"];
    const validTypes = ["text", "image", "video", "carousel", "reel", "thread", "article"];

    const records = parsedData.rows
      .filter(row => titleIdx >= 0 && row[titleIdx]?.trim())
      .map(row => {
        const status = statusIdx >= 0 ? row[statusIdx]?.toLowerCase().trim() : "draft";
        const type = typeIdx >= 0 ? row[typeIdx]?.toLowerCase().trim() : "text";
        return {
          title: row[titleIdx].trim(),
          content: contentIdx >= 0 ? row[contentIdx] || null : null,
          scheduled_at: scheduledIdx >= 0 && row[scheduledIdx] ? new Date(row[scheduledIdx]).toISOString() : null,
          status: validStatuses.includes(status) ? status as "draft" | "scheduled" | "published" | "failed" : "draft",
          type: validTypes.includes(type) ? type as "text" | "image" | "video" | "carousel" | "reel" | "thread" | "article" : "text",
          user_id: user.id,
        };
      });

    const BATCH_SIZE = 100;
    let imported = 0;
    let failed = false;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("posts").insert(batch);

      if (error) {
        toast.error(`Batch failed: ${error.message}`);
        failed = true;
        break;
      }

      imported += batch.length;
      setImportProgress(Math.round((imported / records.length) * 100));
      await new Promise(r => setTimeout(r, 50));
    }

    setImportHistory(prev => [{
      fileName: uploadedFile?.name || "unknown",
      records: imported,
      status: failed ? "failed" : "completed",
      date: new Date().toLocaleDateString(),
    }, ...prev]);

    if (!failed) {
      toast.success(`Successfully imported ${imported} posts!`);
    }

    setImportStep("upload");
    setUploadedFile(null);
    setParsedData(null);
    setMappings([]);
    setImportProgress(0);
  }, [parsedData, mappings, user, uploadedFile]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-title mb-2">Import Data</h1>
          <p className="text-muted-foreground mt-1">
            Upload and import content from CSV or JSON files
          </p>
        </div>

        <Tabs defaultValue="import" className="space-y-6">
          <TabsList>
            <TabsTrigger value="import">New Import</TabsTrigger>
            <TabsTrigger value="history">Import History ({importHistory.length})</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-4 py-4">
              {(["upload", "mapping", "preview"] as const).map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      importStep === step || (importStep === "importing" && step === "preview")
                        ? "bg-primary text-primary-foreground"
                        : index < ["upload", "mapping", "preview"].indexOf(importStep)
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium capitalize">{step}</span>
                  {index < 2 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />}
                </div>
              ))}
            </div>

            {importStep === "upload" && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload File</CardTitle>
                  <CardDescription>Drag and drop your file or click to browse</CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                      isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                  >
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Drop your file here</h3>
                    <p className="text-muted-foreground mb-4">Supports CSV and JSON files up to 10MB</p>
                    <label>
                      <input type="file" accept=".csv,.json" onChange={handleFileInput} className="hidden" />
                      <Button variant="outline" asChild><span>Browse Files</span></Button>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium">CSV Files</p>
                        <p className="text-sm text-muted-foreground">Comma-separated values</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      <Database className="h-8 w-8 text-purple-600" />
                      <div>
                        <p className="font-medium">JSON Files</p>
                        <p className="text-sm text-muted-foreground">Structured data arrays</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {importStep === "mapping" && parsedData && (
              <Card>
                <CardHeader>
                  <CardTitle>Map Fields</CardTitle>
                  <CardDescription>Match source columns to post fields. "Title" is required.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {uploadedFile && (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      <span className="font-medium">{uploadedFile.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {parsedData.rows.length} rows · {parsedData.headers.length} columns
                      </Badge>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source Column</TableHead>
                        <TableHead>Sample Data</TableHead>
                        <TableHead>Maps To</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((mapping, idx) => (
                        <TableRow key={mapping.source}>
                          <TableCell className="font-mono text-sm">{mapping.source}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {parsedData.rows[0]?.[idx] || "—"}
                          </TableCell>
                          <TableCell>
                            <Select value={mapping.target} onValueChange={(v) => updateMapping(mapping.source, v)}>
                              <SelectTrigger className="w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {POST_FIELDS.map(f => (
                                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {mapping.target !== "skip" ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">Mapped</Badge>
                            ) : (
                              <Badge variant="outline">Skipped</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {!hasTitleMapping && (
                    <p className="text-sm text-destructive">⚠ You must map at least one column to "Title" to proceed.</p>
                  )}

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => { setImportStep("upload"); setParsedData(null); setUploadedFile(null); }}>
                      Back
                    </Button>
                    <Button onClick={() => setImportStep("preview")} disabled={!hasTitleMapping}>
                      Continue to Preview
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {importStep === "preview" && parsedData && (
              <Card>
                <CardHeader>
                  <CardTitle>Preview Import</CardTitle>
                  <CardDescription>Review your data before importing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{parsedData.rows.length}</p>
                      <p className="text-sm text-muted-foreground">Total Records</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{validRecords}</p>
                      <p className="text-sm text-muted-foreground">Valid Records</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold text-destructive">{parsedData.rows.length - validRecords}</p>
                      <p className="text-sm text-muted-foreground">Skipped (no title)</p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {mappedFields.map(m => (
                            <TableHead key={m.target}>{POST_FIELDS.find(f => f.value === m.target)?.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, i) => (
                          <TableRow key={i}>
                            {mappedFields.map(m => (
                              <TableCell key={m.target} className="max-w-[200px] truncate">
                                {row[m.target] || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">Showing first 5 of {parsedData.rows.length} records</p>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setImportStep("mapping")}>Back to Mapping</Button>
                    <Button onClick={handleImport} disabled={validRecords === 0}>
                      Import {validRecords} Posts
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {importStep === "importing" && (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                  <h3 className="text-lg font-medium">Importing data...</h3>
                  <Progress value={importProgress} className="max-w-md mx-auto" />
                  <p className="text-sm text-muted-foreground">{importProgress}% complete</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Import History</CardTitle>
                <CardDescription>View past imports from this session</CardDescription>
              </CardHeader>
              <CardContent>
                {importHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No imports yet. Start by uploading a file.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importHistory.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                              {item.fileName}
                            </div>
                          </TableCell>
                          <TableCell>{item.records.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {item.status === "completed" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <Badge variant={item.status === "completed" ? "default" : "destructive"}>{item.status}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Download Templates</CardTitle>
                <CardDescription>Use these CSV templates to format your data correctly</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { name: "Posts Template", description: "Import social media posts", headers: "title,content,scheduled_at,status,type" },
                    { name: "Blog Posts", description: "Import blog articles", headers: "title,content,scheduled_at,status\nMy First Post,Hello world!,2024-04-01,draft" },
                  ].map((template) => (
                    <div key={template.name} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{template.name}</h3>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const blob = new Blob([template.headers], { type: "text/csv" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${template.name.toLowerCase().replace(/\s/g, '-')}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ImportData;
