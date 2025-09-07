'use client';

import React from 'react';
import DocViewer, { DocViewerRenderers } from "react-doc-viewer";

type TemplateEditorProps = {
    file: Blob | null; // Accept a Blob representing the .docx file
};

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ file }) => {
    if (!file) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Upload a template to view it here.</p>
            </div>
        );
    }

    const docs = [{ uri: URL.createObjectURL(file), fileType: "docx" }];

    return (
        <div className="h-full">
            <DocViewer
                documents={docs}
                pluginRenderers={DocViewerRenderers}
                config={{
                    header: {
                        disableHeader: true,
                    },
                }}
            />
        </div>
    );
};