"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConsoleOutput } from './console-output';
import { FileUploadButton } from './file-upload-button';
import { FileUp, File } from 'lucide-react';

interface ControlsPanelProps {
  logs: string[];
  onTemplateUpload: (file: File) => void;
  onContextUpload: (file: File) => void;
}

export function ControlsPanel({
  logs,
  onTemplateUpload,
  onContextUpload,
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
                    onFileSelect={(file) => onTemplateUpload(file as File)}
                    variant="outline"
                    accept=".txt,.md,.html"
                >
                    <FileUp className="mr-2 h-4 w-4" /> Template
                </FileUploadButton>
                <FileUploadButton
                    onFileSelect={(file) => onContextUpload(file as File)}
                    variant="outline"
                    accept=".txt,.json,.yml,.doc,.docx"
                >
                    <File className="mr-2 h-4 w-4" /> Context
                </FileUploadButton>
            </div>
        </div>

        <Separator />

        <ConsoleOutput logs={logs} />
      </CardContent>
    </Card>
  );
}
