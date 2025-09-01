
"use client";

import type { ContextFile } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileQuestion } from 'lucide-react';

interface ContextViewerProps {
  contextFile: ContextFile | undefined;
}

export function ContextViewer({ contextFile }: ContextViewerProps) {
  return (
    <Card className="flex-grow flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          Context: 
          <span className="text-muted-foreground">{contextFile?.name || 'No file selected'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col min-h-0">
        <ScrollArea className="flex-grow rounded-md border p-4 bg-muted/20">
            {contextFile ? (
                <pre className="text-sm whitespace-pre-wrap font-code">{contextFile.content}</pre>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FileQuestion className="w-16 h-16 mb-4" />
                    <p>No context file selected.</p>
                    <p className="text-xs">Upload or select a file to view its content.</p>
                </div>
            )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
