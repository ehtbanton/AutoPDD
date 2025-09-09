"use client";

import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

interface PdfViewerProps {
    fileUrl: string;
}

export default function PdfViewer({ fileUrl }: PdfViewerProps) {
    // If no file URL is provided, display a placeholder message
    if (!fileUrl) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                backgroundColor: '#f8f9fa',
                color: '#6c757d',
                border: '2px dashed #dee2e6',
                borderRadius: '8px',
            }}>
                <p>Upload a PDF to see it here!</p>
            </div>
        );
    }

    return (
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`}>
            <Viewer fileUrl={fileUrl} />
        </Worker>
    );
}