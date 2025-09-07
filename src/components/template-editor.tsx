'use client';

import React from 'react';
import DocViewer, { DocViewerRenderers } from "react-doc-viewer";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, FileUp } from 'lucide-react';

type TemplateEditorProps = {
    file: Blob | null;
};

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ file }) => {
    // Create a URL from the blob. This will be unique for each version of the file.
    const fileUrl = file ? URL.createObjectURL(file) : null;
    const docs = fileUrl ? [{ uri: fileUrl, fileType: "docx" }] : [];

    return (
        <Card className="h-full flex flex-col flex-grow min-h-0">
            <CardHeader className="p-4">
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                    <FileText className="w-6 h-6 text-primary" />
                    Output Document
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col min-h-0 p-0 px-4 pb-4">
                <div className="flex-grow rounded-md border bg-white h-full">
                    {file ? (
                        <DocViewer
                            // Adding a key helps React re-render correctly when the file changes
                            key={fileUrl}
                            documents={docs}
                            pluginRenderers={DocViewerRenderers}
                            config={{
                                header: {
                                    disableHeader: true,
                                },
                            }}
                            className="h-full"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <FileUp className="w-12 h-12 mb-4" />
                            <p className="text-sm">Upload a template on the left to get started...</p>
                            <p className="text-xs mt-1">The generated document will appear here.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};