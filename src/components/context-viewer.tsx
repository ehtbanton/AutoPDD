'use client';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import type { FC } from 'react';

export type ContextFile = {
    name: string;
    content: ArrayBuffer;
};

interface ContextViewerProps {
    contextFile: ContextFile | undefined;
}

export const ContextViewer: FC<ContextViewerProps> = ({ contextFile }) => {
    return (
        <div className="flex-1 flex flex-col min-h-0 bg-secondary rounded-lg overflow-hidden">
            <div className="p-2 bg-muted">
                <h3 className="text-lg font-semibold text-foreground">
                    {contextFile ? contextFile.name : 'No file selected'}
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                {contextFile && (
                    <Worker workerUrl="/pdf.worker.min.js">
                        <Viewer fileUrl={new Uint8Array(contextFile.content)} />
                    </Worker>
                )}
            </div>
        </div>
    );
};