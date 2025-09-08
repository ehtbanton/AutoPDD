// src/components/context-viewer.tsx
import type { FC } from 'react';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContextFile } from '@/app/page';

import { Viewer, Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

interface ContextViewerProps {
    contextFile: ContextFile | undefined;
    contextFiles: ContextFile[];
    onContextSelect: (fileName: string) => void;
    onContextUpload: (files: FileList) => void;
}

export const ContextViewer: FC<ContextViewerProps> = ({ contextFile, contextFiles, onContextSelect, onContextUpload }) => {

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onContextUpload(event.target.files);
        }
    };

    return (
        <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <CardTitle>Context</CardTitle>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="context-upload" className="sr-only">Upload Context Files</Label>
                        <Input
                            id="context-upload"
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <Button asChild variant="outline" size="sm">
                            <Label htmlFor="context-upload" className="cursor-pointer">
                                Upload Context
                            </Label>
                        </Button>
                        <Select onValueChange={onContextSelect} value={contextFile?.name || ""}>
                            <SelectTrigger className="w-[180px] text-sm">
                                <SelectValue placeholder="View context file" />
                            </SelectTrigger>
                            <SelectContent>
                                {contextFiles.map((file) => (
                                    <SelectItem key={file.name} value={file.name}>
                                        {file.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
                {contextFile ? (
                    <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`}>
                        <Viewer fileUrl={new Uint8Array(contextFile.content)} />
                    </Worker>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No context file selected.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};