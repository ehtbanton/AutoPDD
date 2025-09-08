// src/components/document-viewer-controls.tsx
import { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReloadIcon } from '@radix-ui/react-icons';

interface DocumentViewerControlsProps {
    onTemplateUpload: (file: File) => void;
    onFillDocument: () => void;
    isProcessing: boolean;
    onStop: () => void;
    templatePath: string;
}

export const DocumentViewerControls: FC<DocumentViewerControlsProps> = ({
    onTemplateUpload,
    onFillDocument,
    isProcessing,
    onStop,
    templatePath,
}) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            onTemplateUpload(event.target.files[0]);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Label htmlFor="template-upload" className="sr-only">Upload Template</Label>
            <Input
                id="template-upload"
                type="file"
                accept=".docx"
                onChange={handleFileChange}
                className="hidden"
            />
            <Button asChild variant="outline" size="sm">
                <Label htmlFor="template-upload" className="cursor-pointer">
                    {templatePath ? `Template: ${templatePath.substring(0, 20)}${templatePath.length > 20 ? '...' : ''}` : "Upload Template"}
                </Label>
            </Button>

            {isProcessing ? (
                <Button onClick={onStop} variant="destructive" size="sm">
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Stop
                </Button>
            ) : (
                <Button onClick={onFillDocument} disabled={!templatePath} size="sm">
                    Fill Document
                </Button>
            )}
        </div>
    );
};