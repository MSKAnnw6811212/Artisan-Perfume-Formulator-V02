import React, { useState, useEffect, useRef } from 'react';
import { FormulaItem, AccordGroup } from '../types';
import { INGREDIENTS } from '../data/ingredients';

interface Props {
  item: FormulaItem;
  index: number;
  percent: number;
  visibleColumns: Set<string>;
  onChange: (uuid: string, field: keyof FormulaItem | 'volume', value: any) => void;
  onRemove: (uuid: string) => void;
  // Mobile Checklist Props (Optional)
  isChecked?: boolean;
  onToggleCheck?: () => void;
  // Accord Props (Optional)
  accordGroups?: AccordGroup[];
  onSetAccord?: (uuid: string, accordId: string | null) => void;
}

// --- SHARED LOGIC HOOK ---
const useIngredientLogic = (item: FormulaItem, onChange: (uuid: string, field: any, value: any) => void) => {
  // Density Lookup
  const dbIng = item.ingredientId ? INGREDIENTS.find((i) => i.id === item.ingredientId) : null;
  const density = item.customDensity ?? (dbIng ? dbIng.density : 1.0);

  // Active Mass Calculation
  const realMass = (item.weight || 0) * (item.dilution || 1);
  const solventMass = (item.weight || 0) * (1 - (item.dilution || 1));

  // --- LOCAL STATE ---
  const [localWeight, setLocalWeight] = useState(item.weight.toFixed(3));
  const [localVol, setLocalVol] = useState((item.weight / density).toFixed(3));
  const [localSG, setLocalSG] = useState(item.customDensity !== undefined ? item.customDensity.toFixed(3) : "1.000");

  // --- REFS ---
  const weightRef = useRef(localWeight);
  const volRef = useRef(localVol);
  const timerRef = useRef<number | null>(null);
  const waitRef = useRef<number | null>(null);

  // Sync Refs
  useEffect(() => { weightRef.current = localWeight; }, [localWeight]);
  useEffect(() => { volRef.current = localVol; }, [localVol]);

  // Sync from Parent -> Local
  useEffect(() => {
    const val = parseFloat(localWeight.replace(',', '.'));
    if (Math.abs(val - item.weight) > 0.001) {
      setLocalWeight(item.weight.toFixed(3));
    }
  }, [item.weight]);

  useEffect(() => {
    const currentVol = parseFloat(localVol.replace(',', '.'));
    const propVol = item.weight / density;
    if (Math.abs(propVol - currentVol) > 0.001) {
      setLocalVol(propVol.toFixed(3));
    }
  }, [item.weight, density]);

  useEffect(() => {
    const current = parseFloat(localSG);
    const incoming = item.customDensity ?? 1.0;
    if (Math.abs(current - incoming) > 0.001) {
       setLocalSG(incoming.toFixed(3));
    }
  }, [item.customDensity, item.uuid]);

  // Helpers
  const parseVal = (str: string) => parseFloat(str.replace(',', '.')) || 0;

  const handleStep = (field: 'weight' | 'volume', delta: number) => {
    if (field === 'weight') {
      const current = parseVal(weightRef.current);
      const next = Math.max(0, current + delta);
      setLocalWeight(next.toFixed(3));
      onChange(item.uuid, 'weight', next);
    } else {
      const currentVol = parseVal(volRef.current);
      const nextVol = Math.max(0, currentVol + delta);
      const nextWeight = nextVol * density;
      setLocalVol(nextVol.toFixed(3));
      onChange(item.uuid, 'weight', nextWeight); 
    }
  };

  const startChange = (field: 'weight' | 'volume', delta: number) => {
    handleStep(field, delta);
    waitRef.current = window.setTimeout(() => {
      timerRef.current = window.setInterval(() => {
        handleStep(field, delta);
      }, 80); 
    }, 500);
  };

  const stopChange = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (waitRef.current) window.clearTimeout(waitRef.current);
    timerRef.current = null;
    waitRef.current = null;
  };

  const handleManualChange = (field: 'weight' | 'volume', val: string) => {
    if (field === 'weight') {
      setLocalWeight(val);
      const num = parseFloat(val.replace(',', '.'));
      if (!isNaN(num)) onChange(item.uuid, 'weight', num);
      else if (val === '') onChange(item.uuid, 'weight', 0);
    } else {
      setLocalVol(val);
      const num = parseFloat(val.replace(',', '.'));
      if (!isNaN(num)) {
        const w = num * density;
        onChange(item.uuid, 'weight', w); 
      }
      else if (val === '') onChange(item.uuid, 'weight', 0);
    }
  };

  const handleSGChange = (val: string) => {
    setLocalSG(val);
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num) && num > 0) onChange(item.uuid, 'customDensity', num);
  };

  const handleSGBlur = () => {
    const num = parseFloat(localSG.replace(',', '.'));
    if (!isNaN(num) && num > 0) setLocalSG(num.toFixed(3));
    else setLocalSG((item.customDensity ?? 1.0).toFixed(3));
  };

  return {
    density,
    realMass,
    solventMass,
    localWeight,
    localVol,
    localSG,
    handleManualChange,
    startChange,
    stopChange,
    handleSGChange,
    handleSGBlur,
    dbIng
  };
};

