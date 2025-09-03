
"use client";

import type { ContextFile } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileQuestion, Loader } from 'lucide-react';
import { useEffect, useState } from 'react';


interface ContextViewerProps {
  contextFile: ContextFile | undefined;
}

export function ContextViewer({ contextFile }: ContextViewerProps) {
    const [renderedContent, setRenderedContent] = useState<React.ReactNode>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Define an async function to handle the PDF rendering
        const renderPdf = async () => {
            if (!contextFile) {
                setRenderedContent(null);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setRenderedContent(null);

            try {
                // Dynamically import pdfjs-dist ONLY on the client-side
                const pdfjs = await import('pdfjs-dist');

                // Set the worker source
                pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

                const loadingTask = pdfjs.getDocument(contextFile.content);
                const pdf = await loadingTask.promise;

                const numPages = pdf.numPages;
                const textContents: React.ReactNode[] = [];

                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    textContents.push(<div key={`page_${i}`} className="p-4 border-b">{pageText}</div>);
                }

                setRenderedContent(textContents);

            } catch (error) {
                console.error("Error loading PDF:", error);
                setRenderedContent(<p className="p-4 text-destructive">Error rendering PDF.</p>);
            } finally {
                setIsLoading(false);
            }
        };

        renderPdf(); // Call the async function

    }, [contextFile]);

    const getDisplayContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Loader className="w-8 h-8 mb-2 animate-spin" />
                    <p className="text-xs">Rendering PDF...</p>
                </div>
            );
        }
        if (renderedContent) {
            return <div className="prose max-w-none">{renderedContent}</div>;
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
