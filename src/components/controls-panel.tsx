
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConsoleOutput } from './console-output';
import { FileUploadButton } from './file-upload-button';
import { FileUp, File, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';
import type { ContextFile } from '@/app/page';

interface ControlsPanelProps {
  logs: string[];
  onTemplateUpload: (file: File) => void;
  onContextUpload: (files: FileList) => void;
  contextFiles: ContextFile[];
  selectedContextFile: ContextFile | undefined;
  onContextSelect: (fileName: string) => void;
}

export function ControlsPanel({
  logs,
  onTemplateUpload,
  onContextUpload,
  contextFiles,
  selectedContextFile,
  onContextSelect,
}: ControlsPanelProps) {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="font-headline text-xl">Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="space-y-2">
            <h3 className="text-sm font-medium mb-1">Upload Documents</h3>
            <div className="grid grid-cols-2 gap-2">
                <FileUploadButton
                    onFileSelect={(file) => onTemplateUpload(file as File)}
                    variant="outline"
                    accept=".docx"
                    size="sm"
                >
                    <FileUp className="mr-2 h-2 w-2" /> Template
                </FileUploadButton>
                <FileUploadButton
                    onFileSelect={(files) => onContextUpload(files as FileList)}
                    variant="outline"
                    multiple
                    size="sm"
                >
                    <File className="mr-2 h-2 w-2" /> Contexts
                </FileUploadButton>
            </div>
        </div>
        
        <div className="space-y-2">
            <h3 className="text-sm font-medium mb-1">Select Context File</h3>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between" disabled={contextFiles.length === 0}>
                        <span className="truncate">{selectedContextFile?.name || "Select a file"}</span>
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                    {contextFiles.map((file) => (
                        <DropdownMenuItem key={file.name} onSelect={() => onContextSelect(file.name)}>
                            {file.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        <Separator />

        <ConsoleOutput logs={logs} />
      </CardContent>
    </Card>
  );
}
