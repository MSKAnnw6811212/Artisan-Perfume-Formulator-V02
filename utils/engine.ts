import { FormulaItem, ComplianceResult, FormulationStats, SolventBreakdownEntry, SolventAnalysis } from '../types';
import { INGREDIENTS } from '../data/ingredients';
import { IFRA_LIBRARY } from '../data/ifra';
import { NCS_DATA } from '../data/ncs';

// Standard Solvent Densities (g/ml)
const SOLVENT_DENSITIES: Record<string, number> = {
  'Ethanol': 0.789,
  'DPG': 1.02,
  'IPM': 0.85,
  'TEC': 1.12,
  'BB': 1.12,
  'Benzyl Benzoate': 1.12,
  'Water': 1.0,
  'Water (Aqua)': 1.0
};

/**
 * Calculates detailed breakdown of solvents in the formula.
 * Accounts for:
 * 1. Solvents used as diluents in ingredients (dilution < 1).
 * 2. Solvents added directly as line items.
 */
export const calculateSolventBreakdown = (formula: FormulaItem[]): SolventAnalysis => {
  const solventMap = new Map<string, { mass: number; volume: number }>();
  let totalSolventMass = 0;
  let totalSolventVolume = 0;

  formula.forEach(item => {
    const dilution = item.dilution || 1;
    let solventName = 'None';
    let addedMass = 0;

    // Case 1: Ingredient is diluted (Carrier contribution)
    if (dilution < 1) {
      solventName = item.solvent || 'Ethanol';
      if (solventName === 'None') solventName = 'Ethanol'; // Default to ethanol if unspecified but diluted
      addedMass = item.weight * (1 - dilution);
    } 
    // Case 2: Ingredient IS a solvent (Direct addition)
    else if ((item.family === 'Solvent' || item.note === 'Solvent') && dilution === 1) {
      // Normalize names
      const lowerName = item.name.toLowerCase();
      if (lowerName.includes('ethanol') || lowerName.includes('alcohol')) solventName = 'Ethanol';
      else if (lowerName.includes('dpg')) solventName = 'DPG';
      else if (lowerName.includes('ipm')) solventName = 'IPM';
      else if (lowerName.includes('tec')) solventName = 'TEC';
      else if (lowerName.includes('water') || lowerName.includes('aqua')) solventName = 'Water';
      else if (lowerName.includes('bb') || lowerName.includes('benzyl benzoate')) solventName = 'BB';
      else solventName = item.name; // Custom solvent name
      
      addedMass = item.weight;
    }

    // Accumulate
    if (addedMass > 0 && solventName !== 'None') {
      const density = SOLVENT_DENSITIES[solventName] || 1.0;
      const addedVol = addedMass / density;

      const current = solventMap.get(solventName) || { mass: 0, volume: 0 };
      solventMap.set(solventName, {
        mass: current.mass + addedMass,
        volume: current.volume + addedVol
      });

      totalSolventMass += addedMass;
      totalSolventVolume += addedVol;
    }
  });

  // Convert to Array & Calculate Percentages
  const breakdown: SolventBreakdownEntry[] = Array.from(solventMap.entries()).map(([name, data]) => ({
    name,
    mass: data.mass,
    volume: data.volume,
    massPct: totalSolventMass > 0 ? (data.mass / totalSolventMass) * 100 : 0,
    volPct: totalSolventVolume > 0 ? (data.volume / totalSolventVolume) * 100 : 0
  })).sort((a, b) => b.mass - a.mass);

  // Calculate Ethanol v/v relative to Solvent System
  const ethanolEntry = breakdown.find(b => b.name === 'Ethanol');
  const ethanolVol = ethanolEntry ? ethanolEntry.volume : 0;
  const ethanolVvPct = totalSolventVolume > 0 ? (ethanolVol / totalSolventVolume) * 100 : 0;

  // Estimate Flash Point
  const flashPointEstimate = estimateFlashPoint(ethanolVvPct);

  return {
    breakdown,
    totalSolventMass,
    totalSolventVolume,
    ethanolVvPct,
    flashPointEstimate
  };
};

/**
 * Estimates Flash Point based on Ethanol-Water equilibrium data.
 * NOTE: This is a safety estimate only.
 */
