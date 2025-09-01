"use client";

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConsoleOutputProps {
  logs: string[];
}

export function ConsoleOutput({ logs }: ConsoleOutputProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div>
       <h3 className="text-sm font-medium mb-2">Console</h3>
      <Card className="h-48">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <CardContent className="p-4">
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
