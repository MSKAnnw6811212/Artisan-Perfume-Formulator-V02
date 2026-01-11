export interface Ingredient {
  id: string;
  name: string;
  cas: string;
  family: string;
  note: 'Top' | 'Middle' | 'Base' | 'Solvent';
  odorProfile: string; // From PDF Section 5.1
  density: number; // g/ml
  dilution: number; // 0.0 to 1.0 (1.0 = Neat)
  solvent: string;
  costPerKg: number; // In Euros
}

export interface IFRALimit {
  [category: string]: number; // e.g., "4": 0.1
}

export interface IFRAEntry {
  name: string;
  type: string; // "restricted", "prohibited", "specification"
  limits?: IFRALimit; 
}

export interface IFRAData {
  [cas: string]: IFRAEntry;
}

export interface NCSConstituent {
  name: string;
  cas: string;
  percent: number; // Decimal
}

export interface NCS {
  id: string; 
  constituents: NCSConstituent[];
}

export interface AccordGroup {
  id: string;
  name: string;
  collapsed?: boolean;
}

export interface FormulaItem {
  uuid: string;
  ingredientId: string | null; // Null if custom
  // Snapshot/Editable Properties
  name: string;
  cas: string;
  family: string;
  note: string; // Top / Middle / Base
  odorProfile: string; // Description
  
  weight: number; 
  dilution: number; 
  solvent: string;
  costPerKg: number;
  supplier: string;
  customDensity?: number; // Optional user-defined specific gravity
  accordId?: string | null; // Optional linking to AccordGroup
}

export interface ComplianceResult {
  cas: string;
  name: string;
  totalMass: number;
  concentration: number; 
  limit: number; 
  isCompliant: boolean;
  sources: string[];
  reason?: string; // e.g. "Restricted"
}

export interface SolventBreakdownEntry {
  name: string;
  mass: number;
  volume: number;
  massPct: number; // % of total solvent mass
  volPct: number; // % of total solvent volume
}

export interface SolventAnalysis {
  breakdown: SolventBreakdownEntry[];
  totalSolventMass: number;
  totalSolventVolume: number;
  ethanolVvPct: number; // Ethanol Volume / Total Solvent Volume
  flashPointEstimate: {
    celsius: number | null; // Null if no ethanol
    rating: 'Safe' | 'Low' | 'Flammable' | 'High';
    warning: string;
  };
}

export interface FormulationStats {
  totalWeight: number;
  totalVolume: number;
  totalCost: number;
  ethanolMass: number;
  concentrateMass: number;
  solventAnalysis: SolventAnalysis;
}

export interface Snapshot {
  id: string;
  name: string;      // e.g. "Mod 1"
  timestamp: number;
  formula: FormulaItem[];
  note: string;      // e.g. "Reduced Iso E Super"
}

export interface InventoryItem {
  id: string;            // Unique Stock ID
  ingredientId: string;  // Link to generic DB
  name: string;
  family: string;        // Needed for alerts
  lotNumber: string;     // GMP requirement
  purchaseDate: string;  // YYYY-MM-DD
  shelfLife: number;     // Months (default 24, Citrus/Aldehydes 12)
  stockAmount: number;   // Grams on hand
  pricePaid: number;     // Total price paid for this bottle
  costPerKg: number;     // Calculated automatically
}

export interface HistoryEntry {
  id: string;
  timestamp: string; // HH:MM:SS
  action: string;    // e.g. "Updated Bergamot weight"
  details: string;   // e.g. "0.500g -> 0.600g"
}

export type FocusMode = 'all' | 'composition' | 'regulatory' | 'lab' | 'cost';

// --- TEMPLATES ---
export interface AccordTemplateItem {
  ratio: number; // item.weight / totalWeight (0.0 to 1.0)
  // Copied from FormulaItem (excluding uuid, weight, accordId)
  ingredientId: string | null;
  name: string;
  cas: string;
  family: string;
  note: string;
  odorProfile: string;
  dilution: number;
  solvent: string;
  costPerKg: number;
  supplier: string;
  customDensity?: number;
}

export interface AccordTemplate {
  id: string;
  name: string;
  createdAt: number;
  items: AccordTemplateItem[];
}