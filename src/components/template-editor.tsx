"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface TemplateEditorProps {
  content: string;
  onContentChange: (content: string) => void;
}

export function TemplateEditor({ content, onContentChange }: TemplateEditorProps) {
  return (
    <Card className="h-full min-h-[80vh] flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">Template Document</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <Textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Your template content goes here..."
          className="w-full h-full flex-grow resize-none text-base leading-relaxed"
        />
      </CardContent>
    </Card>
  );
}
