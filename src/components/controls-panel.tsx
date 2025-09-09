"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConsoleOutput } from '@/components/console-output';
import { Button } from './ui/button';

interface ControlsPanelProps {
    logs: string[];
    onFillDocument: () => void;
    isProcessing: boolean;
    onStop: () => void;
}

export function ControlsPanel({
    logs,
    onFillDocument,
    isProcessing,
    onStop,
}: ControlsPanelProps) {
    return (
        <Card>
            <CardContent className="space-y-4 p-4 pt-0">
                <div className="space-y-2 pt-4">
                    <h3 className="text-sm font-medium mb-1">Process Document</h3>
                    {isProcessing ? (
                        <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" disabled>
                                Processing...
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onStop}
                            >
                                Stop
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={onFillDocument} size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                            Fill Document
                        </Button>
                    )}
                </div>

                <Separator />

                <ConsoleOutput logs={logs} />
            </CardContent>
        </Card>
    );
}