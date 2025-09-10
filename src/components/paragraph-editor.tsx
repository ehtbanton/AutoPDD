'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ParagraphEditorProps {
    originalText: string;
    position: { top: number; left: number; width: number; height: number };
    onSave: (originalText: string, newText: string) => void;
    onClose: () => void;
}

export const ParagraphEditor: React.FC<ParagraphEditorProps> = ({ originalText, position, onSave, onClose }) => {
    const [text, setText] = useState(originalText);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Focus the textarea and select its content when it appears
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, []);

    // Handle clicks outside the component to close and save
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
                handleSave();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [originalText, text]); // Re-bind if text changes

    const handleSave = () => {
        if (text.trim() !== originalText.trim()) {
            onSave(originalText, text);
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Save on Enter, allow Shift+Enter for new lines
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        }
        // Close on Escape without saving
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: position.top,
                left: position.left,
                width: position.width,
                height: position.height,
                zIndex: 1000,
            }}
        >
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-full p-2 border border-blue-500 rounded-md shadow-lg resize-none"
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    boxSizing: 'border-box'
                }}
            />
        </div>
    );
};