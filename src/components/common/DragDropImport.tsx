import { useState, useRef, ReactNode } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface DragDropImportProps {
  onImport: (data: any) => void;
  validate?: (data: any) => boolean;
  children: ReactNode;
  className?: string;
  entityName?: string;
}

export function DragDropImport({
  onImport,
  validate,
  children,
  className,
  entityName,
}: DragDropImportProps) {
  const { t } = useTranslation();
  const resolvedEntityName = entityName ?? t("dragDropImport.defaultEntityName");
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        toast.error(t("dragDropImport.toastInvalidFileType"));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);

          // Detect Universal JSON Template (UJT)
          const isUJT = json.version === "1.0" && Array.isArray(json.items);

          if (isUJT) {
            toast.info(t("dragDropImport.toastTemplateDetected"));
            onImport(json);
            return;
          }

          if (validate && !validate(json)) {
            toast.error(t("dragDropImport.toastInvalidFormat", { entity: resolvedEntityName }));
            return;
          }
          onImport(json);
          toast.success(t("dragDropImport.toastImportedSuccess", { entity: resolvedEntityName }));
        } catch (error) {
          toast.error(t("dragDropImport.toastParseFailed"));
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div
      className={cn("relative min-h-full", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg">
          <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            <div className="p-4 rounded-full bg-primary/10 text-primary">
              <Upload className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-semibold">{t("dragDropImport.dropToImport", { entity: resolvedEntityName })}</h3>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
