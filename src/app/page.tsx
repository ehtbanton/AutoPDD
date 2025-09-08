'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import * as docx from 'docx-preview';
import { TemplateEditor } from '@/components/template-editor';
import { ContextViewer } from '@/components/context-viewer'; // This will need updates
import { useToast } from "@/hooks/use-toast";
import { runPythonBackend, uploadContextFile, uploadTemplateFile, getExistingContextFiles, getTemplateName, getOutputFileAsBase64 } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogsViewer } from '@/components/logs-viewer'; // New component for logs only
import { DocumentViewerControls } from '@/components/document-viewer-controls'; // New component for template & fill buttons

export type ContextFile = {
    name: string;
    content: ArrayBuffer;
};

const initialLogs = [
    'Welcome to AutoPDD!',
    'Upload a Word document as a template and PDF files for context.',
];

const DocxViewer: FC<{ file: Blob | null, scrollContainerRef: React.RefObject<HTMLDivElement> }> = memo(({ file, scrollContainerRef }) => {
    const renderContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const renderContainer = renderContainerRef.current;
        const scrollContainer = scrollContainerRef.current;

        if (file && renderContainer && scrollContainer) {
            const savedScrollTop = scrollContainer.scrollTop;

            const tempRenderContainer = document.createElement('div');

            docx.renderAsync(file, tempRenderContainer)
                .then(() => {
                    console.log("Word document preview rendered.");
                    renderContainer.innerHTML = '';
                    renderContainer.appendChild(tempRenderContainer);
                    scrollContainer.scrollTop = savedScrollTop;
                })
                .catch((error) => {
                    console.error("Error rendering DOCX:", error);
                });
        }
    }, [file, scrollContainerRef]);

    return <div ref={renderContainerRef} className="bg-white shadow-lg mx-auto"></div>;
});
DocxViewer.displayName = 'DocxViewer';