// --- DESKTOP ROW COMPONENT ---
export const IngredientRow: React.FC<Props> = (props) => {
  const { item, index, percent, visibleColumns, onChange, onRemove, accordGroups, onSetAccord } = props;
  const logic = useIngredientLogic(item, onChange);

  return (
    <tr className="border-b border-gray-200 hover:bg-blue-50/30 transition-colors group">
      {/* 1. Index */}
      {visibleColumns.has('index') && (
        <td className="text-center text-gray-400 font-mono text-xs select-none">{index + 1}</td>
      )}
      
      {/* 2. Name */}
      {visibleColumns.has('name') && (
        <td className="name-col border-r border-gray-100">
          <div className="font-semibold text-gray-900 text-sm truncate" title={item.name}>
            {item.name || "Unknown Ingredient"}
          </div>
        </td>
      )}
      
      {/* 3. Family */}
      {visibleColumns.has('family') && (
        <td>
           <select 
              value={item.family || 'Floral'} 
              onChange={(e) => onChange(item.uuid, 'family', e.target.value)}
              className="lab-input w-full text-xs"
            >
              <option value="Floral">Floral</option>
              <option value="Woody">Woody</option>
              <option value="Musk">Musk</option>
              <option value="Citrus">Citrus</option>
              <option value="Amber">Amber</option>
              <option value="Green">Green</option>
              <option value="Fruity">Fruity</option>
              <option value="Spicy">Spicy</option>
              <option value="Herbal">Herbal</option>
              <option value="Gourmand">Gourmand</option>
              <option value="Marine">Marine</option>
              <option value="Aldehyde">Aldehyde</option>
              <option value="Chypre">Chypre</option>
              <option value="Fougère">Fougère</option>
              <option value="Leather">Leather</option>
              <option value="Animalic">Animalic</option>
              <option value="Resin">Resin</option>
              <option value="Fixative">Fixative</option>
              <option value="Solvent">Solvent</option>
              <option value="Custom">Custom</option>
           </select>
        </td>
      )}

      {/* 4. Note */}
      {visibleColumns.has('note') && (
        <td>
           <select 
              value={item.note || 'Middle'} 
              onChange={(e) => onChange(item.uuid, 'note', e.target.value)}
              className="lab-input w-full text-xs"
            >
              <option value="Top">Top</option>
              <option value="Middle">Middle</option>
              <option value="Base">Base</option>
              <option value="Solvent">Solvent</option>
           </select>
        </td>
      )}

      {/* 5. Odor Profile */}
      {visibleColumns.has('profile') && (
        <td>
           <input 
              type="text" 
              value={item.odorProfile || ''} 
              onChange={(e) => onChange(item.uuid, 'odorProfile', e.target.value)}
              className="lab-input w-full"
              placeholder="Desc..."
            />
        </td>
      )}

      {/* NEW: Accord Selection */}
      {visibleColumns.has('accord') && (
        <td>
          <select
            value={item.accordId || ''}
            onChange={(e) => onSetAccord && onSetAccord(item.uuid, e.target.value || null)}
            className="lab-input w-full text-xs"
          >
            <option value="">
              {(!accordGroups || accordGroups.length === 0) ? "No Accord (add via +ACCORD)" : "No Accord"}
            </option>
            {accordGroups?.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </td>
      )}

      {/* 6. Supplier */}
      {visibleColumns.has('supplier') && (
        <td>
           <input 
              type="text" 
              value={item.supplier || ''} 
              onChange={(e) => onChange(item.uuid, 'supplier', e.target.value)}
              className="lab-input w-full"
              placeholder="IFF/Giv..."
            />
        </td>
      )}

      {/* 7. CAS */}
      {visibleColumns.has('cas') && (
        <td>
           <input 
              type="text" 
              value={item.cas || ''} 
              onChange={(e) => onChange(item.uuid, 'cas', e.target.value)}
              className="lab-input font-mono text-xs w-full"
              placeholder="00-00-0"
            />
        </td>
      )}

      {/* 8. Weight */}
      {visibleColumns.has('weight') && (
        <td>
           <div className="input-group">
              <button 
                tabIndex={-1} 
                onMouseDown={() => logic.startChange('weight', -0.001)}
                onMouseUp={logic.stopChange}
                onMouseLeave={logic.stopChange}
                onTouchStart={() => logic.startChange('weight', -0.001)}
                onTouchEnd={logic.stopChange}
                className="spinner-btn minus"
              >-</button>
              <input 
                type="text"
                inputMode="decimal"
                value={logic.localWeight}
                onChange={(e) => logic.handleManualChange('weight', e.target.value)}
                className="input-compact"
              />
              <button 
                tabIndex={-1} 
                onMouseDown={() => logic.startChange('weight', 0.001)}
                onMouseUp={logic.stopChange}
                onMouseLeave={logic.stopChange}
                onTouchStart={() => logic.startChange('weight', 0.001)}
                onTouchEnd={logic.stopChange}
                className="spinner-btn plus"
              >+</button>
           </div>
        </td>
      )}

      {/* 9. Volume */}
      {visibleColumns.has('volume') && (
        <td>
           <div className="input-group">
              <button 
                tabIndex={-1} 
                onMouseDown={() => logic.startChange('volume', -0.001)}
                onMouseUp={logic.stopChange}
                onMouseLeave={logic.stopChange}
                onTouchStart={() => logic.startChange('volume', -0.001)}
                onTouchEnd={logic.stopChange}
                className="spinner-btn minus"
              >-</button>
              <input 
                type="text"
                inputMode="decimal"
                value={logic.localVol}
                onChange={(e) => logic.handleManualChange('volume', e.target.value)}
                className="input-compact"
              />
              <button 
                tabIndex={-1} 
                onMouseDown={() => logic.startChange('volume', 0.001)}
                onMouseUp={logic.stopChange}
                onMouseLeave={logic.stopChange}
                onTouchStart={() => logic.startChange('volume', 0.001)}
                onTouchEnd={logic.stopChange}
                className="spinner-btn plus"
              >+</button>
           </div>
        </td>
      )}

      {/* 10. SG */}
      {visibleColumns.has('sg') && (
        <td className="text-center">
          {logic.dbIng ? (
            <span className="text-gray-400 font-mono text-xs cursor-help" title={`Standard density: ${logic.density}`}>
              {logic.density.toFixed(3)}
            </span>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              value={logic.localSG}
              onChange={(e) => logic.handleSGChange(e.target.value)}
              onBlur={logic.handleSGBlur}
              className="lab-input w-14 text-center font-mono text-xs bg-yellow-50 focus:bg-white"
              placeholder="1.000"
            />
          )}
        </td>
      )}

      {/* 11. Percent */}
      {visibleColumns.has('percent') && (
        <td className="text-right font-mono text-xs font-semibold text-gray-600">
          {percent.toFixed(2)}%
        </td>
      )}

      {/* 12. Dilution */}
      {visibleColumns.has('dilution') && (
        <td>
          <div className="relative w-full">
            <input 
              type="number" 
              step="1" 
              min="0"
              max="100"
              value={Math.round((item.dilution || 1) * 100)} 
              onChange={(e) => onChange(item.uuid, 'dilution', (parseFloat(e.target.value) || 0) / 100)}
              className="lab-input text-center pr-4 w-full"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
          </div>
        </td>
      )}

      {/* 13. Solvent */}
      {visibleColumns.has('solvent') && (
        <td>
          <div className="flex flex-col w-full">
            <select
              value={item.solvent || 'None'}
              onChange={(e) => onChange(item.uuid, 'solvent', e.target.value)}
              className="lab-input py-1 text-xs w-full"
            >
              <option value="None">None</option>
              <option value="Ethanol">Ethanol</option>
              <option value="DPG">DPG</option>
              <option value="IPM">IPM</option>
              <option value="TEC">TEC</option>
              <option value="BB">BB</option>
              <option value="Water">Water (Aqua)</option>
            </select>
            {(item.dilution || 1) < 1 && (
              <span className="text-[10px] text-gray-400 tabular-nums mt-0.5 pl-1">
                +{logic.solventMass.toFixed(3)}g solv.
              </span>
            )}
          </div>
        </td>
      )}

      {/* 14. Active */}
      {visibleColumns.has('active') && (
        <td className="text-right tabular-nums font-bold text-blue-700 text-sm">
          {logic.realMass.toFixed(3)} <span className="text-[10px] text-blue-400 font-normal">g</span>
        </td>
      )}

      {/* 15. Cost */}
      {visibleColumns.has('cost') && (
        <td>
           <div className="relative w-full">
             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">€</span>
             <input 
               type="number" 
               step="1" 
               min="0"
               value={item.costPerKg || 0} 
               onChange={(e) => onChange(item.uuid, 'costPerKg', parseFloat(e.target.value) || 0)}
               className="lab-input text-right pl-5 text-xs w-full"
             />
           </div>
        </td>
      )}

      {/* 16. Actions */}
      {visibleColumns.has('actions') && (
        <td className="text-center">
          <button 
            onClick={() => onRemove(item.uuid)}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </td>
      )}
    </tr>
  );
};

// --- MOBILE CARD COMPONENT ---
export const IngredientCard: React.FC<Props> = (props) => {
  const { item, percent, visibleColumns, onChange, onRemove, isChecked, onToggleCheck, accordGroups, onSetAccord } = props;
  const logic = useIngredientLogic(item, onChange);

  return (
    <div className={`border rounded-lg shadow-sm overflow-hidden transition-all ${isChecked ? 'bg-green-50 border-green-300 ring-1 ring-green-200' : 'bg-white border-gray-200'}`}>
      
      {/* HEADER: Check, Name, Weight */}
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
          {/* Checklist Toggle */}
          <button 
            onClick={onToggleCheck}
            className={`flex-shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-gray-300 text-transparent'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
          </button>
          
          <div className="min-w-0 flex-1">
            <div className={`font-bold text-sm truncate ${isChecked ? 'text-green-800' : 'text-gray-800'}`}>{item.name}</div>
            <div className="text-[10px] text-gray-400 font-mono">{percent.toFixed(1)}% • {item.family}</div>
          </div>
        </div>

        {/* Primary Action: Weight */}
        <div className="input-group shrink-0 shadow-sm">
            <button 
              onMouseDown={() => logic.startChange('weight', -0.001)}
              onMouseUp={logic.stopChange}
              onMouseLeave={logic.stopChange}
              onTouchStart={() => logic.startChange('weight', -0.001)}
              onTouchEnd={logic.stopChange}
              className="spinner-btn minus px-2"
            >-</button>
            <input 
              type="text"
              inputMode="decimal"
              value={logic.localWeight}
              onChange={(e) => logic.handleManualChange('weight', e.target.value)}
              className="input-compact w-16 text-center font-bold text-gray-800"
            />
            <button 
              onMouseDown={() => logic.startChange('weight', 0.001)}
              onMouseUp={logic.stopChange}
              onMouseLeave={logic.stopChange}
              onTouchStart={() => logic.startChange('weight', 0.001)}
              onTouchEnd={logic.stopChange}
              className="spinner-btn plus px-2"
            >+</button>
        </div>
      </div>

      {/* BODY: Accordion for Secondary Fields */}
      <details className="group border-t border-gray-100">
        <summary className="bg-gray-50/50 p-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:bg-gray-50 hover:text-gray-600 select-none list-none flex justify-center items-center gap-1">
          <span>Details</span>
          <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </summary>
        
        <div className="p-3 grid grid-cols-2 gap-3 text-xs">
          
          {/* Accord Selection (Mobile) */}
          {accordGroups && accordGroups.length > 0 && (
            <div className="col-span-2">
              <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">Accord</label>
              <select
                value={item.accordId || ''}
                onChange={(e) => onSetAccord && onSetAccord(item.uuid, e.target.value || null)}
                className="w-full border rounded p-1"
              >
                <option value="">No Accord</option>
                {accordGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Render secondary fields if they are in visibleColumns */}
          {visibleColumns.has('family') && (
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">Family</label>
              <select value={item.family} onChange={(e) => onChange(item.uuid, 'family', e.target.value)} className="w-full border rounded p-1">
                <option value="Floral">Floral</option>
                <option value="Woody">Woody</option>
                <option value="Musk">Musk</option>
                <option value="Citrus">Citrus</option>
                <option value="Amber">Amber</option>
                <option value="Green">Green</option>
                <option value="Fruity">Fruity</option>
                <option value="Spicy">Spicy</option>
                <option value="Herbal">Herbal</option>
                <option value="Gourmand">Gourmand</option>
                <option value="Marine">Marine</option>
                <option value="Aldehyde">Aldehyde</option>
                <option value="Chypre">Chypre</option>
                <option value="Fougère">Fougère</option>
                <option value="Leather">Leather</option>
                <option value="Animalic">Animalic</option>
                <option value="Resin">Resin</option>
                <option value="Fixative">Fixative</option>
                <option value="Solvent">Solvent</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          )}

          {visibleColumns.has('note') && (
            <div>
              <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">Note</label>
              <select value={item.note} onChange={(e) => onChange(item.uuid, 'note', e.target.value)} className="w-full border rounded p-1">
                <option value="Top">Top</option>
                <option value="Middle">Middle</option>
                <option value="Base">Base</option>
                <option value="Solvent">Solvent</option>
              </select>
            </div>
          )}

          {visibleColumns.has('dilution') && (
            <div className="col-span-1">
              <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">Dilution (%)</label>
              <input 
                type="number" 
                value={Math.round((item.dilution || 1) * 100)} 
                onChange={(e) => onChange(item.uuid, 'dilution', (parseFloat(e.target.value) || 0) / 100)}
                className="w-full border rounded p-1 text-center"
              />
            </div>
          )}

          {visibleColumns.has('solvent') && (
            <div className="col-span-1">
              <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">Solvent</label>
              <select value={item.solvent} onChange={(e) => onChange(item.uuid, 'solvent', e.target.value)} className="w-full border rounded p-1">
                <option value="None">None</option>
                <option value="Ethanol">Ethanol</option>
                <option value="DPG">DPG</option>
                <option value="IPM">IPM</option>
                <option value="TEC">TEC</option>
                <option value="BB">BB</option>
              </select>
            </div>
          )}

          {visibleColumns.has('cas') && (
            <div className="col-span-2">
              <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">CAS</label>
              <input type="text" value={item.cas} onChange={(e) => onChange(item.uuid, 'cas', e.target.value)} className="w-full border rounded p-1 font-mono" />
            </div>
          )}

          {visibleColumns.has('cost') && (
            <div className="col-span-2">
              <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">Cost (€/kg)</label>
              <input type="number" value={item.costPerKg} onChange={(e) => onChange(item.uuid, 'costPerKg', parseFloat(e.target.value))} className="w-full border rounded p-1" />
            </div>
          )}

          <div className="col-span-2 pt-2 border-t border-gray-100 flex justify-end">
            <button 
              onClick={() => onRemove(item.uuid)} 
              className="text-red-500 text-xs font-bold uppercase hover:bg-red-50 px-3 py-1 rounded"
            >
              Remove Ingredient
            </button>
          </div>
        </div>
      </details>
    </div>
  );
};