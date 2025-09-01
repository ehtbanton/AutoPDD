
"use client";

import type { ContextFile } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileQuestion, Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ContextViewerProps {
  contextFile: ContextFile | undefined;
}

export function ContextViewer({ contextFile }: ContextViewerProps) {
    const [renderedContent, setRenderedContent] = useState<React.ReactNode>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (contextFile) {
            setIsLoading(true);
            setRenderedContent(null);
            
            const loadingTask = pdfjs.getDocument(contextFile.content);
            loadingTask.promise.then(async (pdf) => {
                const numPages = pdf.numPages;
                const textContents: React.ReactNode[] = [];

                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    textContents.push(<div key={`page_${i}`} className="p-4 border-b">{pageText}</div>);
                }

                setRenderedContent(textContents);
                setIsLoading(false);
            }).catch(error => {
                console.error("Error loading PDF:", error);
                setRenderedContent(<p className="p-4 text-destructive">Error rendering PDF.</p>);
                setIsLoading(false);
            });
        } else {
            setRenderedContent(null);
            setIsLoading(false);
        }
    }, [contextFile]);

    const getDisplayContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Loader className="w-12 h-12 mb-4 animate-spin" />
                    <p className="text-sm">Rendering PDF...</p>
                </div>
            );
        }
        if (renderedContent) {
            return <div className="prose max-w-none">{renderedContent}</div>;
        }
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileQuestion className="w-12 h-12 mb-2" />
                <p className="text-sm">No context file selected.</p>
                <p className="text-xs">Upload or select a file to view its content.</p>
            </div>
        );
    }

  return (
    <Card className="flex-grow flex flex-col min-h-0">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          Context: 
          <span className="text-muted-foreground">{contextFile?.name || 'No file selected'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col min-h-0">
        <ScrollArea className="flex-grow rounded-md border bg-white overflow-auto">
            {getDisplayContent()}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