const Page: FC = () => {
    const [templateFile, setTemplateFile] = useState<Blob | null>(null);
    const [isDocx, setIsDocx] = useState(false);
    const [lastTemplateBase64, setLastTemplateBase64] = useState<string | null>(null);
    const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
    const [selectedContextFile, setSelectedContextFile] = useState<ContextFile | undefined>(undefined);
    const [logs, setLogs] = useState<string[]>(initialLogs.map(l => `[${new Date().toLocaleTimeString()}] ${l}`));
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const processingRef = useRef<boolean>(false);
    const [templatePath, setTemplatePath] = useState<string>('');
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const initialLoadDone = useRef(false);

    const log = useCallback((message: string) => {
        const timedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
        setLogs((prevLogs) => [...prevLogs, timedMessage]);
        console.log(timedMessage);
    }, []);

    const updateOutputViewer = useCallback(async () => {
        try {
            const base64 = await getOutputFileAsBase64();
            if (base64 && base64.length > 0) {
                if (base64 !== lastTemplateBase64) {
                    setLastTemplateBase64(base64);
                    const fetchResponse = await fetch(`data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`);
                    if (!fetchResponse.ok) throw new Error('Failed to parse Base64 data URI');

                    const blob = await fetchResponse.blob();
                    if (blob.size > 0) {
                        setTemplateFile(blob);
                        const templateName = await getTemplateName();
                        setIsDocx(templateName ? templateName.toLowerCase().endsWith('.docx') : false);
                    }
                }
            } else {
                setTemplateFile(null);
            }
        } catch (error) {
            console.error("Failed to update output viewer:", error);
            setTemplateFile(null);
        }
    }, [lastTemplateBase64, setLastTemplateBase64, setTemplateFile, setIsDocx]);

    useEffect(() => {
        if (initialLoadDone.current) {
            return;
        }
        initialLoadDone.current = true;

        const loadInitialData = async () => {
            log("Checking for existing files...");
            await updateOutputViewer();
            const templateName = await getTemplateName();
            if (templateName) {
                setTemplatePath(templateName);
                log(`Found existing template: "${templateName}"`);
            }
            const existingContexts = await getExistingContextFiles();
            if (existingContexts.length > 0) {
                const files: ContextFile[] = existingContexts.map(f => {
                    const buffer = Buffer.from(f.content, 'base64');
                    return { name: f.name, content: buffer.buffer as ArrayBuffer };
                });
                setContextFiles(files);
                setSelectedContextFile(files[0]);
                log(`Loaded ${files.length} existing context file(s).`);
            }
        };
        loadInitialData();
    }, [log, updateOutputViewer]);

    const handleTemplateUpload = async (file: File) => {
        log(`Uploading template "${file.name}"...`);
        setIsDocx(file.name.toLowerCase().endsWith('.docx'));
        setTemplateFile(file);
        setLastTemplateBase64(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const buffer = Buffer.from(arrayBuffer);
            try {
                await uploadTemplateFile(file.name, buffer.toString('base64'));
                await updateOutputViewer();
                setTemplatePath(file.name);
                log(`Template "${file.name}" uploaded for processing.`);
                toast({
                    title: "Upload Successful",
                    description: `Template "${file.name}" has been loaded.`,
                    variant: "default",
                    className: "bg-accent text-accent-foreground",
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log(`Error uploading template: ${errorMessage}`);
                toast({
                    title: "Upload Failed",
                    description: "Could not save the template file.",
                    variant: "destructive",
                });
            }
        };
        reader.onerror = () => log(`Error reading file: ${file.name}`);
        reader.readAsArrayBuffer(file);
    };

    const handleContextUpload = (files: FileList) => {
        log(`Attempting to upload ${files.length} context file(s)...`);
        const newFiles: ContextFile[] = [];
        let processedCount = 0;
        const fileArray = Array.from(files);

        if (fileArray.length === 0) {
            log("No files selected for context upload.");
            return;
        }

        fileArray.forEach(file => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result as ArrayBuffer;

                try {
                    const buffer = Buffer.from(content);
                    await uploadContextFile(file.name, buffer.toString('base64'));
                    log(`Successfully uploaded and saved "${file.name}".`);

                    const contentCopy = content.slice(0);
                    const newFile = { name: file.name, content: contentCopy };
                    newFiles.push(newFile);

                } catch (error) {
                    console.error(`Error uploading context file "${file.name}":`, error);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    log(`Error uploading file "${file.name}": ${errorMessage}`);
                    toast({
                        title: "Upload Failed",
                        description: `Could not save "${file.name}" on the server.`,
                        variant: "destructive",
                    });
                }

                processedCount++;
                if (processedCount === fileArray.length) {
                    if (newFiles.length > 0) {
                        setContextFiles(prevFiles => {
                            const updatedFiles = [...prevFiles];
                            newFiles.forEach(newFile => {
                                const existingIndex = updatedFiles.findIndex(f => f.name === newFile.name);
                                if (existingIndex !== -1) {
                                    log(`Replacing existing file in UI: "${newFile.name}"`);
                                    updatedFiles[existingIndex] = newFile;
                                } else {
                                    updatedFiles.push(newFile);
                                }
                            });
                            return updatedFiles;
                        });

                        if (!selectedContextFile) {
                            setSelectedContextFile(newFiles[0]);
                        }

                        log(`${newFiles.length} context file(s) processed for UI.`);
                        toast({
                            title: "Upload Complete",
                            description: `${newFiles.length} context file(s) have been loaded.`,
                            variant: "default",
                            className: "bg-accent text-accent-foreground",
                        });
                    } else {
                        log(`No new context files were successfully uploaded.`);
                    }
                }
            };
            reader.onerror = (error) => {
                log(`Error reading file "${file.name}": ${error}`);
                toast({
                    title: "Upload Failed",
                    description: `There was an error reading "${file.name}".`,
                    variant: "destructive",
                });
                processedCount++;
            }
            reader.readAsArrayBuffer(file);
        });
    };

    const handleContextSelect = (fileName: string) => {
        const file = contextFiles.find(f => f.name === fileName);
        setSelectedContextFile(file);
        if (file) {
            log(`Context file "${fileName}" selected.`);
        }
    }

    const handleFillDocument = async () => {
        if (!templatePath) {
            log("Error: Please upload a template document first.");
            toast({
                title: "Template Missing",
                description: "You must upload a template .docx file before filling the document.",
                variant: "destructive",
            });
            return;
        }

        log("Starting document processing with Python backend...");
        setIsProcessing(true);
        processingRef.current = true;

        pollingIntervalRef.current = setInterval(updateOutputViewer, 3000);

        try {
            const stream = await runPythonBackend();
            const reader = stream.getReader();
            const decoder = new TextDecoder();

            while (processingRef.current) {
                const { value, done } = await reader.read();
                if (done) {
                    log("Python script finished.");
                    break;
                }
                const decodedChunk = decoder.decode(value, { stream: true });
                const lines = decodedChunk.split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    log(line);
                }
            }
            if (!processingRef.current) {
                log("Processing stopped by user.");
            }

        } catch (error) {
            console.error("Error running python backend: ", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            log(`Error: ${errorMessage}`);
            toast({
                title: "Backend Error",
                description: "The Python script failed to run. Check the console for details.",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
            processingRef.current = false;
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            log("Fetching final version of the document...");
            await updateOutputViewer();
            log("Document processing complete.");
        }
    };

    const handleStop = () => {
        log("Stop button pressed. Attempting to stop processing...");
        processingRef.current = false;
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    return (
        <main className="h-full flex flex-col p-4 gap-4 bg-background">
            <header className="flex items-baseline gap-4 text-center lg:text-left mb-4">
                <h1 className="font-display text-4xl font-bold text-primary whitespace-nowrap">
                    AutoPDD
                </h1>
                <p className="text-base text-muted-foreground flex-grow">
                    Fill in your PDD automatically using a bundle of provided PDF files
                </p>
            </header>
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
                <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
                    <LogsViewer logs={logs} /> {/* Now only displaying logs */}
                    <ContextViewer
                        contextFiles={contextFiles}
                        selectedContextFile={selectedContextFile}
                        onContextSelect={handleContextSelect}
                        onContextUpload={handleContextUpload}
                    />
                </div>
                <div className="lg:col-span-2 flex flex-col min-h-0">
                    {isDocx ? (
                        <Card className="flex-1 flex flex-col overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle>Document Viewer</CardTitle>
                                <DocumentViewerControls
                                    onTemplateUpload={handleTemplateUpload}
                                    onFillDocument={handleFillDocument}
                                    isProcessing={isProcessing}
                                    onStop={handleStop}
                                    templatePath={templatePath}
                                />
                            </CardHeader>
                            <CardContent ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 bg-secondary">
                                <DocxViewer file={templateFile} scrollContainerRef={scrollContainerRef} />
                            </CardContent>
                        </Card>
                    ) : (
                        <TemplateEditor
                            content={''}
                        />
                    )}
                </div>
            </div>
        </main>
    );
};

export default Page;