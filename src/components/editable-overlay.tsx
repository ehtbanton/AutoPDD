import React, { useState } from 'react';

interface EditableOverlayProps {
    sections: Array<{ id: string; content: string; x: number; y: number; width: number; height: number }>;
    onSave: (id: string, newContent: string) => void;
}

export const EditableOverlay: React.FC<EditableOverlayProps> = ({ sections, onSave }) => {
    const [editableSection, setEditableSection] = useState<string | null>(null);
    const [content, setContent] = useState('');

    const handleDoubleClick = (section: any) => {
        setEditableSection(section.id);
        setContent(section.content);
    };

    const handleSave = () => {
        if (editableSection) {
            onSave(editableSection, content);
            setEditableSection(null);
        }
    };

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            {sections.map((section) => (
                <div
                    key={section.id}
                    style={{
                        position: 'absolute',
                        left: `${section.x}%`,
                        top: `${section.y}%`,
                        width: `${section.width}%`,
                        height: `${section.height}%`,
                        border: '2px dashed blue',
                        cursor: 'pointer',
                    }}
                    onDoubleClick={() => handleDoubleClick(section)}
                >
                    {editableSection === section.id ? (
                        <div>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                style={{ width: '100%', height: '100%' }}
                            />
                            <button onClick={handleSave}>Save</button>
                        </div>
                    ) : (
                        <div style={{ padding: '5px', backgroundColor: 'rgba(255, 255, 255, 0.7)' }}>
                            {section.content}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};