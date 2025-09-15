'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import * as docx from 'docx-preview';
import { TemplateEditor } from '@/components/template-editor';
import { ContextViewer } from '@/components/context-viewer';
import { ControlsPanel } from '@/components/controls-panel';
import { SectionPanel } from '@/components/section-panel';
import { FileUploadButton } from '@/components/file-upload-button';
import { useToast } from "@/hooks/use-toast";
import { runPythonBackend, uploadContextFile, uploadTemplateFile, getExistingContextFiles, getTemplateName, getOutputFileAsBase64, resetTemplate, removeAllContexts, updateParagraph, fetchSections, processSection, processAllSections, reinitializeBackend, type SectionWithStatus } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Download } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';


export type ContextFile = {
    name: string;
    content: ArrayBuffer;
};

export type SectionStatus = {
    name: string;
    status: 'COMPLETE' | 'ATTEMPTED' | 'UNATTEMPTED';
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
    const [editingPara, setEditingPara] = useState<{ text: string; top: number; left: number, width: number; index: number } | null>(null);
    const [editedText, setEditedText] = useState('');
    const [sections, setSections] = useState<SectionStatus[]>([]);
    const [processingSectionIndex, setProcessingSectionIndex] = useState<number | null>(null);
    const [isRefreshingStatuses, setIsRefreshingStatuses] = useState<boolean>(false);

    const log = useCallback((message: string) => {
        const timedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
        setLogs((prevLogs) => [...prevLogs, timedMessage]);
        console.log(timedMessage);
    }, []);

    const loadSections = useCallback(async () => {
        try {
            log("Fetching section headings from template...");
            const sectionsFromBackend = await fetchSections();

            if (sectionsFromBackend.length > 0) {
                log(`Received ${sectionsFromBackend.length} sections from backend`);
                const sectionsWithStatus: SectionStatus[] = sectionsFromBackend.map(section => ({
                    name: section.name,
                    status: mapBackendStatusToFrontend(section.status)
                }));
                setSections(sectionsWithStatus);
                log(`Loaded ${sectionsFromBackend.length} sections from template. First section: "${sectionsWithStatus[0]?.name}" with status: ${sectionsWithStatus[0]?.status}`);
            } else {
                setSections([]);
                log("No sections found in template or backend not available.");
            }
        } catch (error) {
            console.error("Error loading sections:", error);
            log(`Error loading sections: ${error instanceof Error ? error.message : String(error)}`);
            setSections([]);
        }
    }, [log]);

    const mapBackendStatusToFrontend = (backendStatus: 'complete' | 'attempted' | 'untouched'): SectionStatus['status'] => {
        switch (backendStatus) {
            case 'complete':
                return 'COMPLETE';
            case 'attempted':
                return 'ATTEMPTED';
            case 'untouched':
            default:
                return 'UNATTEMPTED';
        }
    };

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
                await loadSections();
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
    }, [log, updateOutputViewer, loadSections]);

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

                // Reinitialize backend to refresh sections
                log("Reinitializing backend to detect sections...");
                const reinitResult = await reinitializeBackend(); // <-- Await this call

                if (reinitResult.success) {
                    log(`Backend reinitialized successfully. Found ${reinitResult.sections_count || 0} sections.`);
                    await loadSections(); // <-- Now this will get the new sections
                } else {
                    log(`Warning: Backend reinitialize failed: ${reinitResult.message}`);
                }

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

        log("Starting entire document processing...");
        setIsProcessing(true);

        // Set all sections to processing state
        setSections(prev => prev.map(section => ({ ...section, status: 'UNATTEMPTED' as const })));

        try {
            const result = await processAllSections();

            if (result.success) {
                // Mark all sections as complete on success
                setSections(prev => prev.map(section => ({ ...section, status: 'COMPLETE' as const })));
                log("Document processing completed successfully.");
            } else {
                // Mark all sections as attempted on failure
                setSections(prev => prev.map(section => ({ ...section, status: 'ATTEMPTED' as const })));
                log(`Document processing failed: ${result.message}`);
            }

            // Log any processing output from the backend
            if (result.log) {
                const logLines = result.log.split('\n').filter(line => line.trim());
                logLines.forEach(line => log(line));
            }

            // Update the output viewer after processing
            await updateOutputViewer();


            toast({
                title: result.success ? "Document Complete" : "Document Processing Failed",
                description: result.message,
                variant: result.success ? "default" : "destructive",
                className: result.success ? "bg-accent text-accent-foreground" : undefined,
            });

        } catch (error) {
            console.error("Error processing document:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            log(`Error: ${errorMessage}`);

            // Mark all sections as attempted on error
            setSections(prev => prev.map(section => ({ ...section, status: 'ATTEMPTED' as const })));

            toast({
                title: "Processing Error",
                description: "The document processing failed. Check the console for details.",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
            log("Document processing operation complete.");
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

    const handleResetTemplate = async () => {
        log("Resetting to blank template...");
        try {
            await resetTemplate();
            await updateOutputViewer();
            await loadSections(); // Reload sections after reset
            log("Template reset to blank.");
            toast({
                title: "Template Reset",
                description: "The document has been reset to its blank template.",
                variant: "default",
                className: "bg-accent text-accent-foreground",
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log(`Error resetting template: ${errorMessage}`);
            toast({
                title: "Reset Failed",
                description: "Could not reset the template.",
                variant: "destructive",
            });
        }
    }

    const handleRemoveAllContexts = async () => {
        log("Removing all context documents...");
        try {
            await removeAllContexts();
            setContextFiles([]);
            setSelectedContextFile(undefined);
            log("All context documents removed.");
            toast({
                title: "Contexts Removed",
                description: "All context documents have been removed.",
                variant: "default",
                className: "bg-accent text-accent-foreground",
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log(`Error removing contexts: ${errorMessage}`);
            toast({
                title: "Removal Failed",
                description: "Could not remove context documents.",
                variant: "destructive",
            });
        }
    }

    const handleDownloadDocument = async () => {
        if (!templateFile) {
            log("Error: No document to download.");
            toast({
                title: "Download Failed",
                description: "No document available to download.",
                variant: "destructive",
            });
            return;
        }

        try {
            log("Downloading Word document...");
            const url = URL.createObjectURL(templateFile);
            const link = document.createElement('a');
            link.href = url;
            link.download = templatePath || 'document.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            log("Document downloaded successfully.");
            toast({
                title: "Download Complete",
                description: "The Word document has been downloaded.",
                variant: "default",
                className: "bg-accent text-accent-foreground",
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log(`Error downloading document: ${errorMessage}`);
            toast({
                title: "Download Failed",
                description: "Could not download the document.",
                variant: "destructive",
            });
        }
    }

    const handleDocClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (editingPara) {
            handleCancelEdit();
            return;
        }

        const target = e.target as HTMLElement;
        const p = target.closest('p');
        if (p) {
            // Calculate paragraph index by counting all paragraphs before this one
            const container = scrollContainerRef.current!;
            const allParagraphs = container.querySelectorAll('p');
            let paragraphIndex = -1;

            for (let i = 0; i < allParagraphs.length; i++) {
                if (allParagraphs[i] === p) {
                    paragraphIndex = i;
                    break;
                }
            }

            const containerRect = container.getBoundingClientRect();
            const pRect = p.getBoundingClientRect();
            setEditingPara({
                text: p.innerText,
                top: pRect.top - containerRect.top + container.scrollTop,
                left: pRect.left - containerRect.left,
                width: pRect.width,
                index: paragraphIndex,
            });
            setEditedText(p.innerText);
        }
    };

    const handleSaveEdit = async () => {
        if (editingPara) {
            try {
                log(`Updating paragraph at index ${editingPara.index}: "${editingPara.text}" to "${editedText}"`);
                await updateParagraph(editingPara.index, editedText);
                log("Update successful. Refreshing viewer.");
                setEditingPara(null);
                await updateOutputViewer();
                toast({
                    title: "Update Successful",
                    description: "The paragraph has been updated.",
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log(`Error updating paragraph: ${errorMessage}`);
                toast({
                    title: "Update Failed",
                    description: "Could not update the paragraph.",
                    variant: "destructive",
                });
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingPara(null);
    };

    const handleRefreshStatuses = async () => {
        log("Refreshing section statuses...");
        setIsRefreshingStatuses(true);
        try {
            await loadSections();
            log("Section statuses refreshed successfully.");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log(`Error refreshing section statuses: ${errorMessage}`);
        } finally {
            setIsRefreshingStatuses(false);
        }
    };

    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };

    const handleSectionClick = useCallback((sectionIndex: number, sectionName: string) => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        log(`Searching for section: "${sectionName}"`);

        // Find all potential heading elements in the rendered document
        const allElements = scrollContainer.querySelectorAll('*');
        let potentialHeadings = Array.from(allElements).filter(el => {
            const text = el.textContent?.trim() || '';
            // Look for elements that contain text and might be headings
            return text.length > 0 && text.length < 200 && // Reasonable heading length
                   !el.querySelector('*'); // No child elements (leaf text nodes)
        });

        // Sort by position in document (vertical position)
        potentialHeadings.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            return rectA.top - rectB.top;
        });

        // Filter out table of contents entries by looking for multiple matches
        // If we find multiple instances of the same text, prefer the one that appears later (actual heading vs TOC)
        const textToElements = new Map<string, Element[]>();
        const normalizeText = (text: string) => {
            return text.toLowerCase()
                .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
                .replace(/\s+/g, ' ')     // Normalize whitespace
                .trim();
        };

        // Group elements by normalized text
        potentialHeadings.forEach(el => {
            const normalizedText = normalizeText(el.textContent?.trim() || '');
            if (!textToElements.has(normalizedText)) {
                textToElements.set(normalizedText, []);
            }
            textToElements.get(normalizedText)!.push(el);
        });

        // For each text, prefer the later occurrence (skip TOC entries)
        const filteredHeadings: Element[] = [];
        textToElements.forEach((elements, text) => {
            if (elements.length === 1) {
                // Only one instance, include it
                filteredHeadings.push(elements[0]);
            } else {
                // Multiple instances - prefer the one that's not in the first 20% of the document
                const containerHeight = scrollContainer.scrollHeight;
                const tocThreshold = containerHeight * 0.2; // First 20% likely contains TOC

                // Find elements that are past the TOC threshold
                const nonTocElements = elements.filter(el => {
                    const rect = el.getBoundingClientRect();
                    const containerRect = scrollContainer.getBoundingClientRect();
                    const elementTop = scrollContainer.scrollTop + rect.top - containerRect.top;
                    return elementTop > tocThreshold;
                });

                if (nonTocElements.length > 0) {
                    // Use the first non-TOC element
                    filteredHeadings.push(nonTocElements[0]);
                } else {
                    // Fall back to the last element (furthest down the document)
                    filteredHeadings.push(elements[elements.length - 1]);
                }
            }
        });

        potentialHeadings = filteredHeadings;
        log(`Found ${potentialHeadings.length} potential headings after filtering TOC duplicates`);

        const normalizedSectionName = normalizeText(sectionName);
        log(`Normalized section name: "${normalizedSectionName}"`);

        // Try different matching strategies
        let bestMatch: Element | null = null;
        let bestMatchScore = 0;

        for (const element of potentialHeadings) {
            const elementText = element.textContent?.trim() || '';
            const normalizedElementText = normalizeText(elementText);

            // Strategy 1: Exact match after normalization
            if (normalizedElementText === normalizedSectionName) {
                bestMatch = element;
                bestMatchScore = 100;
                log(`Found exact match: "${elementText}"`);
                break;
            }

            // Strategy 2: Section name is contained in element text
            if (normalizedElementText.includes(normalizedSectionName)) {
                const score = 80;
                if (score > bestMatchScore) {
                    bestMatch = element;
                    bestMatchScore = score;
                    log(`Found container match (${score}): "${elementText}"`);
                }
            }

            // Strategy 3: Element text is contained in section name
            if (normalizedSectionName.includes(normalizedElementText) && normalizedElementText.length > 3) {
                const score = 60;
                if (score > bestMatchScore) {
                    bestMatch = element;
                    bestMatchScore = score;
                    log(`Found contained match (${score}): "${elementText}"`);
                }
            }

            // Strategy 4: Word overlap (for complex headings)
            const sectionWords = normalizedSectionName.split(' ').filter(w => w.length > 2);
            const elementWords = normalizedElementText.split(' ').filter(w => w.length > 2);
            const commonWords = sectionWords.filter(w => elementWords.includes(w));

            if (commonWords.length > 0 && sectionWords.length > 0) {
                const score = (commonWords.length / sectionWords.length) * 40;
                if (score > bestMatchScore && score > 15) { // Only consider if significant overlap
                    bestMatch = element;
                    bestMatchScore = score;
                    log(`Found word overlap match (${score.toFixed(1)}): "${elementText}" (common words: ${commonWords.join(', ')})`);
                }
            }
        }

        if (bestMatch) {
            // Calculate the scroll position relative to the scroll container
            const headingRect = bestMatch.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const scrollTop = scrollContainer.scrollTop + headingRect.top - containerRect.top - 100; // Add some padding from the top

            // Scroll to the heading
            scrollContainer.scrollTo({
                top: Math.max(0, scrollTop), // Ensure we don't scroll to negative position
                behavior: 'smooth'
            });

            log(`✓ Navigated to section: "${sectionName}" (matched with: "${bestMatch.textContent?.trim()}", score: ${bestMatchScore})`);
        } else {
            log(`✗ Could not find section heading for: "${sectionName}"`);
            // Debug: log some potential headings for troubleshooting
            const sampleHeadings = potentialHeadings.slice(0, 5).map(el => el.textContent?.trim()).filter(t => t);
            if (sampleHeadings.length > 0) {
                log(`Available headings (sample): ${sampleHeadings.join(' | ')}`);
            }
        }
    }, [log]);

    const handleFillSection = async (sectionIndex: number) => {
        const section = sections[sectionIndex];
        log(`Processing section: ${section.name}`);
        setProcessingSectionIndex(sectionIndex);

        try {
            const result = await processSection(section.name);

            // Log any processing output from the backend
            if (result.log) {
                const logLines = result.log.split('\n').filter(line => line.trim());
                logLines.forEach(line => log(line));
            }

            // Update the output viewer after processing
            await updateOutputViewer();

            // Get the actual status from the updated document by re-fetching this specific section
            try {
                const sectionsFromBackend = await fetchSections();
                const updatedSection = sectionsFromBackend.find(s => s.name === section.name);
                if (updatedSection) {
                    const newStatus = mapBackendStatusToFrontend(updatedSection.status);
                    setSections(prev => prev.map((s, i) =>
                        i === sectionIndex ? { ...s, status: newStatus } : s
                    ));
                    log(`Section "${section.name}" status updated to: ${newStatus}`);
                } else {
                    // Fallback to API result if section not found
                    const fallbackStatus = result.success ? 'COMPLETE' as const : 'ATTEMPTED' as const;
                    setSections(prev => prev.map((s, i) =>
                        i === sectionIndex ? { ...s, status: fallbackStatus } : s
                    ));
                    log(`Section "${section.name}" status set to: ${fallbackStatus} (fallback)`);
                }
            } catch (statusError) {
                // If we can't get the status from backend, fall back to API result
                const fallbackStatus = result.success ? 'COMPLETE' as const : 'ATTEMPTED' as const;
                setSections(prev => prev.map((s, i) =>
                    i === sectionIndex ? { ...s, status: fallbackStatus } : s
                ));
                log(`Section "${section.name}" status set to: ${fallbackStatus} (error fallback)`);
            }

            toast({
                title: result.success ? "Section Complete" : "Section Processing Failed",
                description: result.message,
                variant: result.success ? "default" : "destructive",
                className: result.success ? "bg-accent text-accent-foreground" : undefined,
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log(`Error processing section "${section.name}": ${errorMessage}`);
            setSections(prev => prev.map((s, i) =>
                i === sectionIndex ? { ...s, status: 'ATTEMPTED' as const } : s
            ));
            toast({
                title: "Processing Error",
                description: `Could not process section "${section.name}".`,
                variant: "destructive",
            });
        } finally {
            setProcessingSectionIndex(null);
        }
    };


    return (
        <main className="h-full flex flex-col p-4 gap-4 bg-background">
            <header className="flex items-baseline mb-2">
                <h1 className="font-headline text-lg font-bold text-primary">
                    AutoPDD
                </h1>
                <p className="ml-4 text-sm text-muted-foreground">
                    Fill in your PDD automatically using a bundle of provided PDF files
                </p>
            </header>
            <div className="flex-grow grid grid-cols-1 xl:grid-cols-4 gap-4 min-h-0">
                <div className="xl:col-span-1 flex flex-col gap-2 min-h-0">
                    <ControlsPanel
                        logs={logs}
                        isProcessing={isProcessing}
                        onStop={handleStop}
                    />
                    <ContextViewer
                        contextFile={selectedContextFile}
                        onContextUpload={handleContextUpload}
                        contextFiles={contextFiles}
                        selectedContextFile={selectedContextFile}
                        onContextSelect={handleContextSelect}
                        onRemoveAllContexts={handleRemoveAllContexts}
                    />
                </div>
                <div className="xl:col-span-2 flex flex-col min-h-0">
                    {isDocx ? (
                        <Card className="flex-1 flex flex-col overflow-hidden">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>PDD Viewer</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={handleDownloadDocument}
                                            size="sm"
                                            variant="default"
                                            disabled={!templateFile}
                                        >
                                            <Download className="mr-2 h-4 w-4" /> Download Word Document
                                        </Button>
                                        <Button onClick={handleResetTemplate} size="sm" variant="destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Reset to Blank
                                        </Button>
                                        <FileUploadButton onFileSelect={handleTemplateUpload} size="sm" variant="outline">
                                            Upload Template
                                        </FileUploadButton>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent ref={scrollContainerRef} className="relative flex-1 overflow-y-auto p-4 bg-secondary" onClick={handleDocClick}>
                                <DocxViewer file={templateFile} scrollContainerRef={scrollContainerRef} />
                                {editingPara && (
                                    <div
                                        style={{ top: editingPara.top, left: editingPara.left, width: editingPara.width }}
                                        className="absolute z-10"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Textarea
                                            value={editedText}
                                            onChange={(e) => setEditedText(e.target.value)}
                                            onKeyDown={handleTextareaKeyDown}
                                            className="bg-white p-2 border border-gray-400 rounded-md shadow-lg w-full"
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2 mt-2">
                                            <Button onClick={handleSaveEdit} size="sm">Save (Enter)</Button>
                                            <Button onClick={handleCancelEdit} size="sm" variant="outline">Cancel (Esc)</Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <TemplateEditor content={''} />
                            <div className="p-4 border-t">
                                <FileUploadButton onFileSelect={handleTemplateUpload} size="sm" variant="outline">
                                    Upload Template
                                </FileUploadButton>
                            </div>
                        </div>
                    )}
                </div>
                <div className="xl:col-span-1 flex flex-col min-h-0">
                    <SectionPanel
                        sections={sections}
                        onFillSection={handleFillSection}
                        onFillDocument={handleFillDocument}
                        processingSectionIndex={processingSectionIndex}
                        isProcessingDocument={isProcessing}
                        onRefreshStatuses={handleRefreshStatuses}
                        isRefreshingStatuses={isRefreshingStatuses}
                        onSectionClick={handleSectionClick}
                    />
                </div>
            </div>
        </main>
    );
};

export default Page;