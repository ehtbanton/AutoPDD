"use client";

import type { ContextFile } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileQuestion, ChevronDown, File } from 'lucide-react';
import { useEffect, useState } from 'react';
import PdfViewer from './pdf-viewer'; // Import the new PdfViewer component
import { FileUploadButton } from './file-upload-button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';

interface ContextViewerProps {
    contextFile: ContextFile | undefined;
    onContextUpload: (files: FileList) => void;
    contextFiles: ContextFile[];
    selectedContextFile: ContextFile | undefined;
    onContextSelect: (fileName: string) => void;
}

export function ContextViewer({ contextFile, onContextUpload, contextFiles, selectedContextFile, onContextSelect }: ContextViewerProps) {
    const [fileUrl, setFileUrl] = useState<string>('');

    useEffect(() => {
        if (contextFile?.content) {
            const blob = new Blob([contextFile.content], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setFileUrl(url);

            return () => {
                URL.revokeObjectURL(url);
            };
        }
    }, [contextFile]);

    const getDisplayContent = () => {
        if (contextFile) {
            return <PdfViewer fileUrl={fileUrl} />;
        }
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <FileQuestion className="w-8 h-8 mb-2" />
                <p className="text-xs font-semibold">No context file selected</p>
                <p className="text-xs mt-1">Upload or select a file to view its content.</p>
            </div>
        );
    }

    return (
        <Card className="flex-grow flex flex-col min-h-0">
            <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="font-headline flex items-center gap-2 text-xl">
                        Context:
                    </CardTitle>
                    <div className="flex gap-2">
                        <FileUploadButton
                            onFileSelect={(files) => onContextUpload(files as FileList)}
                            variant="outline"
                            multiple
                            accept=".pdf"
                            size="sm"
                        >
                            <File className="mr-2 h-4 w-4" /> Upload
                        </FileUploadButton>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full justify-between" disabled={contextFiles.length === 0}>
                                    <span className="truncate">{selectedContextFile?.name || "Select a file"}</span>
                                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                {contextFiles.map((file) => <DropdownMenuItem key={file.name} onSelect={() => onContextSelect(file.name)}>{file.name}</DropdownMenuItem>)}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col min-h-0 p-0 px-4 pb-4">
                <ScrollArea className="flex-grow rounded-md border bg-white overflow-auto [&>div>div]:h-full [&>div>div>div]:h-full">
                    {getDisplayContent()}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}