import React, { useState, useMemo, useEffect, useRef } from 'react';
import { IngredientSearch } from './components/IngredientSearch';
import { IngredientRow, IngredientCard } from './components/IngredientRow';
import { VersionHistory } from './components/VersionHistory';
import { BatchTools } from './components/BatchTools';
import { InventoryManager } from './components/InventoryManager';
import { AccordTemplatesManager } from './components/AccordTemplatesManager';
import { SaveTemplateModal } from './components/SaveTemplateModal';
import { PrintSheet } from './components/PrintSheet';
import { FormulaItem, Snapshot, InventoryItem, HistoryEntry, FocusMode, AccordGroup, AccordTemplate, AccordTemplateItem } from './types';
import { calculateStats, checkCompliance } from './utils/engine';
import { INGREDIENTS } from './data/ingredients';

type ViewMode = 'editor' | 'stats' | 'tools' | 'stock' | 'history';

// Helper to safely parse numbers
const safeFloat = (val: any) => parseFloat(val) || 0;

// Responsive Hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
};

// Helper to determine visible columns based on Focus Mode
const getVisibleColumns = (mode: FocusMode): Set<string> => {
  const all = ['index', 'name', 'family', 'note', 'profile', 'accord', 'supplier', 'cas', 'weight', 'volume', 'sg', 'percent', 'dilution', 'solvent', 'active', 'cost', 'actions'];
  let current: string[] = [];
  
  switch(mode) {
    case 'composition': current = ['index', 'name', 'family', 'note', 'profile', 'accord', 'weight', 'percent', 'dilution', 'solvent', 'actions']; break;
    case 'regulatory': current = ['index', 'name', 'cas', 'supplier', 'weight', 'dilution', 'solvent', 'active', 'actions']; break;
    case 'lab': current = ['index', 'name', 'weight', 'volume', 'sg', 'dilution', 'solvent', 'actions']; break;
    case 'cost': current = ['index', 'name', 'supplier', 'weight', 'percent', 'cost', 'actions']; break;
    default: current = all;
  }
  return new Set(current);
}

