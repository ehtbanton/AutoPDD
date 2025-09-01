
'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { TemplateEditor } from '@/components/template-editor';
import { ContextViewer } from '@/components/context-viewer';
import { ControlsPanel } from '@/components/controls-panel';
import { useToast } from "@/hooks/use-toast";
import mammoth from "mammoth";
import * as pdfjs from 'pdfjs-dist';

export type ContextFile = {
  name: string;
  content: ArrayBuffer;
};

const initialTemplateContent = ``;

const initialContextFiles: ContextFile[] = [];

const initialLogs = [
  'Welcome to AutoPDD!',
  'Upload a Word document as a template and PDF files for context.',
];

const Page: FC = () => {
  const [templateContent, setTemplateContent] = useState<string>(initialTemplateContent);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>(initialContextFiles);
  const [selectedContextFile, setSelectedContextFile] = useState<ContextFile | undefined>(undefined);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

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
      reader.onload = (e) => {
        const content = e.target?.result as ArrayBuffer;
        newFiles.push({ name: file.name, content });
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
          />
          <ContextViewer contextFile={selectedContextFile} />
        </div>
        <div className="lg:col-span-2 flex flex-col">
          <TemplateEditor
            content={templateContent}
          />
        </div>
      </div>
    </main>
  );
};

export default Page;
