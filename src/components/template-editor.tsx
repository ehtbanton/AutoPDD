
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileUp } from 'lucide-react';

interface TemplateEditorProps {
  content: string;
}

export function TemplateEditor({ content }: TemplateEditorProps) {
  return (
    <Card className="h-full min-h-[80vh] flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">Template Document</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <ScrollArea className="flex-grow rounded-md border p-4 bg-white">
          {content ? (
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileUp className="w-16 h-16 mb-4" />
              <p>Press the template button on the left to get started...</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
