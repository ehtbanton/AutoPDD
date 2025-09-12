"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { SectionStatus } from '@/app/page';

interface SectionPanelProps {
    sections: SectionStatus[];
    onFillSection: (sectionIndex: number) => void;
    processingSectionIndex: number | null;
}

export function SectionPanel({ sections, onFillSection, processingSectionIndex }: SectionPanelProps) {
    const getStatusIcon = (status: SectionStatus['status']) => {
        switch (status) {
            case 'COMPLETE':
                return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'ATTEMPTED':
                return <AlertCircle className="w-4 h-4 text-yellow-600" />;
            case 'UNATTEMPTED':
            default:
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusBadgeVariant = (status: SectionStatus['status']) => {
        switch (status) {
            case 'COMPLETE':
                return 'default';
            case 'ATTEMPTED':
                return 'secondary';
            case 'UNATTEMPTED':
            default:
                return 'outline';
        }
    };

    const getStatusText = (status: SectionStatus['status']) => {
        switch (status) {
            case 'COMPLETE':
                return 'Complete';
            case 'ATTEMPTED':
                return 'Attempted';
            case 'UNATTEMPTED':
            default:
                return 'Not Started';
        }
    };

    return (
        <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="p-4">
                <CardTitle className="font-headline flex items-center gap-2 text-xl">
                    Sections
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Fill individual sections or process the entire document
                </p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 p-0 px-4 pb-4">
                <ScrollArea className="flex-1 rounded-md border bg-white overflow-auto">
                    <div className="p-4 space-y-3">
                        {sections.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No sections detected</p>
                                <p className="text-xs mt-1">Upload a template to see sections</p>
                            </div>
                        ) : (
                            sections.map((section, index) => (
                                <div
                                    key={`section-${index}-${section.name}`}
                                    className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            {getStatusIcon(section.status)}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-sm leading-tight truncate" title={section.name}>
                                                    {section.name}
                                                </h4>
                                                <Badge
                                                    variant={getStatusBadgeVariant(section.status)}
                                                    className="text-xs mt-1"
                                                >
                                                    {getStatusText(section.status)}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button
                                            onClick={() => onFillSection(index)}
                                            size="sm"
                                            variant="outline"
                                            disabled={processingSectionIndex === index}
                                            className="text-xs"
                                        >
                                            {processingSectionIndex === index ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-3 h-3 mr-1" />
                                                    Fill Section
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}