const App: React.FC = () => {
  const isMobile = useIsMobile();
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>('editor'); // Unified View State
  const [focusMode, setFocusMode] = useState<FocusMode>('all'); // New Focus Mode State
  
  const [formula, setFormula] = useState<FormulaItem[]>([]);
  const [accordGroups, setAccordGroups] = useState<AccordGroup[]>([]);
  const [accordTemplates, setAccordTemplates] = useState<AccordTemplate[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [sessionLog, setSessionLog] = useState<HistoryEntry[]>([]); 
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [category, setCategory] = useState<string>('4');
  const [confirmClear, setConfirmClear] = useState(false);
  
  // Accord Modal State
  const [isAccordModalOpen, setIsAccordModalOpen] = useState(false);
  const [accordNameDraft, setAccordNameDraft] = useState('');

  // Template Manager Modal State
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [saveTemplateGroupId, setSaveTemplateGroupId] = useState<string | null>(null); // If not null, modal is open

  // Mobile Checklist State (Persisted)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [showOnlyUnchecked, setShowOnlyUnchecked] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGGING & DEBOUNCING REFS ---
  // Stores the active interaction: { itemId, field, startVal, currentVal, timeout }
  const loggingRef = useRef<{
    uuid: string;
    field: string;
    itemName: string;
    startValue: string | number;
    currentValue: string | number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  // ---- Persistence Logic ----
  useEffect(() => {
    try {
      const savedFormula = localStorage.getItem('perfume_formula');
      const savedAccords = localStorage.getItem('perfume_accord_groups_v1');
      const savedTemplates = localStorage.getItem('perfume_accord_templates_v1');
      const savedSnapshots = localStorage.getItem('perfume_history');
      const savedInventory = localStorage.getItem('perfume_inventory');
      const savedLog = localStorage.getItem('perfume_session_log');
      const savedFocusMode = localStorage.getItem('perfume_focus_mode');
      const savedChecklist = localStorage.getItem('perfume_checklist_v1'); // Load Checklist

      if (savedFormula) setFormula(JSON.parse(savedFormula));
      if (savedAccords) setAccordGroups(JSON.parse(savedAccords));
      if (savedTemplates) setAccordTemplates(JSON.parse(savedTemplates));
      if (savedSnapshots) setSnapshots(JSON.parse(savedSnapshots));
      if (savedInventory) setInventory(JSON.parse(savedInventory));
      if (savedLog) setSessionLog(JSON.parse(savedLog));
      if (savedFocusMode) setFocusMode(savedFocusMode as FocusMode);
      if (savedChecklist) setCheckedItems(new Set(JSON.parse(savedChecklist)));
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('perfume_formula', JSON.stringify(formula));
      localStorage.setItem('perfume_accord_groups_v1', JSON.stringify(accordGroups));
      localStorage.setItem('perfume_accord_templates_v1', JSON.stringify(accordTemplates));
      localStorage.setItem('perfume_history', JSON.stringify(snapshots));
      localStorage.setItem('perfume_inventory', JSON.stringify(inventory));
      localStorage.setItem('perfume_session_log', JSON.stringify(sessionLog));
      localStorage.setItem('perfume_focus_mode', focusMode);
      // Persist Checklist (Convert Set to Array)
      localStorage.setItem('perfume_checklist_v1', JSON.stringify(Array.from(checkedItems)));
    }
  }, [formula, accordGroups, accordTemplates, snapshots, inventory, sessionLog, focusMode, checkedItems, isLoaded]);

  // ---- Cleanup Checklist on Formula Change ----
  // If an item is removed from formula, remove it from checklist to prevent ghosts
  useEffect(() => {
    if (!isLoaded) return;
    const currentIds = new Set(formula.map(i => i.uuid));
    let hasChanges = false;
    const nextChecked = new Set(checkedItems);
    
    checkedItems.forEach(id => {
      if (!currentIds.has(id)) {
        nextChecked.delete(id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setCheckedItems(nextChecked);
    }
  }, [formula, isLoaded]); // Intentionally omitting checkedItems to avoid loop, reliance on formula change trigger

  // ---- Logging Helper (Direct) ----
  const logAction = (action: string, details: string) => {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action,
      details
    };
    setSessionLog(prev => [entry, ...prev].slice(0, 100)); // Keep last 100 actions
  };

  const handleClearLog = () => {
    // Confirmation is handled in the UI component (Two-step button)
    setSessionLog([]);
    localStorage.removeItem('perfume_session_log');
  };

  // ---- Debounced Logging Engine ----
  const handleDebouncedLog = (uuid: string, itemName: string, field: string, startVal: any, endVal: any) => {
    // 1. Check if we have an active pending log for the SAME item and field
    if (loggingRef.current && loggingRef.current.uuid === uuid && loggingRef.current.field === field) {
      // UPDATE existing pending log
      clearTimeout(loggingRef.current.timer);
      loggingRef.current.currentValue = endVal;
      
      // Reset timer (debounce)
      loggingRef.current.timer = setTimeout(() => {
        commitPendingLog();
      }, 1500); // Wait 1.5s after last change
    } else {
      // 2. Different action? FLUSH current pending log immediately
      if (loggingRef.current) {
        commitPendingLog();
      }

      // 3. Start NEW pending log
      // Only start if values differ significantly
      if (JSON.stringify(startVal) !== JSON.stringify(endVal)) {
        loggingRef.current = {
          uuid,
          field,
          itemName,
          startValue: startVal,
          currentValue: endVal,
          timer: setTimeout(() => {
            commitPendingLog();
          }, 1500)
        };
      }
    }
  };

  const commitPendingLog = () => {
    if (!loggingRef.current) return;
    
    const { itemName, field, startValue, currentValue } = loggingRef.current;
    
    // Final check to ensure it actually changed
    if (startValue !== currentValue) {
      let formattedStart = typeof startValue === 'number' ? startValue.toFixed(3) : startValue;
      let formattedEnd = typeof currentValue === 'number' ? currentValue.toFixed(3) : currentValue;
      
      // Formatting tweak for Volume/Weight
      if (field === 'weight' || field === 'volume') {
         formattedStart += 'g';
         formattedEnd += 'g';
      }

      logAction(`Updated ${itemName} ${field}`, `${formattedStart} → ${formattedEnd}`);
    }

    // Cleanup
    clearTimeout(loggingRef.current.timer);
    loggingRef.current = null;
  };

  // ---- Logic Engine ----
  const stats = useMemo(() => calculateStats(formula), [formula]);
  
  const complianceReport = useMemo(() => 
    checkCompliance(formula, stats.totalWeight, category), 
  [formula, stats.totalWeight, category]);

  const nonCompliantCount = complianceReport.filter(c => !c.isCompliant || c.limit === 0).length;

  // ---- Note Breakdown Logic ----
  const noteBreakdown = useMemo(() => {
    let top = 0, mid = 0, base = 0, other = 0;
    
    formula.forEach(item => {
      // Use active mass (weight * dilution) for classification
      const active = item.weight * (item.dilution ?? 1);
      const n = (item.note || '').toLowerCase();
      
      if (n === 'top') top += active;
      else if (n === 'middle' || n === 'heart') mid += active;
      else if (n === 'base') base += active;
      else if (n === 'solvent') {
        // Do not add to active buckets; 'solvent' note ingredients contribute to the solvent mass below
      } else {
        other += active;
      }
    });

    // Solvent mass = Total Weight - Sum of Active Aromatics
    // This correctly captures both diluents (inactive part) and ingredients marked as Note: Solvent
    const aromaticsMass = top + mid + base + other;
    const solvent = Math.max(0, stats.totalWeight - aromaticsMass);

    return { top, mid, base, other, solvent };
  }, [formula, stats.totalWeight]);

  // Visible columns computed state
  const visibleColumns = useMemo(() => getVisibleColumns(focusMode), [focusMode]);

  // ---- Mobile Display Logic (Sorting & Grouping) ----
  const mobileDisplayFormula = useMemo(() => {
    let list = [...formula];
    
    // 1. Filter Unchecked
    if (showOnlyUnchecked) {
      list = list.filter(i => !checkedItems.has(i.uuid));
    }

    // 2. Sort: Unchecked First > Note Order > Original Insertion (Stable)
    const noteRank: Record<string, number> = { 'Top': 0, 'Middle': 1, 'Base': 2, 'Solvent': 3 };
    const getRank = (n: string) => noteRank[n] ?? 4; // Unknowns last

    list.sort((a, b) => {
      // Primary: Unchecked (0) vs Checked (1)
      const aChecked = checkedItems.has(a.uuid) ? 1 : 0;
      const bChecked = checkedItems.has(b.uuid) ? 1 : 0;
      if (aChecked !== bChecked) return aChecked - bChecked;

      // Secondary: Note Group
      const aRank = getRank(a.note);
      const bRank = getRank(b.note);
      if (aRank !== bRank) return aRank - bRank;

      return 0; // Maintain original insertion order if same group
    });

    return list;
  }, [formula, checkedItems, showOnlyUnchecked]);

  // ---- Handlers ----
  const addIngredient = (inputVal: string) => {
    // Flush any pending logs before adding (so the add action appears after edits)
    if (loggingRef.current) commitPendingLog();

    let ing = INGREDIENTS.find(i => i.id === inputVal);
    let isCustom = false;
    if (!ing) isCustom = true;

    const newItem: FormulaItem = {
      uuid: crypto.randomUUID(),
      ingredientId: isCustom ? null : ing!.id,
      name: isCustom ? inputVal : ing!.name,
      cas: isCustom ? '' : ing!.cas,
      family: isCustom ? 'Custom' : ing!.family,
      note: isCustom ? 'Middle' : ing!.note, 
      odorProfile: isCustom ? '' : ing!.odorProfile,
      weight: 0,
      dilution: isCustom ? 1.0 : ing!.dilution,
      solvent: isCustom ? 'None' : ing!.solvent,
      costPerKg: isCustom ? 0 : (ing!.costPerKg || 0),
      supplier: '',
      accordId: null
    };
    
    logAction('Added Ingredient', newItem.name);
    setFormula(prev => [...prev, newItem]);
  };

  const updateItem = (uuid: string, field: keyof FormulaItem | 'volume', value: any) => {
    setFormula(prev => {
      // 1. Find the item
      const itemIndex = prev.findIndex(i => i.uuid === uuid);
      if (itemIndex === -1) return prev;
      
      const oldItem = prev[itemIndex];
      const newItem = { ...oldItem };

      // 2. Calculate New Values & Log
      // Density Logic
      const dbIng = newItem.ingredientId ? INGREDIENTS.find(i => i.id === newItem.ingredientId) : null;
      const density = newItem.customDensity ?? (dbIng ? dbIng.density : 1.0);

      if (field === 'weight') {
        const val = safeFloat(value);
        handleDebouncedLog(uuid, newItem.name, 'weight', newItem.weight, val);
        newItem.weight = val;
      } 
      else if (field === 'volume') {
        const vol = safeFloat(value);
        const calculatedWeight = vol * density;
        handleDebouncedLog(uuid, newItem.name, 'weight', newItem.weight, calculatedWeight);
        newItem.weight = calculatedWeight;
      } 
      else if (field === 'customDensity') {
        const val = safeFloat(value) || 1.0;
        // Don't debounce SG changes usually, but safer to do so
        handleDebouncedLog(uuid, newItem.name, 'SG', newItem.customDensity ?? 1.0, val);
        newItem.customDensity = val;
      }
      else {
        // Generic Fields (Name, Dilution, etc)
        // @ts-ignore
        handleDebouncedLog(uuid, newItem.name, field as string, newItem[field], value);
        // @ts-ignore
        newItem[field] = value;
      }

      // 3. Return new state
      const newArr = [...prev];
      newArr[itemIndex] = newItem;
      return newArr;
    });
  };

  const removeIngredient = (uuid: string) => {
    if (loggingRef.current) commitPendingLog(); // Flush edits first

    const item = formula.find(i => i.uuid === uuid);
    if (item) {
        logAction('Removed Ingredient', item.name);
    }
    setFormula(prev => prev.filter(item => item.uuid !== uuid));
  };

  // --- Accord Group Handlers ---
  const handleAddAccord = () => {
    setAccordNameDraft('');
    setIsAccordModalOpen(true);
  };

  const handleConfirmAccord = () => {
    if (!accordNameDraft.trim()) return;
    const name = accordNameDraft.trim();
    
    const newGroup: AccordGroup = {
      id: crypto.randomUUID(),
      name: name,
      collapsed: false
    };
    
    setAccordGroups(prev => [...prev, newGroup]);
    logAction('Created Accord', name);
    setIsAccordModalOpen(false);
  };

  const handleDeleteAccord = (id: string) => {
    const group = accordGroups.find(g => g.id === id);
    if (!group) return;
    
    if (window.confirm(`Delete accord "${group.name}"? Ingredients will be ungrouped.`)) {
      // 1. Unassign items
      setFormula(prev => prev.map(item => item.accordId === id ? { ...item, accordId: null } : item));
      // 2. Remove group
      setAccordGroups(prev => prev.filter(g => g.id !== id));
      logAction('Deleted Accord', group.name);
    }
  };

  const handleToggleAccord = (id: string) => {
    setAccordGroups(prev => prev.map(g => g.id === id ? { ...g, collapsed: !g.collapsed } : g));
  };

  const handleSetAccord = (uuid: string, accordId: string | null) => {
    updateItem(uuid, 'accordId', accordId);
  };

  const handleScaleAccord = (accordId: string) => {
    // 1. Get items
    const groupItems = formula.filter(i => i.accordId === accordId);
    if (groupItems.length === 0) return;

    // 2. Get current weight
    const currentWeight = groupItems.reduce((sum, i) => sum + i.weight, 0);
    if (currentWeight <= 0) {
      alert("Cannot scale an empty or zero-weight accord.");
      return;
    }

    // 3. Prompt
    const input = window.prompt(`Scale "${accordGroups.find(g => g.id === accordId)?.name}" to new total weight (g):`, currentWeight.toFixed(3));
    if (!input) return;

    const targetWeight = parseFloat(input);
    if (isNaN(targetWeight) || targetWeight < 0) {
      alert("Invalid weight.");
      return;
    }

    // 4. Calculate ratio
    const ratio = targetWeight / currentWeight;

    // 5. Update formula
    const newFormula = formula.map(item => {
      if (item.accordId === accordId) {
        return { ...item, weight: item.weight * ratio };
      }
      return item;
    });

    if (loggingRef.current) commitPendingLog();
    setFormula(newFormula);
    logAction('Scaled Accord', `${accordGroups.find(g => g.id === accordId)?.name}: ${currentWeight.toFixed(3)}g -> ${targetWeight.toFixed(3)}g`);
  };

  // --- Template Handlers ---
  
  const handleSaveAsTemplate = (name: string) => {
    if (!saveTemplateGroupId) return;
    
    // 1. Get group and items
    const group = accordGroups.find(g => g.id === saveTemplateGroupId);
    const items = formula.filter(i => i.accordId === saveTemplateGroupId);
    
    if (!group || items.length === 0) {
      setSaveTemplateGroupId(null);
      return;
    }

    // 2. Calculate Total Weight for Ratios
    const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
    if (totalWeight <= 0) {
      alert("Cannot save template with 0 total weight.");
      setSaveTemplateGroupId(null);
      return;
    }

    // 3. Construct Template
    const templateItems: AccordTemplateItem[] = items.map(i => ({
      ratio: i.weight / totalWeight,
      ingredientId: i.ingredientId,
      name: i.name,
      cas: i.cas,
      family: i.family,
      note: i.note,
      odorProfile: i.odorProfile,
      dilution: i.dilution,
      solvent: i.solvent,
      costPerKg: i.costPerKg,
      supplier: i.supplier,
      customDensity: i.customDensity
    }));

    const newTemplate: AccordTemplate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: Date.now(),
      items: templateItems
    };

    setAccordTemplates(prev => [...prev, newTemplate]);
    logAction('Saved Template', name);
    setSaveTemplateGroupId(null);
  };

  const handleInsertTemplate = (templateId: string, targetWeight: number) => {
    const template = accordTemplates.find(t => t.id === templateId);
    if (!template) return;

    // 1. Create New Accord Group
    const newGroupId = crypto.randomUUID();
    const newGroup: AccordGroup = {
      id: newGroupId,
      name: template.name,
      collapsed: false
    };

    // 2. Instantiate Items
    const newItems: FormulaItem[] = template.items.map(tItem => ({
      uuid: crypto.randomUUID(),
      accordId: newGroupId,
      weight: tItem.ratio * targetWeight,
      // Copied fields
      ingredientId: tItem.ingredientId,
      name: tItem.name,
      cas: tItem.cas,
      family: tItem.family,
      note: tItem.note,
      odorProfile: tItem.odorProfile,
      dilution: tItem.dilution,
      solvent: tItem.solvent,
      costPerKg: tItem.costPerKg,
      supplier: tItem.supplier,
      customDensity: tItem.customDensity
    }));

    // 3. Update State
    if (loggingRef.current) commitPendingLog();
    setAccordGroups(prev => [...prev, newGroup]);
    setFormula(prev => [...prev, ...newItems]);
    logAction('Inserted Template', `${template.name} (${targetWeight}g)`);
  };

  const handleDeleteTemplate = (id: string) => {
    setAccordTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleImportAccordTemplates = (incomingTemplates: AccordTemplate[]) => {
    setAccordTemplates(prev => {
      // 1. Initialize Set with EXISTING IDs
      const usedIds = new Set(prev.map(t => t.id));
      const finalImported: AccordTemplate[] = [];

      for (const t of incomingTemplates) {
        let newId = t.id;
        
        // 2. Conflict check: if missing OR exists in 'prev' OR exists in 'finalImported' so far (via usedIds)
        if (!newId || typeof newId !== 'string' || usedIds.has(newId)) {
          newId = crypto.randomUUID();
          // 3. Paranoid unique check in case of collision
          while (usedIds.has(newId)) {
             newId = crypto.randomUUID();
          }
        }
        
        // 4. Mark ID as used for subsequent iterations
        usedIds.add(newId);
        
        // 5. Add to batch with safe ID
        finalImported.push({ ...t, id: newId });
      }

      // 6. Append to state
      return [...prev, ...finalImported];
    });
    
    logAction('Imported Templates', `${incomingTemplates.length} templates added`);
  };

  // --- Stock Handlers ---
  const handleAddStock = (item: InventoryItem) => {
    setInventory(prev => [item, ...prev]);
  };

  const handleDeleteStock = (id: string) => {
    setInventory(prev => prev.filter(i => i.id !== id));
  };

  const handleSyncCosts = () => {
    if (inventory.length === 0) {
      alert("No items in inventory to sync.");
      return;
    }
    let updatedCount = 0;
    const newFormula = formula.map(fItem => {
      let match: InventoryItem | undefined;
      if (fItem.ingredientId) {
        match = inventory.find(inv => inv.ingredientId === fItem.ingredientId);
      }
      if (!match && fItem.cas && fItem.cas.length > 4) {
         match = inventory.find(inv => {
            const dbIng = INGREDIENTS.find(i => i.id === inv.ingredientId);
            return dbIng && dbIng.cas === fItem.cas;
         });
      }
      if (!match) {
        const formulaName = fItem.name.toLowerCase().trim();
        match = inventory.find(inv => inv.name.toLowerCase().trim() === formulaName);
      }
      if (match) {
        updatedCount++;
        return { ...fItem, costPerKg: match.costPerKg };
      }
      return fItem;
    });
    setFormula(newFormula);
    alert(`Updated costs for ${updatedCount} ingredients based on inventory prices.`);
  };

  const handleSaveSnapshot = (name: string, note: string) => {
    if (loggingRef.current) commitPendingLog();
    const newSnap: Snapshot = {
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now(),
      // FORCE DEEP COPY to prevent real-time updates of snapshots
      formula: JSON.parse(JSON.stringify(formula)),
      note
    };
    logAction('Created Snapshot', name);
    setSnapshots(prev => [newSnap, ...prev]);
  };

  const handleRestoreSnapshot = (snap: Snapshot) => {
    if (loggingRef.current) commitPendingLog();
    logAction('Restored Snapshot', snap.name);
    // FORCE DEEP COPY on restore to prevent linking
    setFormula(JSON.parse(JSON.stringify(snap.formula)));
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
  };

  const handleClear = () => {
    if (confirmClear) {
      if (loggingRef.current) commitPendingLog();
      logAction('Cleared Formula', 'All items removed');
      setFormula([]);
      setConfirmClear(false);
      setCheckedItems(new Set()); // Reset mobile checklist too
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  // Checklist Helpers
  const toggleCheck = (uuid: string) => {
    const next = new Set(checkedItems);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    setCheckedItems(next);
  };

  const resetChecklist = () => setCheckedItems(new Set());

  // ROBUST PRINT HANDLER
  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Small timeout to ensure DOM is ready if needed, though mostly for event loop clearance
    setTimeout(() => window.print(), 0);
  };

  const handleExportCSV = () => {
    // 1. Ingredients Section
    const headers = ["Name", "CAS", "Family", "Accord", "Weight (g)", "Volume (ml)", "Dilution (%)", "Solvent", "Cost (Eur/kg)", "% in Formula"];
    const ingredientRows = formula.map(item => {
      const dbIng = item.ingredientId ? INGREDIENTS.find(i => i.id === item.ingredientId) : null;
      const density = item.customDensity ?? (dbIng ? dbIng.density : 1.0);
      const vol = item.weight / density;
      const percent = stats.totalWeight > 0 ? (item.weight / stats.totalWeight) * 100 : 0;
      const safeName = `"${item.name.replace(/"/g, '""')}"`;
      const accordName = item.accordId ? accordGroups.find(g => g.id === item.accordId)?.name || '' : '';
      return [
        safeName, 
        item.cas, 
        item.family,
        accordName,
        item.weight.toFixed(3), 
        vol.toFixed(3), 
        (item.dilution * 100).toFixed(2), 
        item.solvent, 
        item.costPerKg, 
        percent.toFixed(2)
      ].join(",");
    });

    // 2. Stats Section
    const spacer = "\n\n";
    const statsHeader = "BATCH STATISTICS,,,,,";
    const statsRow1 = `Total Weight (g),${stats.totalWeight.toFixed(3)}`;
    const statsRow2 = `Total Volume (ml),${stats.totalVolume.toFixed(3)}`;
    const statsRow3 = `Active Material (g),${stats.concentrateMass.toFixed(3)}`;
    const statsRow4 = `Est. Cost (EUR),${stats.totalCost.toFixed(2)}`;

    // 3. Solvent Section
    const solventHeader = "\nSOLVENT BREAKDOWN,,,,,";
    const solventRows = stats.solventAnalysis.breakdown.length > 0 
      ? stats.solventAnalysis.breakdown.map(s => `${s.name},${s.mass.toFixed(3)} g / ${s.volume.toFixed(3)} ml`).join("\n") 
      : "No solvents detected,,,,,";

    // 4. IFRA Section
    const ifraStatus = nonCompliantCount > 0 ? `FAIL (${nonCompliantCount} Issues)` : "PASS";
    const ifraHeader = `\nIFRA COMPLIANCE CHECK (Cat ${category}),${ifraStatus},,,,`;
    const ifraRows = complianceReport
      .filter(r => !r.isCompliant || r.limit === 0)
      .map(r => {
        const safeName = `"${r.name.replace(/"/g, '""')}"`;
        return `${safeName},Limit: ${(r.limit * 100).toFixed(3)}%,Actual: ${(r.concentration * 100).toFixed(3)}%,REASON: ${r.reason}`;
      }).join("\n");

    const csvContent = [
      headers.join(","),
      ...ingredientRows,
      spacer,
      statsHeader,
      statsRow1,
      statsRow2,
      statsRow3,
      statsRow4,
      solventHeader,
      solventRows,
      ifraHeader,
      ifraRows
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `formula_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveJSON = () => {
    // V2 Format: Include accordGroups
    const payload = {
      version: 2,
      formula: formula,
      accordGroups: accordGroups
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `formula_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (loggingRef.current) commitPendingLog();
        
        // Handle V1 (Array)
        if (Array.isArray(parsed)) {
            logAction('Loaded JSON (V1)', file.name);
            setFormula(parsed);
            setAccordGroups([]); // Clear stale accords
        } 
        // Handle V2 (Object)
        else if (parsed.formula && Array.isArray(parsed.formula)) {
            logAction('Loaded JSON (V2)', file.name);
            setFormula(parsed.formula);
            if (parsed.accordGroups && Array.isArray(parsed.accordGroups)) {
              setAccordGroups(parsed.accordGroups);
            } else {
              setAccordGroups([]);
            }
        }
      } catch (error) { alert("Error parsing JSON file."); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading Formulator...</div>;

  // --- Layout Constants ---
  const desktopMainView = activeView === 'stock' ? 'stock' : 'editor';
  const desktopSidebarTab = (activeView === 'stock' || activeView === 'editor') ? 'stats' : activeView;

  // --- COMPONENT: STATS PANEL (Resuable) ---
  const StatsPanel = () => (
    <div className="flex flex-col gap-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-sm">
        <label className="block text-xs font-bold text-blue-800 mb-2 uppercase">Application</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full text-sm border-gray-300 rounded p-2">
          <option value="4">Cat 4: Fine Fragrance</option>
          <option value="5A">Cat 5A: Body Lotion</option>
          <option value="9">Cat 9: Rinse-off Soap</option>
        </select>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
         <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Stats</h2>
         <div className="space-y-2 text-sm">
           <div className="flex justify-between"><span className="text-gray-600">Weight</span><span className="font-mono font-bold">{stats.totalWeight.toFixed(3)} g</span></div>
           <div className="flex justify-between"><span className="text-gray-600">Volume</span><span className="font-mono font-bold">{stats.totalVolume.toFixed(3)} ml</span></div>
           <div className="flex justify-between"><span className="text-gray-600">Active</span><span className="font-mono font-bold text-blue-700">{stats.concentrateMass.toFixed(3)} g</span></div>
           <div className="flex justify-between"><span className="text-gray-600">Cost</span><span className="font-mono font-bold text-green-700">€{stats.totalCost.toFixed(2)}</span></div>
         </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">NOTE BREAKDOWN</h2>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Top', mass: noteBreakdown.top },
            { label: 'Middle', mass: noteBreakdown.mid },
            { label: 'Base', mass: noteBreakdown.base },
            { label: 'Other', mass: noteBreakdown.other },
            { label: 'Solvent', mass: noteBreakdown.solvent }
          ].map(row => {
            if (row.label === 'Other' && row.mass <= 0.001) return null;
            const pct = stats.totalWeight > 0 ? (row.mass / stats.totalWeight) * 100 : 0;
            return (
              <div key={row.label} className="flex justify-between">
                <span className="text-gray-600">{row.label}</span>
                <span className="font-mono font-bold">
                  {pct.toFixed(1)}% <span className="text-gray-400 font-normal text-xs">({row.mass.toFixed(3)}g)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Solvent Analysis</h2>
        
        {stats.solventAnalysis.breakdown.length > 0 ? (
          <div className="space-y-3">
            {stats.solventAnalysis.breakdown.map(s => (
              <div key={s.name} className="flex justify-between items-center text-xs">
                <span className="text-gray-600 font-medium">{s.name}</span>
                <div className="font-mono text-gray-800 text-right">
                  <div>{s.volPct.toFixed(1)}% <span className="text-gray-400 text-[10px]">(v/v)</span></div>
                  <div className="text-[10px] text-gray-400">{s.volume.toFixed(1)} ml</div>
                </div>
              </div>
            ))}
            
            <div className="border-t border-gray-100 my-2 pt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-gray-700">Ethanol (v/v)</span>
                <span className="font-mono font-bold text-sm">{stats.solventAnalysis.ethanolVvPct.toFixed(1)}%</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700">Est. Flash Point</span>
                {stats.solventAnalysis.flashPointEstimate.celsius !== null ? (
                  <span className={`font-mono font-bold text-sm ${stats.solventAnalysis.flashPointEstimate.rating === 'High' ? 'text-red-600' : stats.solventAnalysis.flashPointEstimate.rating === 'Flammable' ? 'text-orange-500' : 'text-green-600'}`}>
                    ~{stats.solventAnalysis.flashPointEstimate.celsius.toFixed(0)}°C
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">N/A</span>
                )}
              </div>
              
              {stats.solventAnalysis.flashPointEstimate.celsius !== null && (
                <div className={`mt-2 text-[10px] p-1.5 rounded border ${stats.solventAnalysis.flashPointEstimate.rating === 'High' ? 'bg-red-50 border-red-200 text-red-700' : stats.solventAnalysis.flashPointEstimate.rating === 'Flammable' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                  <strong>Warning:</strong> {stats.solventAnalysis.flashPointEstimate.warning}
                </div>
              )}
              
              <p className="text-[9px] text-gray-400 mt-2 italic leading-tight">
                * Flash point is an ESTIMATE based on Ethanol-Water equivalent. Validate against SDS and applicable transport/shipping rules.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">No solvents detected in formula.</div>
        )}
      </div>

      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <div className="flex justify-between mb-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase">IFRA Check</h2>
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${nonCompliantCount > 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
            {nonCompliantCount > 0 ? `${nonCompliantCount} Issues` : 'Pass'}
          </span>
        </div>
        <div className="space-y-2">
          {complianceReport.map(r => {
            const isIssue = !r.isCompliant || r.limit === 0;
            return (
              <div key={r.cas} className={`text-xs p-2 rounded border ${isIssue ? 'bg-red-50 border-red-200 text-red-900' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                <div className="flex justify-between font-bold">
                  <span className="truncate w-32">{r.name}</span>
                  <span>{(r.concentration * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between opacity-80 mt-1">
                  <span>Max: {(r.limit * 100).toFixed(2)}%</span>
                  {r.limit === 0 && <span className="text-red-600 font-bold">BANNED</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-gray-900 font-sans app-container">
      
      {/* MOBILE NAV (Top Fixed) */}
      <nav className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-50 overflow-x-auto whitespace-nowrap">
        <div className="flex px-2">
          {(['editor', 'stats', 'tools', 'stock', 'history'] as ViewMode[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveView(tab)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeView === tab ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-gray-500'
              }`}
            >
              {tab === 'editor' ? 'Formula' : tab === 'stock' ? 'Inventory' : tab === 'history' ? 'Mods' : tab}
            </button>
          ))}
        </div>
      </nav>

      {/* DESKTOP SIDEBAR (Visible >= md) */}
      <aside className="hidden md:flex w-80 bg-white border-r border-gray-200 flex-col shrink-0 h-screen sticky top-0 overflow-hidden shadow-sm z-30">
        <div className="p-6 pb-4 shrink-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Artisan<br/>Perfume Formulator</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">Regulatory Intelligence Engine</p>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          {(['stats', 'tools', 'stock', 'history'] as ViewMode[]).map(tab => (
            <button 
              key={tab}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeView === tab ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'
              }`}
              onClick={() => setActiveView(tab)}
            >
              {tab === 'history' ? 'Mods' : tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* If we are in STOCK mode on desktop, sidebar shows Stats by default to keep layout populated */}
          {(desktopSidebarTab === 'stats' || activeView === 'stock' || activeView === 'editor') && (
             <StatsPanel />
          )}

          {activeView === 'tools' && <BatchTools formula={formula} stats={stats} onUpdateFormula={setFormula} />}
          
          {activeView === 'history' && (
            <VersionHistory 
              snapshots={snapshots} 
              sessionLog={sessionLog}
              currentFormula={formula}
              onSaveSnapshot={handleSaveSnapshot} 
              onRestoreSnapshot={handleRestoreSnapshot} 
              onDeleteSnapshot={handleDeleteSnapshot} 
              onClearLog={handleClearLog}
            />
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white min-h-0 relative">
        
        {/* --- DESKTOP VIEW: Stock Mode takes over Main Area --- */}
        {desktopMainView === 'stock' || (!isMobile && activeView === 'stock') ? (
           <div className="h-full overflow-auto p-4 md:p-8">
             <InventoryManager 
                inventory={inventory}
                onAddStock={handleAddStock}
                onDeleteStock={handleDeleteStock}
                onSyncCosts={handleSyncCosts}
             />
           </div>
        ) : null}

        {/* --- FORMULA EDITOR (Default Main View) --- */}
        {((!isMobile && activeView !== 'stock') || (isMobile && activeView === 'editor')) && (
          <>
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 px-4 py-4 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center sticky top-0 z-40 shadow-sm print:hidden">
              <input type="file" ref={fileInputRef} onChange={handleLoadJSON} accept=".json" className="hidden" />
              <div className="w-full max-w-md">
                <IngredientSearch ingredients={INGREDIENTS} onAdd={(ing) => addIngredient(ing.id)} onAddNew={(name) => addIngredient(name)} />
              </div>
              
              {/* Focus Mode Controls */}
              <div className="flex bg-gray-100 p-1 rounded-md overflow-x-auto max-w-full items-center gap-1">
                {(['all', 'composition', 'regulatory', 'lab', 'cost'] as FocusMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setFocusMode(mode)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors ${
                      focusMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
                
                {/* Add Accord Button */}
                <button
                  onClick={handleAddAccord}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors text-purple-600 hover:bg-purple-50 ml-1 border border-purple-200"
                >
                  + Accord
                </button>

                {/* Templates Button */}
                <button
                  onClick={() => setIsTemplateManagerOpen(true)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm whitespace-nowrap transition-colors text-teal-600 hover:bg-teal-50 ml-1 border border-teal-200"
                >
                  Templates
                </button>
              </div>

              <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
                <button onClick={handleClear} className={`btn-danger ${confirmClear ? 'bg-red-700' : ''}`}>{confirmClear ? "Confirm" : "Clear"}</button>
                <div className="h-8 w-px bg-gray-300 mx-1 hidden sm:block"></div>
                <button onClick={handleSaveJSON} className="px-3 py-2 text-xs bg-white border border-gray-300 rounded font-medium hover:bg-gray-50">Save JSON</button>
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-xs bg-white border border-gray-300 rounded font-medium hover:bg-gray-50">Load JSON</button>
                <button onClick={handleExportCSV} className="px-3 py-2 text-xs bg-white border border-gray-300 rounded font-medium hover:bg-gray-50">CSV</button>
                <button onClick={handlePrint} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 shadow-sm" type="button">Print</button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 p-4 md:p-6">
              
              {/* MOBILE: CARD LIST */}
              {isMobile ? (
                <div className="space-y-3 pb-20">
                  {formula.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-10 italic">Start your formula by searching above.</div>
                  ) : (
                    <>
                      {/* Mobile Checklist Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 bg-gray-100 p-2 rounded max-w-full">
                        <span className="text-[10px] font-bold text-gray-500 uppercase min-w-0 flex-1 truncate">Lab Checklist</span>
                        <div className="flex gap-3 shrink-0">
                          <button 
                            onClick={() => setShowOnlyUnchecked(!showOnlyUnchecked)}
                            className={`text-xs font-medium px-2 py-1 rounded transition-colors ${showOnlyUnchecked ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border'}`}
                          >
                            {showOnlyUnchecked ? 'Show All' : 'Unchecked Only'}
                          </button>
                          <button onClick={resetChecklist} className="text-xs text-gray-500 hover:text-red-600 underline">Reset</button>
                        </div>
                      </div>
                      
                      {mobileDisplayFormula.map((item, i, arr) => {
                        // Section Header Logic
                        const showHeader = i === 0 || item.note !== arr[i-1].note || (checkedItems.has(item.uuid) !== checkedItems.has(arr[i-1].uuid));
                        const isChecked = checkedItems.has(item.uuid);
                        const headerText = isChecked ? "Completed" : `${item.note || 'Other'} Notes`;
                        
                        // Avoid duplicates if we transition from unchecked 'Base' to checked 'Base' - strictly separate by check status first
                        const prevChecked = i > 0 ? checkedItems.has(arr[i-1].uuid) : null;
                        const justBecameChecked = i > 0 && !prevChecked && isChecked;
                        
                        return (
                          <React.Fragment key={item.uuid}>
                            {(showHeader || justBecameChecked) && (
                              <div className={`checklist-header ${isChecked ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {justBecameChecked || (isChecked && i===0) ? "Completed Items" : headerText}
                              </div>
                            )}
                            <IngredientCard 
                              item={item}
                              index={0} // Not used in card
                              percent={stats.totalWeight > 0 ? (item.weight / stats.totalWeight) * 100 : 0}
                              visibleColumns={visibleColumns}
                              onChange={updateItem}
                              onRemove={removeIngredient}
                              isChecked={checkedItems.has(item.uuid)}
                              onToggleCheck={() => toggleCheck(item.uuid)}
                              accordGroups={accordGroups}
                              onSetAccord={handleSetAccord}
                            />
                          </React.Fragment>
                        );
                      })}
                    </>
                  )}
                </div>
              ) : (
                /* DESKTOP: TABLE */
                <div className="table-container">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 uppercase tracking-wider text-[11px] font-bold sticky top-0 z-10 shadow-sm">
                      <tr>
                        {visibleColumns.has('index') && <th className="py-3 px-2 w-10 text-center bg-gray-50">#</th>}
                        {visibleColumns.has('name') && <th className="py-3 px-2 min-w-[200px] bg-gray-50">Ingredient</th>}
                        {visibleColumns.has('family') && <th className="py-3 px-2 w-32 bg-gray-50">Family</th>}
                        {visibleColumns.has('note') && <th className="py-3 px-2 w-24 bg-gray-50">Note</th>}
                        {visibleColumns.has('profile') && <th className="py-3 px-2 w-40 bg-gray-50">Profile</th>}
                        {visibleColumns.has('accord') && <th className="py-3 px-2 w-32 bg-gray-50">Accord</th>}
                        {visibleColumns.has('supplier') && <th className="py-3 px-2 w-24 bg-gray-50">Supplier</th>}
                        {visibleColumns.has('cas') && <th className="py-3 px-2 w-24 bg-gray-50">CAS</th>}
                        {visibleColumns.has('weight') && <th className="py-3 px-2 w-32 bg-gray-50">Weight</th>}
                        {visibleColumns.has('volume') && <th className="py-3 px-2 w-32 bg-gray-50">Vol</th>}
                        {visibleColumns.has('sg') && <th className="py-3 px-2 w-14 text-center bg-gray-50" title="Specific Gravity">SG</th>}
                        {visibleColumns.has('percent') && <th className="py-3 px-2 w-16 text-right bg-gray-50">%</th>}
                        {visibleColumns.has('dilution') && <th className="py-3 px-2 w-20 bg-gray-50">Dilution</th>}
                        {visibleColumns.has('solvent') && <th className="py-3 px-2 w-20 bg-gray-50">Solvent</th>}
                        {visibleColumns.has('active') && <th className="py-3 px-2 w-24 text-right bg-gray-50">Active</th>}
                        {visibleColumns.has('cost') && <th className="py-3 px-2 w-24 text-right bg-gray-50">Cost</th>}
                        {visibleColumns.has('actions') && <th className="py-3 px-2 w-10 bg-gray-50"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {formula.length === 0 ? (
                        <tr><td colSpan={visibleColumns.size} className="py-20 text-center text-gray-400">Start your formula by searching above.</td></tr>
                      ) : (
                        // Desktop Grouped Rendering
                        (() => {
                          const groupedItems = new Map<string, FormulaItem[]>();
                          const ungroupedItems: FormulaItem[] = [];
                          
                          formula.forEach(item => {
                            // Defensive: Only group if accordId exists AND the group is valid
                            if (item.accordId && accordGroups.some(g => g.id === item.accordId)) {
                              if (!groupedItems.has(item.accordId)) groupedItems.set(item.accordId, []);
                              groupedItems.get(item.accordId)!.push(item);
                            } else {
                              ungroupedItems.push(item);
                            }
                          });

                          let runningIndex = 0;
                          const hasAccords = accordGroups.length > 0;

                          return (
                            <>
                              {/* Ungrouped Header - Only if Accords exist to clarify structure */}
                              {hasAccords && ungroupedItems.length > 0 && (
                                <tr className="bg-gray-50 border-b border-gray-200 select-none">
                                  <td colSpan={visibleColumns.size} className="py-2 px-4">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold opacity-80">
                                      <span className="w-4"></span>
                                      <span>Ungrouped Items</span>
                                      <span className="font-normal opacity-70">({ungroupedItems.length})</span>
                                      <div className="ml-auto font-mono text-gray-400">
                                        {ungroupedItems.reduce((s,i) => s + i.weight, 0).toFixed(3)}g
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* Ungrouped Items */}
                              {ungroupedItems.map((item) => (
                                <IngredientRow 
                                  key={item.uuid} 
                                  index={runningIndex++} 
                                  item={item}
                                  percent={stats.totalWeight > 0 ? (item.weight / stats.totalWeight) * 100 : 0}
                                  visibleColumns={visibleColumns}
                                  onChange={updateItem} 
                                  onRemove={removeIngredient}
                                  accordGroups={accordGroups}
                                  onSetAccord={handleSetAccord}
                                />
                              ))}

                              {/* Accord Groups */}
                              {accordGroups.map(group => {
                                const items = groupedItems.get(group.id) || [];
                                if (items.length === 0) return null; // HIDE EMPTY ACCORD GROUPS

                                const groupWeight = items.reduce((sum, i) => sum + i.weight, 0);
                                
                                return (
                                  <React.Fragment key={group.id}>
                                    <tr 
                                      className="bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer select-none border-b border-indigo-100" 
                                      onClick={() => handleToggleAccord(group.id)}
                                    >
                                      <td colSpan={visibleColumns.size} className="py-2 px-4">
                                        <div className="flex items-center gap-2 text-xs text-gray-700">
                                          <span className="text-gray-500 w-4">{group.collapsed ? '▶' : '▼'}</span>
                                          <span className="font-bold uppercase tracking-wider">{group.name}</span>
                                          <span className="text-gray-400 font-normal">({items.length} items)</span>
                                          <div className="ml-auto flex items-center gap-4">
                                            <span className="font-mono font-bold text-gray-600">{groupWeight.toFixed(3)}g</span>
                                            
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleScaleAccord(group.id); }}
                                              className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 mr-2"
                                              title="Scale Accord to Target Weight"
                                            >
                                              Scale
                                            </button>

                                            <button
                                              onClick={(e) => { e.stopPropagation(); setSaveTemplateGroupId(group.id); }}
                                              className="text-[10px] font-bold uppercase tracking-wider text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded border border-teal-200 mr-2"
                                              title="Save as Template"
                                            >
                                              Save Tmpl
                                            </button>

                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleDeleteAccord(group.id); }}
                                              className="text-gray-400 hover:text-red-500 font-bold px-2 py-0.5 rounded hover:bg-red-50"
                                              title="Delete Accord (Ungroup Items)"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                    {!group.collapsed && items.map((item) => (
                                      <IngredientRow 
                                        key={item.uuid} 
                                        index={runningIndex++} 
                                        item={item}
                                        percent={stats.totalWeight > 0 ? (item.weight / stats.totalWeight) * 100 : 0}
                                        visibleColumns={visibleColumns}
                                        onChange={updateItem} 
                                        onRemove={removeIngredient}
                                        accordGroups={accordGroups}
                                        onSetAccord={handleSetAccord}
                                      />
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                            </>
                          );
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {isMobile && activeView === 'history' && (
          <div className="p-4 overflow-auto">
            <VersionHistory 
              snapshots={snapshots} 
              sessionLog={sessionLog}
              currentFormula={formula}
              onSaveSnapshot={handleSaveSnapshot} 
              onRestoreSnapshot={handleRestoreSnapshot} 
              onDeleteSnapshot={handleDeleteSnapshot} 
              onClearLog={handleClearLog}
            />
          </div>
        )}

        {/* ... Rest of existing mobile views ... */}
        {isMobile && activeView === 'stats' && (
           <div className="p-4 overflow-auto">
              <StatsPanel />
           </div>
        )}

        {isMobile && activeView === 'tools' && (
          <div className="p-4 overflow-auto"><BatchTools formula={formula} stats={stats} onUpdateFormula={setFormula} /></div>
        )}
        
        {isMobile && activeView === 'stock' && (
           <div className="p-4 overflow-auto">
             <InventoryManager 
                inventory={inventory}
                onAddStock={handleAddStock}
                onDeleteStock={handleDeleteStock}
                onSyncCosts={handleSyncCosts}
             />
           </div>
        )}

      </main>

      {/* Accord Creation Modal */}
      {isAccordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Create Accord</h3>
            <input
              autoFocus
              type="text"
              className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Accord Name"
              value={accordNameDraft}
              onChange={(e) => setAccordNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmAccord()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAccordModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium">Cancel</button>
              <button
                  onClick={handleConfirmAccord}
                  disabled={!accordNameDraft.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
              >
                  Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      <SaveTemplateModal 
        isOpen={saveTemplateGroupId !== null}
        onClose={() => setSaveTemplateGroupId(null)}
        onSave={handleSaveAsTemplate}
        defaultName={saveTemplateGroupId ? (accordGroups.find(g => g.id === saveTemplateGroupId)?.name || '') : ''}
      />

      {/* Templates Manager */}
      <AccordTemplatesManager
        isOpen={isTemplateManagerOpen}
        onClose={() => setIsTemplateManagerOpen(false)}
        templates={accordTemplates}
        onDelete={handleDeleteTemplate}
        onInsert={handleInsertTemplate}
        onImportTemplates={handleImportAccordTemplates}
      />

      {/* PRINT SHEET - HIDDEN ON SCREEN */}
      <div id="print-root">
        <PrintSheet
          formula={formula}
          stats={stats}
          category={category}
          noteBreakdown={noteBreakdown}
          complianceReport={complianceReport}
          accordGroups={accordGroups}
        />
      </div>
    </div>
  );
};

export default App;