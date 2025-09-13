"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConsoleOutput } from '@/components/console-output';
import { Button } from './ui/button';

interface ControlsPanelProps {
    logs: string[];
    isProcessing: boolean;
    onStop: () => void;
}

export function ControlsPanel({
    logs,
    isProcessing,
    onStop,
}: ControlsPanelProps) {
    return (
        <Card className="flex-1 flex flex-col">
            <CardContent className="p-4 pt-0 flex-1 flex flex-col">
                {isProcessing && (
                    <div className="space-y-2 pt-4">
                        <h3 className="text-sm font-medium mb-1">Processing</h3>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={onStop}
                            className="w-full"
                        >
                            Stop Processing
                        </Button>
                    </div>
                )}

                {isProcessing && <Separator className="my-4" />}

                <div className="flex-1 flex flex-col">
                    <ConsoleOutput logs={logs} />
                </div>
            </CardContent>
        </Card>
    );
}