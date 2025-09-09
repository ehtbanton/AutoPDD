"use client";

import type { ContextFile } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileQuestion } from 'lucide-react';
import { useEffect, useState } from 'react';
import PdfViewer from './pdf-viewer'; // Import the new PdfViewer component

interface ContextViewerProps {
  contextFile: ContextFile | undefined;
}

export function ContextViewer({ contextFile }: ContextViewerProps) {
    const [fileUrl, setFileUrl] = useState<string>('');

    useEffect(() => {
        if (contextFile?.content) {
            const blob = new Blob([contextFile.content], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setFileUrl(url);

            return () => {
                URL.revokeObjectURL(url);
            };
        }
    }, [contextFile]);

    const getDisplayContent = () => {
        if (contextFile) {
            return <PdfViewer fileUrl={fileUrl} />;
        }
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <FileQuestion className="w-8 h-8 mb-2" />
                <p className="text-xs font-semibold">No context file selected</p>
                <p className="text-xs mt-1">Upload or select a file to view its content.</p>
            </div>
        );
    }

  return (
    <Card className="flex-grow flex flex-col min-h-0">
      <CardHeader className="p-4">
        <CardTitle className="font-headline flex items-center gap-2 text-xl">
          Context: 
          <span className="text-muted-foreground font-normal text-base">{contextFile?.name || 'No file selected'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col min-h-0 p-0 px-4 pb-4">
        <ScrollArea className="flex-grow rounded-md border bg-white overflow-auto [&>div>div]:h-full [&>div>div>div]:h-full">
            {getDisplayContent()}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}