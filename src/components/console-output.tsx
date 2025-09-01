"use client";

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConsoleOutputProps {
  logs: string[];
}

export function ConsoleOutput({ logs }: ConsoleOutputProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
        // Find the viewport element inside the scroll area
        const viewport = viewportRef.current.querySelector(':scope > div');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [logs]);

  return (
    <div>
       <h3 className="text-sm font-medium mb-1">Console</h3>
      <Card className="h-32">
        <ScrollArea className="h-full" ref={viewportRef}>
          <CardContent className="p-2">
            <pre className="text-xs whitespace-pre-wrap">
              {logs.map((log, index) => (
                <code key={index} className="font-code block animate-in fade-in duration-300">
                  {log}
                </code>
              ))}
            </pre>
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}
