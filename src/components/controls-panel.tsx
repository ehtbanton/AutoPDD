"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConsoleOutput } from '@/components/console-output';

interface ControlsPanelProps {
    logs: string[];
}

export function ControlsPanel({
    logs,
}: ControlsPanelProps) {
    return (
        <Card className="flex flex-col h-full">
            <CardHeader>
                <CardTitle>Console Output</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 pt-0">
                <ConsoleOutput logs={logs} />
            </CardContent>
        </Card>
    );
}