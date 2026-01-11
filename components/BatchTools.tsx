import React, { useState } from 'react';
import { FormulaItem, FormulationStats } from '../types';
import { INGREDIENTS } from '../data/ingredients';

interface Props {
  formula: FormulaItem[];
  stats: FormulationStats;
  onUpdateFormula: (newFormula: FormulaItem[]) => void;
}

export const BatchTools: React.FC<Props> = ({ formula, stats, onUpdateFormula }) => {
  // Scaling State
  const [scaleTarget, setScaleTarget] = useState<string>('');
  const [scaleMode, setScaleMode] = useState<'total' | 'ingredient'>('total');
  const [targetIngredientId, setTargetIngredientId] = useState<string>('');

  // Solvent State
  const [targetConc, setTargetConc] = useState<string>('15'); // Default EdT
  const [selectedSolvent, setSelectedSolvent] = useState<string>('Ethanol');

  // Standard Solvents to specifically look for or create
  const STANDARD_SOLVENTS = [
    { name: 'Ethanol', idMatch: 'ethanol' },
    { name: 'DPG', idMatch: 'dpg' },
    { name: 'IPM', idMatch: 'ipm' },
    { name: 'TEC', idMatch: 'tec' },
    { name: 'BB (Benzyl Benzoate)', idMatch: 'benzyl benzoate' },
    { name: 'Water (Aqua)', idMatch: 'water' },
    { name: 'Jojoba Oil', idMatch: 'jojoba' }
  ];

  // --- SCALING LOGIC ---
  const handleScale = () => {
    const target = parseFloat(scaleTarget);
    if (!target || target <= 0) return;

    let ratio = 1;

    if (scaleMode === 'total') {
      if (stats.totalWeight === 0) return;
      ratio = target / stats.totalWeight;
    } else {
      // Scale by Ingredient
      const item = formula.find(i => i.ingredientId === targetIngredientId);
      if (!item || item.weight === 0) return;
      ratio = target / item.weight;
    }

    const newFormula = formula.map(item => ({
      ...item,
      weight: item.weight * ratio
    }));
    onUpdateFormula(newFormula);
  };

  // --- CONCENTRATION LOGIC ---
  const handleAdjustSolvent = () => {
    const targetPercent = parseFloat(targetConc);
    if (!targetPercent || targetPercent <= 0 || targetPercent >= 100) {
      alert("Please enter a valid target concentration (1-99%).");
      return;
    }

    if (stats.concentrateMass === 0) {
      alert("No active aromatic material found in formula.");
      return;
    }

    // 1. Calculate Required Total Weight to hit Target %
    // Formula: Concentration = Active / Total  ->  Total = Active / Concentration
    const requiredTotalWeight = stats.concentrateMass / (targetPercent / 100);

    // 2. Check for existing solvent in the formula to update
    // We look for a row that matches the selected name OR has 'Solvent' family
    const solventNameLower = selectedSolvent.toLowerCase();
    
    // Find if we already have this solvent
    let solventIndex = formula.findIndex(i => 
       i.name.toLowerCase().includes(solventNameLower) || 
       (i.family === 'Solvent' && i.name.toLowerCase().includes(selectedSolvent.split(' ')[0].toLowerCase()))
    );

    // CORRECT LOGIC FOR EXISTING ROW:
    // We need the Total Weight to become X.
    // Currently Total = (Everything Else) + (Existing Solvent Row).
    // New Solvent Weight = X - (Everything Else).
    
    let currentSolventRowWeight = 0;
    if (solventIndex !== -1) {
      currentSolventRowWeight = formula[solventIndex].weight;
    }

    const weightOfEverythingElse = stats.totalWeight - currentSolventRowWeight;
    const newTotalSolventWeight = requiredTotalWeight - weightOfEverythingElse;

    if (newTotalSolventWeight <= 0) {
      alert(`Impossible! Your formula is already weaker than ${targetPercent}%. Add more concentrate first.`);
      return;
    }

    const newFormula = [...formula];

    if (solventIndex !== -1) {
      // UPDATE existing solvent row
      newFormula[solventIndex] = {
        ...newFormula[solventIndex],
        weight: newTotalSolventWeight
      };
    } else {
      // CREATE new solvent row
      // Try to find in DB
      let dbIng = INGREDIENTS.find(i => 
        i.name.toLowerCase().includes(solventNameLower) || 
        (i.cas && i.name.toLowerCase().includes(solventNameLower))
      );
      
      // Fallback if not found perfectly, grab generic ethanol or create custom
      if (!dbIng) {
         // Try finding by ID match from our standard list
         const std = STANDARD_SOLVENTS.find(s => s.name === selectedSolvent);
         if (std) {
             dbIng = INGREDIENTS.find(i => i.name.toLowerCase().includes(std.idMatch));
         }
      }

      // If still not found, default to first solvent in DB or custom
      if (!dbIng) {
         dbIng = INGREDIENTS.find(i => i.family === 'Solvent');
      }

      const newItem: FormulaItem = {
        uuid: crypto.randomUUID(),
        ingredientId: dbIng?.id || 'custom-solvent',
        name: dbIng?.name || selectedSolvent,
        cas: dbIng?.cas || '',
        family: 'Solvent',
        note: 'Solvent',
        odorProfile: 'Solvent',
        weight: newTotalSolventWeight,
        dilution: 1.0,
        solvent: 'None',
        costPerKg: dbIng?.costPerKg || 10,
        supplier: ''
      };
      
      newFormula.push(newItem);
    }

    onUpdateFormula(newFormula);
  };

  return (
    <div className="flex flex-col gap-6 p-1">
      
      {/* SCALING ENGINE */}
      <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-blue-800">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
           <h3 className="font-bold text-sm tracking-wide">SCALING ENGINE</h3>
        </div>

        <div className="flex gap-2 mb-3 bg-gray-100 p-1 rounded-md">
          <button 
            className={`flex-1 py-1.5 text-xs font-medium rounded ${scaleMode === 'total' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setScaleMode('total')}
          >
            Total Weight
          </button>
          <button 
            className={`flex-1 py-1.5 text-xs font-medium rounded ${scaleMode === 'ingredient' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setScaleMode('ingredient')}
          >
            By Ingredient
          </button>
        </div>

        <div className="space-y-3">
           <div>
             <label className="block text-xs font-semibold text-gray-500 mb-1">
               {scaleMode === 'total' ? 'TARGET TOTAL BATCH WEIGHT (G)' : 'TARGET INGREDIENT WEIGHT (G)'}
             </label>
             <input 
               type="number" 
               placeholder="e.g. 1000"
               className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               value={scaleTarget}
               onChange={(e) => setScaleTarget(e.target.value)}
             />
           </div>

           {scaleMode === 'ingredient' && (
             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">SELECT REFERENCE INGREDIENT</label>
               <select 
                 className="w-full border border-gray-300 rounded p-2 text-sm"
                 value={targetIngredientId}
                 onChange={(e) => setTargetIngredientId(e.target.value)}
               >
                 <option value="">-- Select --</option>
                 {formula.map(ing => (
                   <option key={ing.uuid} value={ing.ingredientId || ''}>{ing.name} ({ing.weight.toFixed(3)}g)</option>
                 ))}
               </select>
             </div>
           )}

           <button 
             onClick={handleScale}
             className="w-full bg-blue-600 text-white py-2 rounded shadow hover:bg-blue-700 font-medium text-sm transition-colors"
           >
             Scale Formula
           </button>
        </div>
      </div>

      {/* SOLVENT CALCULATOR */}
      <div className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2 text-green-800">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
           <h3 className="font-bold text-sm tracking-wide">SOLVENT CALCULATOR</h3>
        </div>
        
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Select a solvent to automatically reach your target concentration (EdT/EdP). 
          Standard options included.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">TARGET CONCENTRATION (%)</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                className="w-20 border border-gray-300 rounded p-2 text-sm text-center font-bold text-gray-700"
                value={targetConc}
                onChange={(e) => setTargetConc(e.target.value)}
              />
              <div className="flex-1 flex gap-1">
                 <button onClick={() => setTargetConc('15')} className="flex-1 bg-gray-50 border border-gray-200 rounded text-xs hover:bg-gray-100 text-gray-600">EdT (15%)</button>
                 <button onClick={() => setTargetConc('20')} className="flex-1 bg-gray-50 border border-gray-200 rounded text-xs hover:bg-gray-100 text-gray-600">EdP (20%)</button>
                 <button onClick={() => setTargetConc('25')} className="flex-1 bg-gray-50 border border-gray-200 rounded text-xs hover:bg-gray-100 text-gray-600">Extrait (25%)</button>
              </div>
            </div>
          </div>

          <div>
             <label className="block text-xs font-semibold text-gray-500 mb-1">SOLVENT TO ADJUST/ADD</label>
             <select 
               className="w-full border border-gray-300 rounded p-2 text-sm"
               value={selectedSolvent}
               onChange={(e) => setSelectedSolvent(e.target.value)}
             >
               {STANDARD_SOLVENTS.map(s => (
                 <option key={s.name} value={s.name}>{s.name}</option>
               ))}
             </select>
          </div>

          <button 
             onClick={handleAdjustSolvent}
             className="w-full bg-green-600 text-white py-2 rounded shadow hover:bg-green-700 font-medium text-sm transition-colors"
           >
             Adjust Solvent
           </button>
        </div>
      </div>

    </div>
  );
};