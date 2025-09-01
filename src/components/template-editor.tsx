
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileUp } from 'lucide-react';

interface TemplateEditorProps {
  content: string;
}

export function TemplateEditor({ content }: TemplateEditorProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-4">
        <CardTitle className="font-headline text-xl">Template Document</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col min-h-0 p-0 px-4 pb-4">
        <ScrollArea className="flex-grow rounded-md border bg-white [&>div>div]:h-full">
          {content ? (
            <div
              className="prose max-w-none p-4"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileUp className="w-12 h-12 mb-4" />
              <p className="text-sm">Press the template button on the left to get started...</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
