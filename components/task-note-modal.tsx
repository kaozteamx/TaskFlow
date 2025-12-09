import React, { useState, useEffect } from 'react';
import { StickyNote, AlignLeft, Heading1, Heading2, CheckSquare, List, ListOrdered, Clock, CalendarDays, Outdent, Indent, X, Square } from 'lucide-react';

export const TaskNoteModal = ({ isOpen, onClose, task, onUpdateNote, isDark }: any) => {
    const [lines, setLines] = useState<string[]>([]);
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashMenuIndex, setSlashMenuIndex] = useState(-1);
    const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
    const [slashSelection, setSlashSelection] = useState(0);
    const [focusedLineIndex, setFocusedLineIndex] = useState<number>(-1);

    const BLOCK_TYPES = [
        { id: 'text', label: 'Texto', icon: AlignLeft, prefix: '' },
        { id: 'h1', label: 'Título 1', icon: Heading1, prefix: '# ' },
        { id: 'h2', label: 'Título 2', icon: Heading2, prefix: '## ' },
        { id: 'todo', label: 'Lista Tarea', icon: CheckSquare, prefix: '[ ] ' },
        { id: 'bullet', label: 'Lista Viñetas', icon: List, prefix: '- ' },
        { id: 'number', label: 'Lista Numerada', icon: ListOrdered, prefix: '1. ' },
        { id: 'time', label: 'Hora Actual', icon: Clock, prefix: 'TIME' },
        { id: 'date', label: 'Fecha Actual', icon: CalendarDays, prefix: 'DATE' },
    ];

    useEffect(() => {
        if (task && isOpen) {
            setLines((task.noteContent || '').split('\n'));
        }
    }, [task, isOpen]);

    if (!isOpen || !task) return null;

    const handleSaveAndClose = () => {
        onUpdateNote(task.id, lines.join('\n'));
        onClose();
    };

    const updateLine = (index: number, val: string) => {
        const newLines = [...lines];
        newLines[index] = val;
        setLines(newLines);

        // Check for Slash Command
        // Ensure menu opens even if val was empty before and now is '/'
        if (val === '/') {
            const inputEl = document.getElementById(`note-line-${index}`);
            if (inputEl) {
                const rect = inputEl.getBoundingClientRect();
                setSlashMenuPosition({ top: rect.bottom + 5, left: rect.left });
                setSlashMenuIndex(index);
                setSlashMenuOpen(true);
                setSlashSelection(0);
            }
        } else {
            setSlashMenuOpen(false);
        }
    };

    const toggleCheck = (index: number) => {
        const line = lines[index];
        const newLines = [...lines];
        
        // Need to preserve indentation
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[0] : '';
        const trimmed = line.substring(indent.length);
        
        if (trimmed.startsWith('[ ] ')) newLines[index] = indent + trimmed.replace('[ ] ', '[x] ');
        else if (trimmed.startsWith('[x] ')) newLines[index] = indent + trimmed.replace('[x] ', '[ ] ');
        setLines(newLines);
    };

    const applyBlockType = (type: any) => {
        const newLines = [...lines];
        if (type.id === 'time') {
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} `;
            // Append time to existing content if needed, but usually slash command replaces the slash
            const currentLine = newLines[slashMenuIndex];
            // Remove the slash if it's there
            const cleanLine = currentLine.endsWith('/') ? currentLine.slice(0, -1) : currentLine;
            newLines[slashMenuIndex] = cleanLine + timeStr;
        } else if (type.id === 'date') {
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-ES') + ' ';
            const currentLine = newLines[slashMenuIndex];
            const cleanLine = currentLine.endsWith('/') ? currentLine.slice(0, -1) : currentLine;
            newLines[slashMenuIndex] = cleanLine + dateStr;
        } else {
            // Keep existing indentation if plausible, or just reset to prefix
            newLines[slashMenuIndex] = type.prefix;
        }
        setLines(newLines);
        setSlashMenuOpen(false);
        setTimeout(() => document.getElementById(`note-line-${slashMenuIndex}`)?.focus(), 0);
    };

    const changeIndentation = (direction: number) => {
        if (focusedLineIndex < 0 || focusedLineIndex >= lines.length) return;
        const currentLine = lines[focusedLineIndex];
        const newLines = [...lines];
        
        if (direction > 0) {
            // Indent
            newLines[focusedLineIndex] = '  ' + currentLine;
        } else {
            // Outdent
            if (currentLine.startsWith('  ')) {
                newLines[focusedLineIndex] = currentLine.substring(2);
            } else if (currentLine.startsWith(' ')) {
                // Handle single space edge case
                newLines[focusedLineIndex] = currentLine.substring(1);
            }
        }
        setLines(newLines);
        setTimeout(() => document.getElementById(`note-line-${focusedLineIndex}`)?.focus(), 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        // Handle Slash Menu Navigation
        if (slashMenuOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSlashSelection(prev => (prev + 1) % BLOCK_TYPES.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSlashSelection(prev => (prev - 1 + BLOCK_TYPES.length) % BLOCK_TYPES.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                applyBlockType(BLOCK_TYPES[slashSelection]);
            } else if (e.key === 'Escape') {
                setSlashMenuOpen(false);
            }
            return;
        }

        const currentLine = lines[index];
        const inputEl = e.currentTarget;

        if (e.key === 'Enter') {
            e.preventDefault();
            const newLines = [...lines];
            
            // Analyze indentation and prefix
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[0] : '';
            
            // Simple Enter: Just new line with same indentation, no auto-formatting
            const nextLinePrefix = indent;
            
            newLines.splice(index + 1, 0, nextLinePrefix);
            setLines(newLines);
            setTimeout(() => document.getElementById(`note-line-${index + 1}`)?.focus(), 0);
        } else if (e.key === 'Backspace') {
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[0] : '';
            
            // Notepad Style Backspace:
            // If cursor is at the very beginning of the line (index 0) and it's not the first line,
            // merge with the previous line.
            if (inputEl.selectionStart === 0 && inputEl.selectionEnd === 0 && index > 0) {
                 e.preventDefault();
                 const prevLine = lines[index - 1];
                 const newLines = [...lines];
                 
                 // Merge content
                 newLines[index - 1] = prevLine + currentLine;
                 newLines.splice(index, 1);
                 setLines(newLines);
                 
                 // Set focus and cursor position to where the lines merged
                 setTimeout(() => {
                    const prevInput = document.getElementById(`note-line-${index - 1}`) as HTMLInputElement;
                    if (prevInput) {
                        prevInput.focus();
                        prevInput.setSelectionRange(prevLine.length, prevLine.length);
                    }
                 }, 0);
                 return;
            }

            const trimmed = currentLine.substring(indent.length);

            // Special Case: Remove formatting if cursor is just after it and content is empty
            if (trimmed === '' && indent.length >= 2 && inputEl.selectionStart === indent.length) {
                 e.preventDefault();
                 changeIndentation(-1);
                 return;
            }
            
            // Remove block prefixes if empty content and cursor is at end of prefix
            if ((trimmed === '[ ] ' || trimmed === '[x] ' || trimmed === '- ' || trimmed === '# ' || trimmed === '## ') && inputEl.selectionStart === currentLine.length) {
                 e.preventDefault();
                 updateLine(index, indent); // Keep indent, remove prefix
                 return;
            }
        } else if (e.key === 'ArrowUp' && index > 0) {
            e.preventDefault();
            document.getElementById(`note-line-${index - 1}`)?.focus();
        } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
             e.preventDefault();
            document.getElementById(`note-line-${index + 1}`)?.focus();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) changeIndentation(-1);
            else changeIndentation(1);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95" onClick={handleSaveAndClose}>
            <div className={`w-full max-w-4xl h-[85vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-[#18181b] border-zinc-700' : 'bg-white border-gray-200'}`} onClick={e => e.stopPropagation()}>
                <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <StickyNote className={isDark ? 'text-amber-500' : 'text-amber-600'} size={20} />
                        <div><h3 className={`text-base font-bold line-clamp-1 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{task.title}</h3></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1 mr-2 border-r pr-2 ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
                            <button onClick={() => changeIndentation(-1)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100' : 'hover:bg-gray-200 text-gray-500'}`} title="Disminuir sangría"><Outdent size={16}/></button>
                            <button onClick={() => changeIndentation(1)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100' : 'hover:bg-gray-200 text-gray-500'}`} title="Aumentar sangría"><Indent size={16}/></button>
                        </div>
                        <button onClick={handleSaveAndClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100' : 'hover:bg-gray-200 text-gray-500'}`}><X size={20}/></button>
                    </div>
                </div>
                
                <div className={`flex-1 overflow-y-auto p-8 custom-scrollbar space-y-1 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                    {lines.map((line, index) => {
                        let renderContent = null;
                        let lineClass = "flex items-start gap-2 group min-h-[28px]";
                        let inputClass = `flex-1 bg-transparent border-none outline-none font-sans text-base py-0.5 leading-relaxed ${isDark ? 'text-zinc-200' : 'text-gray-800'}`;
                        
                        // Parse Indentation
                        const indentMatch = line.match(/^(\s*)/);
                        const indentStr = indentMatch ? indentMatch[0] : '';
                        const indentLevel = Math.floor(indentStr.length / 2);
                        const trimmedLine = line.substring(indentStr.length);
                        
                        let value = trimmedLine;
                        let prefixLength = 0; // Relative to trimmedLine

                        if (trimmedLine.startsWith('# ')) {
                            inputClass += " text-3xl font-bold mt-2 mb-1";
                            value = trimmedLine.substring(2);
                            prefixLength = 2;
                        } else if (trimmedLine.startsWith('## ')) {
                            inputClass += " text-2xl font-bold mt-2 mb-1";
                            value = trimmedLine.substring(3);
                            prefixLength = 3;
                        } else if (trimmedLine.startsWith('[ ] ') || trimmedLine.startsWith('[x] ')) {
                            const isChecked = trimmedLine.startsWith('[x] ');
                            value = trimmedLine.substring(4);
                            prefixLength = 4;
                            renderContent = (
                                <div 
                                    className={`mt-1 cursor-pointer flex-shrink-0 transition-colors ${isChecked ? 'text-emerald-500' : isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-300 hover:text-gray-500'}`}
                                    onClick={() => toggleCheck(index)}
                                >
                                    {isChecked ? <CheckSquare size={20} /> : <Square size={20} />}
                                </div>
                            );
                            inputClass += isChecked ? " line-through opacity-50 decoration-2" : "";
                        } else if (trimmedLine.startsWith('- ')) {
                            value = trimmedLine.substring(2);
                            prefixLength = 2;
                            renderContent = <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0 mx-1" />;
                        } else if (/^\d+\. /.test(trimmedLine)) {
                            const match = trimmedLine.match(/^\d+\. /);
                            if (match) {
                                prefixLength = match[0].length;
                                value = trimmedLine.substring(prefixLength);
                                renderContent = <div className="mt-0.5 min-w-[20px] text-right text-sm font-mono opacity-60 select-none">{match[0]}</div>;
                            }
                        }
                        
                        // Indentation style
                        const indentationStyle = { paddingLeft: `${indentLevel * 1.5}rem` };

                        return (
                            <div key={index} className={lineClass} style={indentationStyle}>
                                {renderContent}
                                <input
                                    id={`note-line-${index}`}
                                    className={inputClass}
                                    value={value}
                                    onChange={(e) => updateLine(index, indentStr + trimmedLine.substring(0, prefixLength) + e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                    onFocus={() => setFocusedLineIndex(index)}
                                    placeholder={index === 0 && lines.length === 1 ? "Escribe '/' para comandos..." : ""}
                                    autoComplete="off"
                                />
                            </div>
                        );
                    })}
                    <div className="h-[30vh] cursor-text" onClick={() => {
                        const newLines = [...lines, ''];
                        setLines(newLines);
                        setTimeout(() => document.getElementById(`note-line-${newLines.length - 1}`)?.focus(), 0);
                    }} />
                </div>

                {/* SLASH MENU */}
                {slashMenuOpen && (
                    <div 
                        className={`fixed w-48 rounded-lg shadow-2xl border overflow-hidden z-[210] animate-in fade-in zoom-in-95 ${isDark ? 'bg-[#1e1e20] border-zinc-700' : 'bg-white border-gray-200'}`}
                        style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
                    >
                        <div className={`px-3 py-1.5 text-[10px] font-bold uppercase ${isDark ? 'text-zinc-500 bg-zinc-800/50' : 'text-gray-400 bg-gray-50'}`}>Bloques Básicos</div>
                        {BLOCK_TYPES.map((block, i) => (
                            <button
                                key={block.id}
                                onClick={() => applyBlockType(block)}
                                className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-left transition-colors ${i === slashSelection ? isDark ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white' : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                <block.icon size={16} />
                                {block.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};