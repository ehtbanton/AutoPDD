
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

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
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
