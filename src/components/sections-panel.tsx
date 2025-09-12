'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, FileText } from 'lucide-react';

export type SectionStatus = 'SECTION_COMPLETE' | 'SECTION_ATTEMPTED' | 'PENDING';

export interface PDDSection {
    sectionHeading: string;
    subheading: string;
    subheadingIdx: string;
    pageNum: string;
    status: SectionStatus;
}

interface SectionsPanelProps {
    sections: PDDSection[];
    onFillEntireDocument: () => void;
    onFillSection: (section: PDDSection) => void;
    isProcessing: boolean;
    onStop: () => void;
    processingSection?: string;
}

const getStatusColor = (status: SectionStatus): string => {
    switch (status) {
        case 'SECTION_COMPLETE':
            return 'bg-green-500 hover:bg-green-600';
        case 'SECTION_ATTEMPTED':
            return 'bg-orange-500 hover:bg-orange-600';
        case 'PENDING':
        default:
            return 'bg-gray-400 hover:bg-gray-500';
    }
};

const getStatusText = (status: SectionStatus): string => {
    switch (status) {
        case 'SECTION_COMPLETE':
            return 'Complete';
        case 'SECTION_ATTEMPTED':
            return 'Attempted';
        case 'PENDING':
        default:
            return 'Pending';
    }
};

export function SectionsPanel({
    sections,
    onFillEntireDocument,
    onFillSection,
    isProcessing,
    onStop,
    processingSection,
}: SectionsPanelProps) {
    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Document Sections
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 flex-grow p-4 pt-0">
                {/* Fill Entire Document Button */}
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
                    <Button 
                        onClick={onFillEntireDocument} 
                        size="sm" 
                        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                        disabled={sections.length === 0}
                    >
                        Fill Entire Document
                    </Button>
                )}
                
                {/* Sections List */}
                <ScrollArea className="flex-grow">
                    <div className="space-y-2 pr-2">
                        {sections.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No sections found.</p>
                                <p className="text-sm">Upload a template document to see sections.</p>
                            </div>
                        ) : (
                            sections.map((section, index) => (
                                <div
                                    key={`${section.subheadingIdx}-${index}`}
                                    className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge 
                                                    className={`${getStatusColor(section.status)} text-white text-xs border-0`}
                                                >
                                                    {getStatusText(section.status)}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {section.subheadingIdx}
                                                </span>
                                            </div>
                                            <h4 className="font-medium text-sm leading-tight mb-1">
                                                {section.subheading}
                                            </h4>
                                            {section.sectionHeading !== section.subheading && (
                                                <p className="text-xs text-muted-foreground">
                                                    {section.sectionHeading}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <Button
                                        onClick={() => onFillSection(section)}
                                        disabled={
                                            isProcessing || 
                                            (processingSection === section.subheading)
                                        }
                                        size="sm"
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <Play className="h-3 w-3 mr-1" />
                                        {processingSection === section.subheading 
                                            ? 'Processing...' 
                                            : 'Process Section'
                                        }
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}