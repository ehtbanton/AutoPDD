// src/components/logs-viewer.tsx
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogsViewerProps {
    logs: string[];
}

export const LogsViewer: FC<LogsViewerProps> = ({ logs }) => {
    return (
        <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader>
                <CardTitle>Console Output</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-2">
                <ScrollArea className="h-full w-full rounded-md border p-4 text-sm bg-black text-green-400 font-mono">
                    {logs.map((log, index) => (
                        <p key={index} className="whitespace-pre-wrap">{log}</p>
                    ))}
                </ScrollArea>
            </CardContent>
        </Card>
    );
};