"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileUploadButton } from './file-upload-button';
import { FileUp, File, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';
import type { ContextFile } from '@/app/page';
import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ControlsPanelProps {
    logs: string[];
    onTemplateUpload: (file: File) => void;
    onContextUpload: (files: FileList) => void;
    contextFiles: ContextFile[];
    selectedContextFile: ContextFile | undefined;
    onContextSelect: (fileName: string) => void;
    onFillDocument: () => void;
    isProcessing: boolean;
    onStop: () => void;
}

export function ControlsPanel({
    logs,
    onTemplateUpload,
    onContextUpload,
    contextFiles,
    selectedContextFile,
    onContextSelect,
    onFillDocument,
    isProcessing,
    onStop,
}: ControlsPanelProps) {
    const viewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (viewportRef.current) {
            const viewport = viewportRef.current.querySelector(':scope > div');
            if (viewport) {
                viewport.scrollTop = 0; // Scroll to the top to show the latest message
            }
        }
    }, [logs]);

    return (
        <Card>
            <CardHeader className="p-4">
                <CardTitle className="font-headline text-xl">Control Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
                <div className="space-y-2">
                    <h3 className="text-sm font-medium mb-1">1. Upload Documents</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <FileUploadButton
                            onFileSelect={(file) => onTemplateUpload(file as File)}
                            variant="outline"
                            accept=".docx"
                            size="sm"
                        >
                            <FileUp className="mr-2 h-2 w-2" /> Template
                        </FileUploadButton>
                        <FileUploadButton
                            onFileSelect={(files) => onContextUpload(files as FileList)}
                            variant="outline"
                            multiple
                            accept=".pdf"
                            size="sm"
                        >
                            <File className="mr-2 h-2 w-2" /> Contexts
                        </FileUploadButton>
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-medium mb-1">2. Select Context File (Optional)</h3>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-between" disabled={contextFiles.length === 0}>
                                <span className="truncate">{selectedContextFile?.name || "Select a file"}</span>
                                <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                            {contextFiles.map((file) => (
                                <DropdownMenuItem key={file.name} onSelect={() => onContextSelect(file.name)}>
                                    {file.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-medium mb-1">3. Process Document</h3>
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

                <div>
                    <h3 className="text-sm font-medium mb-1">Console</h3>
                    <Card className="h-32">
                        <ScrollArea className="h-full" ref={viewportRef}>
                            <CardContent className="p-2">
                                <pre className="text-xs whitespace-pre-wrap">
                                    {logs.slice().reverse().map((log, index) => (
                                        <code key={index} className="font-code block animate-in fade-in duration-300">
                                            {log}
                                        </code>
                                    ))}
                                </pre>
                            </CardContent>
                        </ScrollArea>
                    </Card>
                </div>
            </CardContent>
        </Card>
    );
}