import React, { useState, useEffect } from 'react';
import { AlertTriangle, Wifi, WifiOff, Globe, Share2, Loader2, Laptop, Smartphone, Check, Copy, LogOut, X, Timer, Plus, Minus, Palette } from 'lucide-react';
import { PROJECT_COLORS } from '../utils';

export const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, isDark, confirmText = "Eliminar", cancelText = "Cancelar" }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
      <div className={`w-full max-w-sm rounded-xl border shadow-2xl p-6 ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col items-center text-center mb-6"><div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-3"><AlertTriangle size={20} /></div><h3 className={`text-lg font-medium mb-1 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{title}</h3><p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{message}</p></div>
        <div className="flex gap-3"><button onClick={onCancel} className={`flex-1 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>{cancelText}</button><button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium">{confirmText}</button></div>
      </div>
    </div>
  );
};

export const CloudSyncModal = ({ isOpen, onClose, currentUserId, isCustom, onSetCustomId, onClearCustomId, isDark, onActivateCloudMode }: any) => {
    const [inputValue, setInputValue] = useState('');
    const [copied, setCopied] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(currentUserId).then(() => {
            setCopied(true); setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleActivateClick = async () => {
        setIsSharing(true);
        await onActivateCloudMode();
        setIsSharing(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCustom ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 text-zinc-500'}`}>
                            {isCustom ? <Wifi size={20} /> : <WifiOff size={20} />}
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Sincronización Cloud</h3>
                            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                                {isCustom ? '● Conectado a Nube' : '○ Modo Local (Privado)'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-gray-200 text-gray-400'}`}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-8">
                    {!isCustom && (
                        <div className={`p-4 rounded-xl border border-dashed ${isDark ? 'bg-zinc-900/50 border-zinc-700' : 'bg-emerald-50/50 border-emerald-200'}`}>
                            <div className="flex items-start gap-3 mb-3">
                                <Globe size={18} className="text-emerald-500 mt-1" />
                                <div>
                                    <h4 className={`text-sm font-bold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>Activar Modo Nube</h4>
                                    <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                                        Sube tus datos locales a la nube para acceder desde otros dispositivos usando tu ID.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={handleActivateClick}
                                disabled={isSharing}
                                className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${isSharing ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
                            >
                                {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} 
                                {isSharing ? 'Sincronizando...' : 'Activar y Sincronizar Ahora'}
                            </button>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                             <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}><Laptop size={14} /> Tu ID (Para compartir)</label>
                        </div>
                        <div className="flex gap-2">
                            <code className={`flex-1 p-3 rounded-lg text-sm font-mono break-all flex items-center ${isDark ? 'bg-black/50 text-zinc-300 border border-zinc-800' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
                                {currentUserId}
                            </code>
                            <button onClick={handleCopy} className={`px-4 rounded-lg font-medium transition-all flex flex-col items-center justify-center gap-1 min-w-[80px] ${copied ? 'bg-emerald-500 text-white' : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}>{copied ? <Check size={18} /> : <Copy size={18} />}<span className="text-[10px]">{copied ? 'Copiado' : 'Copiar'}</span></button>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}><Smartphone size={14} /> Conectar a otro ID</label>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Pega un ID remoto aquí..." className={`flex-1 rounded-lg px-4 py-3 text-sm outline-none border transition-all ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-emerald-500 focus:bg-black' : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'}`} />
                            <button onClick={() => { if(inputValue.trim()) onSetCustomId(inputValue.trim()); }} disabled={!inputValue.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition-transform active:scale-95">Conectar</button>
                        </div>
                    </div>
                </div>
                {isCustom && (
                    <div className={`p-4 border-t ${isDark ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-100'}`}>
                        <button onClick={onClearCustomId} className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 font-medium text-sm py-2"><LogOut size={16} /> Desconectar (Volver a Local)</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const PomodoroLogModal = ({ isOpen, projects, onSave, onCancel, isDark, minutes }: any) => {
    const [selectedProjectId, setSelectedProjectId] = useState('');
    useEffect(() => { if (projects.length > 0) setSelectedProjectId(projects[0].id); }, [projects]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className={`w-full max-w-sm rounded-xl border shadow-2xl p-6 ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-3"><Timer size={24} /></div>
                    <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>¡Sesión Registrada!</h3>
                    <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Has completado <strong>{minutes} minutos</strong>.<br/>¿A qué proyecto dedicaste este tiempo?</p>
                    <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className={`w-full px-3 py-2 rounded-lg border outline-none text-sm ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-gray-300 text-gray-900'}`}>{projects.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>
                </div>
                <div className="flex gap-3"><button onClick={onCancel} className={`flex-1 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Descartar</button><button onClick={() => onSave(selectedProjectId)} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">Registrar</button></div>
            </div>
        </div>
    );
};

export const ProjectModal = ({ isOpen, onClose, isDark, editingProject, name, setName, links, setLinks, color, setColor, onSave }: any) => {
    if (!isOpen) return null;

    const handleAddLinkRow = () => setLinks([...links, { name: '', url: '' }]);
    const handleRemoveLinkRow = (index: number) => { const newLinks = [...links]; newLinks.splice(index, 1); setLinks(newLinks); };
    const handleLinkChange = (index: number, field: string, value: string) => { const newLinks = [...links]; (newLinks as any)[index][field] = value; setLinks(newLinks); };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in zoom-in-95">
            <div className={`w-full max-w-sm rounded-xl border shadow-2xl p-6 ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{editingProject ? 'Editar' : 'Nuevo'} Proyecto</h3>
                    <button onClick={onClose} className={isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}><X size={20}/></button>
                </div>
                <form onSubmit={onSave}>
                    <div className="space-y-4">
                        <input autoFocus placeholder="Nombre del proyecto" value={name} onChange={(e:any) => setName(e.target.value)} className={`w-full rounded-lg px-4 py-2.5 outline-none border transition-colors ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-zinc-600 placeholder-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-400 placeholder-gray-400'}`} />
                        
                        <div>
                             <label className={`text-[10px] font-bold uppercase mb-2 flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}><Palette size={12}/> Color</label>
                             <div className="flex flex-wrap gap-2">
                                 {Object.entries(PROJECT_COLORS).map(([key, val]) => (
                                     <button 
                                        key={key} 
                                        type="button" 
                                        onClick={() => setColor(key)}
                                        className={`w-6 h-6 rounded-full transition-transform ${val.dot} ${color === key ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-110'} ${isDark ? 'ring-offset-zinc-900' : 'ring-offset-white'}`}
                                        title={val.label}
                                     />
                                 ))}
                             </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Recursos</label>
                                <button type="button" onClick={handleAddLinkRow} className={`text-xs flex items-center gap-1 ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}><Plus size={12} /> Añadir Link</button>
                            </div>
                            <div className="space-y-2 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
                                {links.map((link: any, index: number) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <input type="text" placeholder="Nombre" value={link.name} onChange={(e) => handleLinkChange(index, 'name', e.target.value)} className={`w-1/3 rounded-lg px-3 py-2 text-xs outline-none border transition-colors ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-400'}`} />
                                        <input type="url" placeholder="URL" value={link.url} onChange={(e) => handleLinkChange(index, 'url', e.target.value)} className={`flex-1 rounded-lg px-3 py-2 text-xs outline-none border transition-colors ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-400'}`} />
                                        <button type="button" onClick={() => handleRemoveLinkRow(index)} className={`p-1.5 rounded hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors`}><Minus size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button type="submit" className={`w-full mt-6 font-semibold py-2.5 rounded-lg transition-colors ${isDark ? 'bg-zinc-100 hover:bg-white text-black' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>Guardar</button>
                </form>
            </div>
        </div>
    );
};