const estimateFlashPoint = (ethanolVvPct: number) => {
  // Data points: [Ethanol % v/v, Flash Point °C]
  // Source: Standard engineering tables for Ethanol/Water mixtures
  const points = [
    [0, 100],   // Water equivalent (safe)
    [5, 62],
    [10, 49],
    [20, 36],
    [30, 29],
    [40, 26],
    [50, 24],
    [60, 22],
    [70, 21],
    [80, 20],
    [90, 17],
    [100, 13]
  ];

  if (ethanolVvPct <= 0) {
    return { celsius: null, rating: 'Safe' as const, warning: "Non-flammable solvent basis" };
  }

  // Linear Interpolation
  let estimatedC = 13; // Default to pure ethanol
  for (let i = 0; i < points.length - 1; i++) {
    const [p1Pct, p1Temp] = points[i];
    const [p2Pct, p2Temp] = points[i+1];
    
    if (ethanolVvPct >= p1Pct && ethanolVvPct <= p2Pct) {
      const ratio = (ethanolVvPct - p1Pct) / (p2Pct - p1Pct);
      estimatedC = p1Temp + ratio * (p2Temp - p1Temp);
      break;
    }
  }

  // Determine Warning Level
  let rating: 'Safe' | 'Low' | 'Flammable' | 'High' = 'Safe';
  let warning = "";

  if (estimatedC < 23) {
    rating = 'High';
    warning = "High flammability / shipping constraints likely";
  } else if (estimatedC < 60) {
    rating = 'Flammable';
    warning = "Flammable – review shipping/storage";
  } else {
    rating = 'Low';
    warning = "Lower flammability (still validate)";
  }

  return { celsius: estimatedC, rating, warning };
};

export const calculateStats = (formula: FormulaItem[]): FormulationStats => {
  let totalWeight = 0;
  let totalVolume = 0;
  let totalCost = 0;
  let ethanolMass = 0; // Legacy field, kept for compatibility if needed
  let concentrateMass = 0;

  formula.forEach((item) => {
    // Try to find DB ingredient for density fallback, otherwise default to 1.0
    const dbIng = item.ingredientId ? INGREDIENTS.find((i) => i.id === item.ingredientId) : null;
    const density = item.customDensity ?? (dbIng ? dbIng.density : 1.0);

    totalWeight += item.weight;
    
    // Volume
    const vol = item.weight / density;
    totalVolume += vol;

    // Cost: (Grams / 1000) * CostPerKg
    totalCost += (item.weight / 1000) * item.costPerKg;

    // Recursive Dilution
    const activeMass = item.weight * item.dilution;
    concentrateMass += activeMass;
  });

  // Calculate detailed solvent analytics
  const solventAnalysis = calculateSolventBreakdown(formula);
  
  // Backfill legacy ethanolMass for backward compat if strict usage required
  // (Though UI should prefer solventAnalysis.breakdown now)
  const ethEntry = solventAnalysis.breakdown.find(b => b.name === 'Ethanol');
  ethanolMass = ethEntry ? ethEntry.mass : 0;

  return { 
    totalWeight, 
    totalVolume, 
    totalCost, 
    ethanolMass, 
    concentrateMass, 
    solventAnalysis 
  };
};

export const checkCompliance = (formula: FormulaItem[], totalBatchWeight: number, targetCategory: string): ComplianceResult[] => {
  if (totalBatchWeight === 0) return [];

  const massByCas: Record<string, number> = {};
  const sourcesByCas: Record<string, Set<string>> = {};

  formula.forEach((item) => {
    const realMass = item.weight * item.dilution;

    // 1. Direct Check (Use Editable CAS from Item)
    const directCas = item.cas.trim();
    if (directCas && directCas !== 'Mixture') {
      massByCas[directCas] = (massByCas[directCas] || 0) + realMass;
      if (!sourcesByCas[directCas]) sourcesByCas[directCas] = new Set();
      sourcesByCas[directCas].add(item.name);
    }

    // 2. NCS Expansion (Hidden Allergens)
    // Only applies if linked to a DB ID that has NCS data
    if (item.ingredientId) {
      const ncsProfile = NCS_DATA.find(n => n.id === item.ingredientId);
      if (ncsProfile) {
        ncsProfile.constituents.forEach(constituent => {
          const constituentMass = realMass * constituent.percent;
          massByCas[constituent.cas] = (massByCas[constituent.cas] || 0) + constituentMass;

          if (!sourcesByCas[constituent.cas]) sourcesByCas[constituent.cas] = new Set();
          sourcesByCas[constituent.cas].add(`${item.name} (Hidden ${constituent.name})`);
        });
      }
    }
  });

  const results: ComplianceResult[] = [];

  Object.keys(massByCas).forEach(cas => {
    const entry = IFRA_LIBRARY[cas];
    
    if (entry) {
      const totalMass = massByCas[cas];
      const concentration = totalMass / totalBatchWeight; // decimal (0.01 = 1%)
      
      let limitPercent = 100; // Default: compliant if not found

      if (entry.limits && typeof entry.limits[targetCategory] === 'number') {
         limitPercent = entry.limits[targetCategory];
      } else if (entry.type === 'prohibited') {
         limitPercent = 0;
      }
      
      const limitDecimal = limitPercent / 100;
      const isCompliant = concentration <= limitDecimal;

      results.push({
        cas,
        name: entry.name,
        totalMass,
        concentration,
        limit: limitDecimal,
        isCompliant,
        sources: Array.from(sourcesByCas[cas] || []),
        reason: entry.type === 'prohibited' ? 'Prohibited' : 'Restriction'
      });
    }
  });

  return results.sort((a, b) => (a.isCompliant === b.isCompliant ? 0 : a.isCompliant ? 1 : -1));
};