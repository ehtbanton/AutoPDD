"use client";

import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { useEffect, useRef } from 'react';

interface PdfViewerProps {
    fileUrl: string;
    targetPageNumber?: number | null;
    onNavigationComplete?: () => void;
}

export default function PdfViewer({ fileUrl, targetPageNumber, onNavigationComplete }: PdfViewerProps) {
    const defaultLayoutPluginInstance = defaultLayoutPlugin();
    const hasNavigated = useRef(false);

    // Handle page navigation when target page changes
    useEffect(() => {
        if (targetPageNumber && targetPageNumber > 0 && !hasNavigated.current) {
            hasNavigated.current = true;

            // Small delay to ensure PDF is loaded before jumping to page
            const timer = setTimeout(() => {
                const pageIndex = targetPageNumber - 1; // Convert to 0-based index
                defaultLayoutPluginInstance.toolbarPluginInstance.jumpToPage(pageIndex);

                // Call the navigation complete callback
                if (onNavigationComplete) {
                    onNavigationComplete();
                }
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [targetPageNumber, onNavigationComplete, defaultLayoutPluginInstance]);

    // Reset navigation flag when target page is cleared
    useEffect(() => {
        if (!targetPageNumber) {
            hasNavigated.current = false;
        }
    }, [targetPageNumber]);

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
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
            <Viewer
                fileUrl={fileUrl}
                plugins={[defaultLayoutPluginInstance]}
            />
        </Worker>
    );
}