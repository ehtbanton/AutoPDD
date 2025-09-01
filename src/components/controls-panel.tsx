"use client";

import type { ContextFile } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ConsoleOutput } from './console-output';
import { FileUploadButton } from './file-upload-button';
import { FileUp, Files } from 'lucide-react';

interface ControlsPanelProps {
  contextFiles: ContextFile[];
  selectedContextFile: string;
  logs: string[];
  onTemplateUpload: (file: File) => void;
  onContextUpload: (files: FileList) => void;
  onContextSelect: (fileName: string) => void;
}

export function ControlsPanel({
  contextFiles,
  selectedContextFile,
  logs,
  onTemplateUpload,
  onContextUpload,
  onContextSelect,
}: ControlsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
            <h3 className="text-sm font-medium">Upload Documents</h3>
            <div className="grid grid-cols-2 gap-4">
                <FileUploadButton
                    onFileSelect={onTemplateUpload}
                    variant="outline"
                    accept=".txt,.md,.html"
                >
                    <FileUp className="mr-2 h-4 w-4" /> Template
                </FileUploadButton>
                <FileUploadButton
                    onFileSelect={onContextUpload}
                    multiple
                    variant="outline"
                    accept=".txt,.json,.yml"
                >
                    <Files className="mr-2 h-4 w-4" /> Context
                </FileUploadButton>
            </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Select Context</h3>
          <Select onValueChange={onContextSelect} value={selectedContextFile}>
            <SelectTrigger>
              <SelectValue placeholder="Select a context file..." />
            </SelectTrigger>
            <SelectContent>
              {contextFiles.map((file) => (
                <SelectItem key={file.name} value={file.name}>
                  {file.name}
                </SelectItem>
              ))}
              {contextFiles.length === 0 && <SelectItem value="-" disabled>No files available</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <ConsoleOutput logs={logs} />
      </CardContent>
    </Card>
  );
}
