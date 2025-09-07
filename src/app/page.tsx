'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TemplateEditor } from '@/components/template-editor';
import { ContextViewer } from '@/components/context-viewer';
import { ControlsPanel } from '@/components/controls-panel';
import { useToast } from "@/hooks/use-toast";
import { runPythonBackend, uploadContextFile, uploadTemplateFile, getExistingContextFiles, getTemplateName, getOutputFileAsBase64 } from '@/app/actions';

export type ContextFile = {
    name: string;
    content: ArrayBuffer;
};

const initialLogs = [
    'Welcome to AutoPDD!',
    'Upload a Word document as a template and PDF files for context.',
];

const Page: FC = () => {
    const [templateFile, setTemplateFile] = useState<Blob | null>(null);
    const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
    const [selectedContextFile, setSelectedContextFile] = useState<ContextFile | undefined>(undefined);
    const [logs, setLogs] = useState<string[]>([]);
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const processingRef = useRef<boolean>(false);
    const [templatePath, setTemplatePath] = useState<string>('');
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const log = useCallback((message: string) => {
        const timedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
        setLogs((prevLogs) => [...prevLogs, timedMessage]);
        console.log(timedMessage);
    }, []);

    const updateOutputViewer = useCallback(async () => {
        try {
            const base64 = await getOutputFileAsBase64();

            // The crucial check: ensure the base64 string is not null and has content.
            if (base64 && base64.length > 0) {
                const fetchResponse = await fetch(`data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`);
                if (!fetchResponse.ok) {
                    // If the fetch fails, it means the base64 string was invalid.
                    throw new Error('Failed to parse Base64 data URI');
                }
                const blob = await fetchResponse.blob();

                // Also check if the resulting blob has a size.
                if (blob.size > 0) {
                    setTemplateFile(blob);
                } else {
                    // If the blob is empty, treat it as if there's no file.
                    setTemplateFile(null);
                }
            } else {
                // If the base64 is null or empty, there is no file to show.
                setTemplateFile(null);
            }
        } catch (error) {
            console.error("Failed to update output viewer:", error);
            // Set to null to avoid showing a broken viewer.
            setTemplateFile(null);
        }
    }, []);

    useEffect(() => {
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

        setLogs(initialLogs.map(l => `[${new Date().toLocaleTimeString()}] ${l}`));
        loadInitialData();
    }, [log, updateOutputViewer]);

    const handleTemplateUpload = async (file: File) => {
        log(`Uploading template "${file.name}"...`);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const buffer = Buffer.from(arrayBuffer);
            try {
                await uploadTemplateFile(file.name, buffer.toString('base64'));
                await updateOutputViewer();
                setTemplatePath(file.name);
                log(`Template "${file.name}" uploaded and output file created.`);
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
        reader.onerror = () => {
            log(`Error reading file: ${file.name}`);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleContextUpload = (files: FileList) => {
        log(`Attempting to upload ${files.length} context file(s)...`);
        const newFiles: ContextFile[] = [];
        let processedCount = 0;
        const fileArray = Array.from(files);

        fileArray.forEach(file => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result as ArrayBuffer;
                try {
                    const buffer = Buffer.from(content);
                    await uploadContextFile(file.name, buffer.toString('base64'));
                    log(`Successfully uploaded "${file.name}".`);
                    newFiles.push({ name: file.name, content: content.slice(0) });
                } catch (error) {
                    log(`Error uploading file "${file.name}": ${error}`);
                }
                processedCount++;
                if (processedCount === fileArray.length) {
                    setContextFiles(prevFiles => {
                        const updatedFiles = [...prevFiles];
                        newFiles.forEach(newFile => {
                            const existingIndex = updatedFiles.findIndex(f => f.name === newFile.name);
                            if (existingIndex !== -1) {
                                updatedFiles[existingIndex] = newFile;
                            } else {
                                updatedFiles.push(newFile);
                            }
                        });
                        return updatedFiles;
                    });

                    if (!selectedContextFile && newFiles.length > 0) {
                        setSelectedContextFile(newFiles[0]);
                    }
                    toast({
                        title: "Upload Complete",
                        description: `${newFiles.length} context files loaded.`,
                        variant: "default",
                    });
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const handleContextSelect = (fileName: string) => {
        const file = contextFiles.find(f => f.name === fileName);
        setSelectedContextFile(file);
    }

    const handleFillDocument = async () => {
        if (!templatePath) {
            log("Error: Please upload a template document first.");
            toast({ title: "Template Missing", variant: "destructive" });
            return;
        }
        log("Starting document processing...");
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
        } catch (error) {
            log(`Error: ${error}`);
        } finally {
            setIsProcessing(false);
            processingRef.current = false;
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
            await updateOutputViewer();
            log("Processing finished.");
        }
    };

    const handleStop = () => {
        log("Stopping processing...");
        processingRef.current = false;
    };

    return (
        <main className="h-full flex flex-col p-4 gap-4 bg-background">
            <header className="text-center lg:text-left">
                <h1 className="font-headline text-5xl font-bold text-primary">
                    AutoPDD
                </h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    Fill in your PDD automatically using a bundle of provided PDF files
                </p>
            </header>
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
                <div className="lg:col-span-1 flex flex-col gap-2 min-h-0">
                    <ControlsPanel
                        logs={logs}
                        onTemplateUpload={handleTemplateUpload}
                        onContextUpload={handleContextUpload}
                        contextFiles={contextFiles}
                        selectedContextFile={selectedContextFile}
                        onContextSelect={handleContextSelect}
                        onFillDocument={handleFillDocument}
                        isProcessing={isProcessing}
                        onStop={handleStop}
                    />
                    <ContextViewer contextFile={selectedContextFile} />
                </div>
                <div className="lg:col-span-2 flex flex-col min-h-0">
                    <TemplateEditor
                        file={templateFile}
                    />
                </div>
            </div>
        </main>
    );
};

export default Page;