import React, { useState, useMemo } from 'react';
import { FormulaItem, Snapshot, HistoryEntry } from '../types';

interface VersionHistoryProps {
  currentFormula: FormulaItem[];
  snapshots: Snapshot[];
  sessionLog: HistoryEntry[];
  onRestoreSnapshot: (snapshot: Snapshot) => void;
  onSaveSnapshot: (name: string, note: string) => void;
  onClearLog: () => void;
  onDeleteSnapshot: (id: string) => void;
}

// --- 1. LOGIC ENGINE (Stable Keys & Aggregation) ---

const getStableKey = (item: FormulaItem): string => {
  if (item.ingredientId) return item.ingredientId; 
  if (item.cas && item.cas.trim().length > 4) return `cas:${item.cas.trim()}`;
  return `name:${item.name.trim().toLowerCase()}`;
};

interface IngredientStats {
  name: string;
  weight: number;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  currentFormula,
  snapshots,
  sessionLog,
  onRestoreSnapshot,
  onSaveSnapshot,
  onClearLog,
  onDeleteSnapshot
}) => {
  const [activeTab, setActiveTab] = useState<'mods' | 'log'>('mods');
  const [comparingSnapshot, setComparingSnapshot] = useState<Snapshot | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showOnlyChanged, setShowOnlyChanged] = useState(true);
  
  // Input State
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const handleSaveClick = () => {
    if (!name.trim()) return;
    onSaveSnapshot(name, note);
    setName('');
    setNote('');
  };

  // --- DIFF CALCULATION ---
  const diffData = useMemo(() => {
    if (!comparingSnapshot) return null;

    // A. Grouping Summary Calculation
    const normalizeNote = (n: string) => {
      const lower = (n || '').toLowerCase();
      if (lower === 'top') return 'Top';
      if (lower === 'middle' || lower.includes('heart')) return 'Middle';
      if (lower === 'base') return 'Base';
      return 'Other';
    };

    const getNoteStats = (formula: FormulaItem[]) => {
      const stats: Record<string, number> = { Top: 0, Middle: 0, Base: 0, Total: 0 };
      formula.forEach(item => {
        stats.Total += item.weight;
        const note = normalizeNote(item.note);
        if (note !== 'Other') stats[note] += item.weight;
      });
      return stats;
    };

    const currStats = getNoteStats(currentFormula);
    const snapStats = getNoteStats(comparingSnapshot.formula);

    const noteSummary = ['Top', 'Middle', 'Base'].map(note => {
      const cVal = currStats.Total > 0 ? (currStats[note] / currStats.Total) * 100 : 0;
      const sVal = snapStats.Total > 0 ? (snapStats[note] / snapStats.Total) * 100 : 0;
      return {
        note,
        current: cVal,
        snap: sVal,
        delta: cVal - sVal
      };
    });

    // B. Row Aggregation
    const aggregate = (formula: FormulaItem[]) => {
      const map = new Map<string, IngredientStats>();
      formula.forEach(item => {
        const key = getStableKey(item);
        const existing = map.get(key);
        if (existing) {
          existing.weight += item.weight;
        } else {
          map.set(key, { name: item.name, weight: item.weight });
        }
      });
      return map;
    };

    const currMap = aggregate(currentFormula);
    const snapMap = aggregate(comparingSnapshot.formula);
    
    const allKeys = new Set([...currMap.keys(), ...snapMap.keys()]);
    const rows: any[] = [];
    
    let countChanged = 0;
    let countNew = 0;
    let countRemoved = 0;
    let countUnchanged = 0;

    allKeys.forEach(key => {
      const c = currMap.get(key);
      const s = snapMap.get(key);
      
      const cW = c?.weight || 0;
      const sW = s?.weight || 0;
      const delta = cW - sW;
      
      let status = 'UNCHANGED';
      
      if (!s && c) { status = 'NEW'; countNew++; }
      else if (s && !c) { status = 'REMOVED'; countRemoved++; }
      else if (Math.abs(delta) > 0.000001) { status = 'MODIFIED'; countChanged++; }
      else { countUnchanged++; }

      // CRITICAL: Push ALL rows so we can toggle "All" view later
      rows.push({
        key,
        name: c?.name || s?.name || 'Unknown',
        current: cW,
        snap: sW,
        delta,
        status
      });
    });

    // Sort: New > Removed > Mod > Unchanged. Then by magnitude.
    rows.sort((a, b) => {
      const score = (s: string) => {
        if (s === 'NEW') return 3;
        if (s === 'REMOVED') return 2;
        if (s === 'MODIFIED') return 1;
        return 0; // UNCHANGED
      };
      const diff = score(b.status) - score(a.status);
      if (diff !== 0) return diff;
      return Math.abs(b.delta) - Math.abs(a.delta);
    });

    return { 
      rows, 
      counts: { countChanged, countNew, countRemoved, countUnchanged },
      noteSummary 
    };
  }, [currentFormula, comparingSnapshot]);

  const visibleRows = useMemo(() => {
    if (!diffData) return [];
    return showOnlyChanged 
      ? diffData.rows.filter(r => r.status !== 'UNCHANGED')
      : diffData.rows;
  }, [diffData, showOnlyChanged]);

  // --- RENDER HELPERS ---
  const fmt = (n: number) => n.toFixed(3);
  const fmtPct = (n: number) => n.toFixed(1);

  // --- VIEW: DIFF MODE ---
  if (comparingSnapshot && diffData) {
    return (
      <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
        {/* 1. DIFF HEADER (Fixed) */}
        <div className="bg-blue-600 text-white p-3 shadow-md shrink-0 z-20 w-full box-border rounded-b-md">
          
          <div className="flex items-start justify-between gap-2 mb-3 w-full">
            {/* Left: Title Area (Truncates if too long) */}
            <div className="min-w-0 flex-1">
              <h3 className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">Comparing To</h3>
              <div className="font-bold text-sm truncate leading-tight" title={comparingSnapshot.name}>
                {comparingSnapshot.name}
              </div>
            </div>
            
            {/* Right: Controls (Shrinkable but prioritizes buttons) */}
            <div className="flex flex-col items-end gap-2 shrink-0 max-w-[50%]">
              <button 
                onClick={() => setComparingSnapshot(null)}
                className="bg-blue-800 hover:bg-blue-900 text-white text-[10px] font-bold py-1 px-3 rounded transition-colors uppercase tracking-wide whitespace-nowrap"
              >
                Close
              </button>
              
              {/* Toggle Switch */}
              <div className="flex bg-blue-800/50 p-0.5 rounded text-[10px] font-medium border border-blue-500/30 max-w-full">
                <button 
                  onClick={() => setShowOnlyChanged(true)}
                  className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${showOnlyChanged ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white'}`}
                >
                  Changed
                </button>
                <button 
                  onClick={() => setShowOnlyChanged(false)}
                  className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${!showOnlyChanged ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white'}`}
                >
                  All
                </button>
              </div>
            </div>
          </div>
          
          {/* Solid Dashboard Counters */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-wide w-full">
              <div className="bg-green-600 text-white border border-green-700/30 px-1 py-1.5 rounded shadow-sm text-center truncate">
                <span className="block text-xs mb-0.5">{diffData.counts.countNew}</span> New
              </div>
              <div className="bg-amber-500 text-white border border-amber-600/30 px-1 py-1.5 rounded shadow-sm text-center truncate">
                <span className="block text-xs mb-0.5">{diffData.counts.countChanged}</span> Mod
              </div>
              <div className="bg-red-600 text-white border border-red-700/30 px-1 py-1.5 rounded shadow-sm text-center truncate">
                <span className="block text-xs mb-0.5">{diffData.counts.countRemoved}</span> Gone
              </div>
            </div>
            
            {/* Unchanged Count Info */}
            <div className="text-[10px] text-center text-blue-200 font-medium">
              {diffData.counts.countUnchanged} items unchanged
            </div>
          </div>
        </div>

        {/* 2. GROUPING SUMMARY (Fixed) */}
        <div className="bg-white border-b border-gray-200 p-2 shrink-0 z-10 shadow-sm w-full overflow-hidden">
          <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs justify-center">
            {diffData.noteSummary.map((s) => (
              <div key={s.note} className="flex-1 min-w-[80px] max-w-[120px] bg-gray-50 border border-gray-100 rounded px-2 py-1 flex flex-col items-center justify-center">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">{s.note}</span>
                <div className="flex items-baseline gap-1 font-mono leading-none whitespace-nowrap">
                  <span className="text-gray-400">{fmtPct(s.snap)}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-gray-800 font-semibold">{fmtPct(s.current)}%</span>
                </div>
                <div className={`font-mono font-bold text-[9px] mt-0.5 whitespace-nowrap ${s.delta > 0.05 ? 'text-green-600' : s.delta < -0.05 ? 'text-red-500' : 'text-gray-300'}`}>
                  {s.delta > 0 ? '+' : ''}{fmtPct(s.delta)} pp
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. DIFF LIST (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 pr-2 custom-scrollbar bg-gray-50">
          {visibleRows.length === 0 ? (
             <div className="text-center text-gray-400 text-xs py-10 italic">
               {showOnlyChanged ? "No changes detected." : "No ingredients found."}
             </div>
          ) : (
            visibleRows.map((row) => {
              const isUnchanged = row.status === 'UNCHANGED';
              return (
                <div 
                  key={row.key} 
                  className={`border rounded p-2 text-xs shadow-sm transition-colors ${isUnchanged ? 'bg-gray-50 border-gray-200 opacity-75 hover:opacity-100' : 'bg-white border-gray-200'}`}
                >
                  {/* Top: Name + Badge */}
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`font-semibold truncate pr-2 ${isUnchanged ? 'text-gray-500' : 'text-gray-800'}`} title={row.name}>{row.name}</span>
                    {row.status === 'NEW' && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-green-200 shadow-sm shrink-0">NEW</span>}
                    {row.status === 'REMOVED' && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-red-200 shadow-sm shrink-0">GONE</span>}
                    {row.status === 'MODIFIED' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-amber-200 shadow-sm shrink-0">MOD</span>}
                  </div>
                  
                  {/* Bottom: Math */}
                  <div className="flex justify-between items-center font-mono text-[11px]">
                    <div className="text-gray-400 flex items-center gap-1">
                      <span>{row.status === 'NEW' ? '0' : fmt(row.snap)}</span>
                      <span className="text-gray-300 text-[9px]">→</span>
                      <span className={`${isUnchanged ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
                        {row.status === 'REMOVED' ? '0' : fmt(row.current)}
                      </span>
                    </div>
                    {isUnchanged ? (
                      <span className="text-gray-300 font-bold tracking-widest opacity-50">—</span>
                    ) : (
                      <div className={`font-bold ${row.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {row.delta > 0 ? '+' : ''}{fmt(row.delta)}g
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // --- VIEW: STANDARD MODE (Tabs) ---
  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200 w-full">
      
      {/* 1. TABS (Fixed) */}
      <div className="flex bg-white border-b border-gray-200 shrink-0">
        <button 
          onClick={() => setActiveTab('mods')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'mods' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Saved Mods
        </button>
        <button 
          onClick={() => setActiveTab('log')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'log' ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          History
        </button>
      </div>

      {/* 2. CONTENT AREA (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        
        {/* --- MODS TAB CONTENT --- */}
        {activeTab === 'mods' && (
          <div className="flex flex-col gap-4">
            {/* Save Form */}
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Create Snapshot</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (e.g. Mod 3)"
                className="w-full text-xs border-gray-300 rounded mb-2 p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Notes (Optional)..."
                className="w-full text-xs border-gray-300 rounded mb-2 p-2 h-16 resize-none focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={handleSaveClick}
                disabled={!name.trim()}
                className="w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded hover:bg-indigo-700 disabled:bg-gray-300 transition-colors shadow-sm"
              >
                Save Snapshot
              </button>
            </div>

            {/* List */}
            <div className="space-y-3">
              {snapshots.length === 0 && (
                <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-400">No snapshots saved.</p>
                </div>
              )}
              {snapshots.map(snap => (
                <div key={snap.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-800 text-sm truncate w-32">{snap.name}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteSnapshot(snap.id); }}
                      className="text-gray-300 hover:text-red-500 -mt-1 -mr-1 p-1"
                    >×</button>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mb-2">
                    {new Date(snap.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {snap.formula.length} Items
                  </div>
                  {snap.note && (
                    <div className="bg-gray-50 text-gray-600 text-[10px] p-1.5 rounded border border-gray-100 italic mb-2">
                      "{snap.note}"
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onRestoreSnapshot(snap)}
                      className="bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded py-1 text-[10px] font-bold uppercase"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => setComparingSnapshot(snap)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded py-1 text-[10px] font-bold uppercase"
                    >
                      Compare
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- LOG TAB CONTENT --- */}
        {activeTab === 'log' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Actions</span>
               {sessionLog.length > 0 && (
                 <button 
                   onClick={() => confirmClear ? (onClearLog(), setConfirmClear(false)) : setConfirmClear(true)}
                   className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                     confirmClear ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-red-50 hover:text-red-600'
                   }`}
                 >
                   {confirmClear ? 'Confirm?' : 'Clear'}
                 </button>
               )}
            </div>

            {sessionLog.length === 0 && (
               <div className="text-center text-gray-300 text-xs py-8 italic">No actions recorded yet.</div>
            )}

            <div className="relative pl-4 space-y-3">
              {/* Vertical Line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200"></div>
              
              {sessionLog.map((entry) => {
                // Determine Color based on action
                let dotColor = 'bg-orange-400';
                let actionColor = 'text-orange-600';
                if (entry.action.includes('Added')) { dotColor = 'bg-green-500'; actionColor = 'text-green-600'; }
                if (entry.action.includes('Removed')) { dotColor = 'bg-red-500'; actionColor = 'text-red-600'; }

                return (
                  <div key={entry.id} className="relative group">
                    {/* Dot */}
                    <div className={`absolute -left-[13px] top-3 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10 ${dotColor}`}></div>
                    
                    {/* Card */}
                    <div className="bg-white p-2.5 rounded border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${actionColor}`}>
                          {entry.action}
                        </span>
                        <span className="text-[9px] text-gray-300 font-mono">{entry.timestamp}</span>
                      </div>
                      <div className="text-xs text-gray-700 font-medium break-words leading-tight">
                        {entry.details}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};