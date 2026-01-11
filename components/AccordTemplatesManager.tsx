import React, { useState, useRef } from 'react';
import { AccordTemplate, AccordTemplateItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templates: AccordTemplate[];
  onDelete: (id: string) => void;
  onInsert: (templateId: string, weight: number) => void;
  onImportTemplates: (templates: AccordTemplate[]) => void;
}

export const AccordTemplatesManager: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  templates, 
  onDelete, 
  onInsert,
  onImportTemplates
}) => {
  const [insertId, setInsertId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState<string>('10');
  
  // Import/Export State
  const [showIO, setShowIO] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // --- INSERT LOGIC ---
  const handleInsertClick = (id: string) => {
    setInsertId(id);
    setWeightInput('10'); // reset default
  };

  const confirmInsert = () => {
    const w = parseFloat(weightInput);
    if (insertId && !isNaN(w) && w > 0) {
      onInsert(insertId, w);
      setInsertId(null);
      onClose(); 
    } else {
        alert("Please enter a valid positive weight.");
    }
  };

  // --- EXPORT LOGIC ---
  const buildExportPayload = () => {
    return JSON.stringify({
      kind: "perfume_accord_templates",
      app: "Artisan Perfume Formulator",
      version: 1,
      exportedAt: Date.now(),
      templates: templates
    }, null, 2);
  };

  const handleDownloadExport = () => {
    const payload = buildExportPayload();
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `accord_templates_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyExport = () => {
    const payload = buildExportPayload();
    navigator.clipboard.writeText(payload).then(() => {
      alert("Templates JSON copied to clipboard!");
    }).catch(() => {
      prompt("Copy this JSON manually:", payload);
    });
  };

  // --- IMPORT LOGIC ---
  const processImport = (jsonString: string) => {
    setImportError(null);
    setImportSuccess(null);
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      setImportError("Failed to parse JSON. Please check syntax.");
      return;
    }

    const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.templates) ? parsed.templates : []);
    
    // Looser check initially to allow finding the templates array
    if (!Array.isArray(rawList)) {
       setImportError("Invalid format: JSON does not contain a valid templates list.");
       return;
    }
    
    if (rawList.length === 0) {
       setImportError("Import file contains no templates.");
       return;
    }

    const validTemplates: AccordTemplate[] = [];
    let skippedTemplates = 0;
    let skippedItems = 0;

    for (const t of rawList) {
        // 1. Basic Template Structure Check
        if (!t || typeof t !== 'object' || !t.name || typeof t.name !== 'string' || !t.name.trim() || !Array.isArray(t.items)) {
            skippedTemplates++;
            continue;
        }

        const validItems: AccordTemplateItem[] = [];
        let sumRatios = 0;

        for (const i of t.items) {
            // 2. Basic Item Check
            if (!i || typeof i !== 'object' || !i.name) {
                skippedItems++;
                continue;
            }

            // 3. Strict Ratio Check (Must be > 0)
            const ratio = parseFloat(i.ratio);
            if (isNaN(ratio) || ratio <= 0) {
                skippedItems++;
                continue;
            }

            sumRatios += ratio;

            // 4. Fill Defaults & Sanitize
            validItems.push({
                ratio: ratio,
                ingredientId: (typeof i.ingredientId === 'string') ? i.ingredientId : null,
                name: String(i.name).trim(),
                cas: String(i.cas || ''),
                family: String(i.family || 'Custom'),
                note: String(i.note || 'Middle'),
                odorProfile: String(i.odorProfile || ''),
                dilution: (typeof i.dilution === 'number') ? i.dilution : 1.0,
                solvent: String(i.solvent || 'None'),
                costPerKg: (typeof i.costPerKg === 'number') ? i.costPerKg : 0,
                supplier: String(i.supplier || ''),
                customDensity: (typeof i.customDensity === 'number') ? i.customDensity : undefined
            });
        }

        // 5. Template Viability Check (Must have items and positive total ratio)
        if (validItems.length === 0 || sumRatios <= 0) {
            skippedTemplates++;
            continue;
        }

        // 6. Ratio Normalization (if sum exists but isn't 1.0)
        if (Math.abs(sumRatios - 1.0) > 0.0001) {
            validItems.forEach(vi => vi.ratio = vi.ratio / sumRatios);
        }

        validTemplates.push({
            id: (typeof t.id === 'string' && t.id) ? t.id : crypto.randomUUID(),
            name: t.name.trim(),
            createdAt: (typeof t.createdAt === 'number') ? t.createdAt : Date.now(),
            items: validItems
        });
    }

    if (validTemplates.length === 0) {
        setImportError(`No valid templates found. Skipped ${skippedTemplates} invalid templates.`);
        return;
    }

    try {
        onImportTemplates(validTemplates);
        
        const parts = [`Imported ${validTemplates.length} templates.`];
        if (skippedTemplates > 0) parts.push(`Skipped ${skippedTemplates} invalid templates.`);
        if (skippedItems > 0) parts.push(`Skipped ${skippedItems} invalid items.`);
        
        setImportSuccess(parts.join(' '));
        setImportText('');
    } catch (e: any) {
        setImportError(e.message || "Error saving imported templates.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        processImport(evt.target.result as string);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-gray-800">Accord Templates</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl px-2">×</button>
        </div>

        {/* --- LIST AREA --- */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {templates.length === 0 && (
            <div className="text-center text-gray-400 py-8 italic text-sm">
                No saved templates.<br/>
                Create one by clicking "Save Tmpl" on a desktop Accord header.
            </div>
          )}
          {templates.map(t => (
            <div key={t.id} className="border border-gray-200 rounded p-3 bg-gray-50 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-gray-800 text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.items.length} ingredients • {new Date(t.createdAt).toLocaleDateString()}</div>
                </div>
                <button 
                  onClick={() => { if(window.confirm('Delete template?')) onDelete(t.id); }} 
                  className="text-red-400 hover:text-red-600 text-[10px] uppercase font-bold px-2 py-1 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
              
              {/* Insert Area */}
              {insertId === t.id ? (
                <div className="mt-1 bg-white border border-blue-200 rounded p-2 flex items-center gap-2 animate-fade-in shadow-sm">
                  <span className="text-xs font-bold text-blue-600 whitespace-nowrap">Target Weight (g):</span>
                  <input 
                    autoFocus
                    type="number" 
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmInsert()}
                  />
                  <button 
                    onClick={confirmInsert}
                    className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-blue-700"
                  >
                    Insert
                  </button>
                  <button 
                    onClick={() => setInsertId(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs font-bold px-2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleInsertClick(t.id)}
                  className="w-full bg-white border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 text-xs font-bold py-1.5 rounded transition-colors shadow-sm"
                >
                  Insert into Formula
                </button>
              )}
            </div>
          ))}
        </div>
        
        {/* --- EXPORT / IMPORT SECTION --- */}
        <div className="border-t border-gray-100 bg-gray-50/50 shrink-0">
          <button 
            onClick={() => setShowIO(!showIO)} 
            className="w-full py-2 text-xs font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wide flex items-center justify-center gap-2"
          >
            {showIO ? 'Hide Import / Export' : 'Show Import / Export'}
            <span className="text-[10px]">{showIO ? '▼' : '▲'}</span>
          </button>

          {showIO && (
            <div className="p-4 space-y-4 border-t border-gray-100 bg-white">
              {/* EXPORT */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Export Templates</h4>
                <div className="flex gap-2">
                  <button onClick={handleDownloadExport} className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 text-xs font-bold py-2 rounded">Download JSON</button>
                  <button onClick={handleCopyExport} className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 text-xs font-bold py-2 rounded">Copy to Clipboard</button>
                </div>
              </div>

              {/* IMPORT */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Import Templates</h4>
                
                <div className="flex gap-2 mb-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white hover:bg-gray-50 border border-dashed border-gray-400 text-gray-600 text-xs font-bold py-2 rounded">
                    Upload File
                  </button>
                </div>

                <div className="relative">
                  <textarea 
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Or paste JSON here..."
                    className="w-full text-xs border border-gray-300 rounded p-2 h-16 resize-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {importText && (
                    <button 
                      onClick={() => processImport(importText)}
                      className="absolute bottom-2 right-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded hover:bg-indigo-700 shadow"
                    >
                      Import Text
                    </button>
                  )}
                </div>

                {importError && <div className="text-red-500 text-xs mt-1 font-medium">{importError}</div>}
                {importSuccess && <div className="text-green-600 text-xs mt-1 font-medium">{importSuccess}</div>}
              </div>
            </div>
          )}
        </div>

        {/* --- CLOSE BUTTON --- */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button onClick={onClose} className="w-full py-2 bg-white border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-100 rounded shadow-sm">
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
};