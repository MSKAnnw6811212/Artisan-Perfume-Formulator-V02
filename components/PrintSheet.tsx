import React from 'react';
import { FormulaItem, FormulationStats, AccordGroup, ComplianceResult } from '../types';
import { INGREDIENTS } from '../data/ingredients';

interface NoteBreakdown {
  top: number;
  mid: number;
  base: number;
  other: number;
  solvent: number;
}

interface Props {
  formula: FormulaItem[];
  stats: FormulationStats;
  category: string;
  noteBreakdown: NoteBreakdown;
  complianceReport: ComplianceResult[];
  accordGroups: AccordGroup[];
}

export const PrintSheet: React.FC<Props> = ({
  formula,
  stats,
  category,
  noteBreakdown,
  complianceReport,
  accordGroups
}) => {
  
  // Helper to find density
  const getDensity = (item: FormulaItem) => {
    const dbIng = item.ingredientId ? INGREDIENTS.find(i => i.id === item.ingredientId) : null;
    return item.customDensity ?? (dbIng ? dbIng.density : 1.0);
  };

  const getAccordName = (accordId?: string | null) => {
    if (!accordId) return '';
    const g = accordGroups.find(acc => acc.id === accordId);
    return g ? g.name : '';
  };

  const issues = complianceReport.filter(r => !r.isCompliant || r.limit === 0);

  return (
    <div className="p-8 font-sans text-black bg-white max-w-[210mm] mx-auto">
      {/* HEADER */}
      <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">Artisan Perfume Formulator</h1>
          <div className="text-sm text-gray-600">Printed: {new Date().toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold uppercase text-gray-500">Target Application</div>
          <div className="text-xl font-bold">IFRA Category {category}</div>
        </div>
      </div>

      {/* STATS SUMMARY GRID */}
      <div className="grid grid-cols-4 gap-4 mb-8 border border-gray-300 rounded p-4 bg-gray-50">
        <div>
          <div className="text-xs font-bold uppercase text-gray-500">Total Weight</div>
          <div className="text-lg font-mono font-bold">{stats.totalWeight.toFixed(3)} g</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase text-gray-500">Total Volume</div>
          <div className="text-lg font-mono font-bold">{stats.totalVolume.toFixed(3)} ml</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase text-gray-500">Concentrate</div>
          <div className="text-lg font-mono font-bold">{stats.concentrateMass.toFixed(3)} g</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase text-gray-500">Est. Cost</div>
          <div className="text-lg font-mono font-bold">€{stats.totalCost.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* NOTE BREAKDOWN */}
        <div>
          <h3 className="text-sm font-bold uppercase border-b border-gray-400 mb-2 pb-1">Note Structure</h3>
          <table className="w-full text-sm">
            <tbody>
              {[
                { l: 'Top', v: noteBreakdown.top },
                { l: 'Middle', v: noteBreakdown.mid },
                { l: 'Base', v: noteBreakdown.base },
                { l: 'Other', v: noteBreakdown.other },
                { l: 'Solvent', v: noteBreakdown.solvent }
              ].map(row => {
                if (row.l === 'Other' && row.v <= 0.001) return null;
                const pct = stats.totalWeight > 0 ? (row.v / stats.totalWeight) * 100 : 0;
                return (
                  <tr key={row.l} className="border-b border-gray-100 last:border-0">
                    <td className="py-1">{row.l}</td>
                    <td className="py-1 text-right font-mono">{pct.toFixed(1)}%</td>
                    <td className="py-1 text-right text-gray-500 font-mono text-xs">{row.v.toFixed(3)}g</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* SOLVENT ANALYSIS */}
        <div>
          <h3 className="text-sm font-bold uppercase border-b border-gray-400 mb-2 pb-1">Solvent Analysis</h3>
          <table className="w-full text-sm">
            <tbody>
              {stats.solventAnalysis.breakdown.length === 0 ? (
                <tr><td className="py-1 italic text-gray-500">No solvents detected.</td></tr>
              ) : (
                stats.solventAnalysis.breakdown.map(s => (
                  <tr key={s.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-1">{s.name}</td>
                    <td className="py-1 text-right font-mono">{s.volPct.toFixed(1)}% v/v</td>
                    <td className="py-1 text-right text-gray-500 font-mono text-xs">{s.mass.toFixed(3)}g</td>
                  </tr>
                ))
              )}
              {stats.solventAnalysis.ethanolVvPct > 0 && (
                <tr className="border-t border-gray-300">
                  <td className="py-1 font-bold pt-2">Ethanol v/v</td>
                  <td className="py-1 text-right font-bold pt-2 font-mono">{stats.solventAnalysis.ethanolVvPct.toFixed(1)}%</td>
                  <td></td>
                </tr>
              )}
              {stats.solventAnalysis.flashPointEstimate.celsius !== null && (
                <tr>
                  <td className="py-1 text-xs text-gray-500" colSpan={3}>
                    Est. Flash Point: ~{stats.solventAnalysis.flashPointEstimate.celsius.toFixed(0)}°C ({stats.solventAnalysis.flashPointEstimate.rating})
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IFRA CHECK */}
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase border-b border-gray-400 mb-2 pb-1 flex justify-between">
          <span>IFRA Compliance Check</span>
          <span className={issues.length === 0 ? "text-green-600" : "text-red-600"}>
            {issues.length === 0 ? "PASS" : `${issues.length} ISSUES FOUND`}
          </span>
        </h3>
        {issues.length > 0 && (
          <table className="w-full text-xs text-red-700 bg-red-50 border border-red-200">
            <thead className="bg-red-100 font-bold text-left">
              <tr>
                <th className="p-2">Ingredient / CAS</th>
                <th className="p-2 text-right">Concentration</th>
                <th className="p-2 text-right">Limit (Cat {category})</th>
                <th className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr key={issue.cas} className="border-b border-red-100 last:border-0">
                  <td className="p-2">
                    <div className="font-bold">{issue.name}</div>
                    <div className="font-mono text-[10px]">{issue.cas}</div>
                  </td>
                  <td className="p-2 text-right font-mono">{(issue.concentration * 100).toFixed(3)}%</td>
                  <td className="p-2 text-right font-mono">{(issue.limit * 100).toFixed(3)}%</td>
                  <td className="p-2">{issue.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {issues.length === 0 && <div className="text-sm text-green-600 italic">Formula is compliant with IFRA Category {category} limits based on available library data.</div>}
      </div>

      {/* FORMULA TABLE */}
      <div>
        <h3 className="text-sm font-bold uppercase border-b border-gray-400 mb-2 pb-1">Formula Composition</h3>
        <table className="w-full text-xs border-collapse print-table">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="py-2 px-1 border-b border-gray-300 w-8 text-center">#</th>
              <th className="py-2 px-1 border-b border-gray-300">Ingredient</th>
              <th className="py-2 px-1 border-b border-gray-300">Accord</th>
              <th className="py-2 px-1 border-b border-gray-300">CAS</th>
              <th className="py-2 px-1 border-b border-gray-300 text-right">Dil.</th>
              <th className="py-2 px-1 border-b border-gray-300">Solvent</th>
              <th className="py-2 px-1 border-b border-gray-300 text-right">Weight</th>
              <th className="py-2 px-1 border-b border-gray-300 text-right">Vol</th>
              <th className="py-2 px-1 border-b border-gray-300 text-right">Active</th>
              <th className="py-2 px-1 border-b border-gray-300 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {formula.map((item, idx) => {
              const density = getDensity(item);
              const vol = item.weight / density;
              const active = item.weight * (item.dilution || 1);
              const pct = stats.totalWeight > 0 ? (item.weight / stats.totalWeight) * 100 : 0;
              const accordName = getAccordName(item.accordId);

              return (
                <tr key={item.uuid} className="border-b border-gray-200">
                  <td className="py-1 px-1 text-center text-gray-500">{idx + 1}</td>
                  <td className="py-1 px-1 font-bold">
                    {item.name}
                    <div className="text-[10px] font-normal text-gray-500">{item.family} • {item.note}</div>
                  </td>
                  <td className="py-1 px-1 text-gray-600 italic">{accordName || '—'}</td>
                  <td className="py-1 px-1 font-mono text-[10px]">{item.cas}</td>
                  <td className="py-1 px-1 text-right">{(item.dilution * 100).toFixed(0)}%</td>
                  <td className="py-1 px-1 text-[10px]">{item.solvent !== 'None' ? item.solvent : '—'}</td>
                  <td className="py-1 px-1 text-right font-mono">{item.weight.toFixed(3)}</td>
                  <td className="py-1 px-1 text-right font-mono text-gray-500">{vol.toFixed(3)}</td>
                  <td className="py-1 px-1 text-right font-mono text-gray-500">{active.toFixed(3)}</td>
                  <td className="py-1 px-1 text-right font-mono font-bold">{pct.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};