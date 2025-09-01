
'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { TemplateEditor } from '@/components/template-editor';
import { ContextViewer } from '@/components/context-viewer';
import { ControlsPanel } from '@/components/controls-panel';
import { useToast } from "@/hooks/use-toast";
import mammoth from "mammoth";
import * as pdfjs from 'pdfjs-dist';
import { fillSection } from '@/ai/flows/fill-section-flow';

export type ContextFile = {
  name: string;
  content: ArrayBuffer;
  textContent: string;
};

const initialTemplateContent = ``;

const initialContextFiles: ContextFile[] = [];

const initialLogs = [
  'Welcome to AutoPDD!',
  'Upload a Word document as a template and PDF files for context.',
];

// Helper to find all indices of a substring
const getIndicesOf = (searchStr: string, str: string) => {
    const searchStrLen = searchStr.length;
    if (searchStrLen === 0) {
        return [];
    }
    let startIndex = 0;
    let index;
    const indices = [];
    while ((index = str.indexOf(searchStr, startIndex)) > -1) {
        indices.push(index);
        startIndex = index + searchStrLen;
    }
    return indices;
};


const Page: FC = () => {
  const [templateContent, setTemplateContent] = useState<string>(initialTemplateContent);
  const [templateText, setTemplateText] = useState<string>('');
  const [contextFiles, setContextFiles] = useState<ContextFile[]>(initialContextFiles);
  const [selectedContextFile, setSelectedContextFile] = useState<ContextFile | undefined>(undefined);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const log = useCallback((message: string) => {
    console.log(message);
    setLogs((prevLogs) => [...prevLogs, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);
  
  useEffect(() => {
    setLogs(initialLogs.map(l => `[${new Date().toLocaleTimeString()}] ${l}`));
  }, []);

  const handleTemplateUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
        .then(result => {
          setTemplateContent(result.value);
          log(`Template "${file.name}" uploaded successfully.`);
          toast({
              title: "Upload Successful",
              description: `Template "${file.name}" has been loaded.`,
              variant: "default",
              className: "bg-accent text-accent-foreground",
          });
        })
        .catch(error => {
            console.error(error);
            log(`Error processing Word document: ${file.name}`);
            toast({
                title: "Processing Failed",
                description: "Could not process the Word document.",
                variant: "destructive",
            });
        });
      
      mammoth.extractRawText({arrayBuffer: arrayBuffer})
        .then(result => {
            setTemplateText(result.value);
        });
    };
    reader.onerror = () => {
        log(`Error reading file: ${file.name}`);
        toast({
            title: "Upload Failed",
            description: `There was an error reading "${file.name}".`,
            variant: "destructive",
        });
    }
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
        
        // Extract text from PDF
        const loadingTask = pdfjs.getDocument(new Uint8Array(content));
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        let textContent = '';
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const pageTextContent = await page.getTextContent();
            textContent += pageTextContent.items.map((item: any) => item.str).join(' ');
        }

        newFiles.push({ name: file.name, content, textContent });
        log(`Successfully processed "${file.name}".`);
        
        processedCount++;
        if (processedCount === fileArray.length) {
            setContextFiles(prevFiles => {
                const updatedFiles = [...prevFiles];
                newFiles.forEach(newFile => {
                    const existingIndex = updatedFiles.findIndex(f => f.name === newFile.name);
                    if (existingIndex !== -1) {
                        log(`Replacing existing file: "${newFile.name}"`);
                        updatedFiles[existingIndex] = newFile; // Replace existing
                    } else {
                        updatedFiles.push(newFile); // Add new
                    }
                });
                return updatedFiles;
            });

          if (!selectedContextFile || contextFiles.length === 0) {
            setSelectedContextFile(newFiles[0]);
          }
          log(`${newFiles.length} context file(s) uploaded successfully.`);
          toast({
              title: "Upload Successful",
              description: `${newFiles.length} context file(s) have been loaded.`,
              variant: "default",
              className: "bg-accent text-accent-foreground",
          });
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
        if (processedCount === fileArray.length && newFiles.length > 0) {
            setContextFiles(prevFiles => {
                const updatedFiles = [...prevFiles];
                newFiles.forEach(newFile => {
                    const existingIndex = updatedFiles.findIndex(f => f.name === newFile.name);
                    if (existingIndex !== -1) {
                        log(`Replacing existing file: "${newFile.name}"`);
                        updatedFiles[existingIndex] = newFile;
                    } else {
                        updatedFiles.push(newFile);
                    }
                });
                return updatedFiles;
            });
            if (!selectedContextFile || contextFiles.length === 0) {
              setSelectedContextFile(newFiles[0]);
            }
          }
      }
      reader.readAsArrayBuffer(file);
    });
  };
  
  const handleContextSelect = (fileName: string) => {
    const file = contextFiles.find(f => f.name === fileName);
    setSelectedContextFile(file);
    if(file) {
        log(`Context file "${fileName}" selected.`);
    }
  }

  const retrieveContentsList = (text: string) => {
    const contentsStart = text.indexOf("Contents");
    const appendixStart = text.indexOf("Appendix");
    if (contentsStart === -1 || appendixStart === -1) {
        return "";
    }
    return text.substring(contentsStart, appendixStart).trim();
  };

  const getPddTargets = (contentsList: string) => {
      const targets: { sectionHeading: string, subheading: string, subheadingIdx: string, pageNum: string }[] = [];
      let sectionHeading = "";
      contentsList.split('\n').forEach(line => {
          if (line.trim() && !line.startsWith("Contents")) {
              const parts = line.split(/\s+/);
              if (parts.length > 2) {
                  if (!/^\d/.test(parts[0])) {
                      sectionHeading = parts.slice(1, -1).join(" ");
                  } else {
                      const subheading = parts.slice(1, -1).join(" ");
                      const subheadingIdx = parts[0];
                      const pageNum = parts[parts.length - 1];
                      targets.push({ sectionHeading, subheading, subheadingIdx, pageNum });
                  }
              }
          }
      });
      return targets;
  };
  
  const handleFillDocument = async () => {
    if (!templateText) {
        log("Please upload a template document first.");
        toast({ title: "Missing Template", description: "Upload a template before filling.", variant: "destructive" });
        return;
    }
    if (contextFiles.length === 0) {
        log("Please upload context documents first.");
        toast({ title: "Missing Context", description: "Upload context files before filling.", variant: "destructive" });
        return;
    }

    setIsProcessing(true);
    log("Starting document filling process...");

    const allContextText = contextFiles.map(f => `DOCUMENT: ${f.name}\n\n${f.textContent}`).join('\n\n---\n\n');
    const contentsList = retrieveContentsList(templateText);
    const pddTargets = getPddTargets(contentsList);
    
    let currentHtml = templateContent;

    for (let i = 0; i < pddTargets.length; i++) {
        const target = pddTargets[i];
        const startMarker = target.subheading;
        const endMarker = (i + 1 < pddTargets.length) ? pddTargets[i + 1].subheading : "Appendix";

        log(`Processing section: ${startMarker}`);
        
        const startIndices = getIndicesOf(startMarker, templateText);
        let startLoc = -1;
        
        // Find the correct start location by checking for surrounding newlines
        for(const index of startIndices) {
            const before = templateText.charAt(index - 1);
            const after = templateText.charAt(index + startMarker.length);
            if((before === '\n' || before === '') && (after === '\n' || after === '')) {
                startLoc = index;
                break;
            }
        }
        if (startLoc === -1) { // Fallback to first occurrence
            startLoc = templateText.indexOf(startMarker);
        }

        const endIndices = getIndicesOf(endMarker, templateText);
        let endLoc = -1;
        for(const index of endIndices) {
            const before = templateText.charAt(index - 1);
            const after = templateText.charAt(index + endMarker.length);
             if((before === '\n' || before === '') && (after === '\n' || after === '')) {
                endLoc = index;
                break;
            }
        }
        if (endLoc === -1) { // Fallback
            endLoc = templateText.indexOf(endMarker, startLoc);
        }
        
        if (startLoc === -1) {
            log(`Could not find start marker for section: ${startMarker}`);
            continue;
        }

        const infillingInfo = endLoc !== -1 ? templateText.substring(startLoc, endLoc) : templateText.substring(startLoc);
        
        try {
            const result = await fillSection({
                infillingInfo: infillingInfo,
                context: allContextText
            });

            if (result && result.filledSection) {
                 // To avoid replacing the wrong thing, we need to convert the plain text back to something that can be found in the HTML
                const originalHtmlSection = await mammoth.convert({
                    arrayBuffer: new TextEncoder().encode(infillingInfo).buffer
                }).then(r => r.value);
                
                const newHtmlSection = await mammoth.convert({
                    arrayBuffer: new TextEncoder().encode(result.filledSection).buffer
                }).then(r => r.value);

                // A bit of a hack to replace only the content inside the heading tag
                const startTag = `<h2>${startMarker}</h2>`;
                const endTag = `<h2>${endMarker}</h2>`;
                
                const sectionToReplace = currentHtml.substring(currentHtml.indexOf(startTag), currentHtml.indexOf(endTag, currentHtml.indexOf(startTag)));
                const newSection = newHtmlSection;

                // A simple replace might be too greedy if markers appear multiple times
                // So, let's create a more robust replacement strategy later if needed.
                // For now, let's try a simple replace.
                currentHtml = currentHtml.replace(sectionToReplace, newSection);

                setTemplateContent(currentHtml);
                log(`Successfully filled section: ${startMarker}`);
            } else {
                log(`Failed to fill section: ${startMarker}. No response from AI.`);
            }
        } catch (error) {
            log(`Error filling section ${startMarker}: ${error}`);
            toast({ title: "AI Error", description: `Failed to process section: ${startMarker}`, variant: "destructive" });
        }
    }

    log("Document filling process complete.");
    setIsProcessing(false);
  };

  return (
    <main className="h-full flex flex-col p-4 gap-4">
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
          />
          <ContextViewer contextFile={selectedContextFile} />
        </div>
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <TemplateEditor
            content={templateContent}
          />
        </div>
      </div>
    </main>
  );
};

export default Page;

    