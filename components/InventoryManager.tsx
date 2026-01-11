import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem } from '../types';
import { INGREDIENTS } from '../data/ingredients';

interface Props {
  inventory: InventoryItem[];
  onAddStock: (item: InventoryItem) => void;
  onDeleteStock: (id: string) => void;
  onSyncCosts: () => void;
}

export const InventoryManager: React.FC<Props> = ({ inventory, onAddStock, onDeleteStock, onSyncCosts }) => {
  // --- Form State ---
  const [selectedIngId, setSelectedIngId] = useState<string>('');
  const [lotNumber, setLotNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [shelfLife, setShelfLife] = useState<number>(24);
  
  // STRING STATE for inputs to allow "1." or "0,5" without jumping
  const [amountInput, setAmountInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  
  // Smart Default for Shelf Life when Ingredient Changes
  useEffect(() => {
    if (selectedIngId) {
      const dbIng = INGREDIENTS.find(i => i.id === selectedIngId);
      if (dbIng) {
        const isSensitive = dbIng.family.includes('Citrus') || dbIng.family.includes('Aldehyde');
        setShelfLife(isSensitive ? 12 : 24);
      }
    }
  }, [selectedIngId]);

  // Helper: Parse string with commas to number
  const parseVal = (str: string): number => {
    if (!str) return 0;
    // Replace comma with dot, remove non-numeric chars except dot/minus
    const clean = str.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    return parseFloat(clean);
  };

  // Computed Cost Preview (Calculated strictly for display, does not affect input state)
  const costPreview = useMemo(() => {
    const price = parseVal(priceInput);
    const amount = parseVal(amountInput);
    
    if (price > 0 && amount > 0) {
        // Price / (Amount in Kg)
        return price / (amount / 1000);
    }
    return 0;
  }, [priceInput, amountInput]);

  const handleAdd = () => {
    const amount = parseVal(amountInput);
    const price = parseVal(priceInput);

    if (!selectedIngId || amount <= 0 || price <= 0) return;

    const dbIng = INGREDIENTS.find(i => i.id === selectedIngId);
    if (!dbIng) return;

    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      ingredientId: dbIng.id,
      name: dbIng.name,
      family: dbIng.family,
      lotNumber: lotNumber || 'N/A',
      purchaseDate,
      shelfLife: shelfLife > 0 ? shelfLife : 24,
      stockAmount: amount,
      pricePaid: price,
      costPerKg: costPreview
    };

    onAddStock(newItem);
    
    // Reset minimal fields
    setLotNumber('');
    setAmountInput('');
    setPriceInput('');
  };

  // --- Oxidation Logic ---
  const checkStatus = (item: InventoryItem) => {
    const purchase = new Date(item.purchaseDate);
    const now = new Date();
    const diffTime = now.getTime() - purchase.getTime();
    const ageMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
    
    const isExpired = ageMonths > item.shelfLife;
    const isOxidationRisk = (item.family.includes('Citrus') || item.family.includes('Aldehyde')) && ageMonths > 12;

    let statusText = "OK";
    if (isExpired) statusText = "EXPIRED";
    else if (isOxidationRisk) statusText = "RISK";

    return { ageMonths, isExpired, isOxidationRisk, statusText };
  };

  // --- Export Logic ---
  const handleExportStock = () => {
    // Exact headers requested
    const headers = ["Name", "CAS", "Family", "Lot Number", "Purchase Date", "Age (Mo)", "Status", "Stock (g)", "Price Paid (Eur)", "Cost (Eur/kg)"];
    
    const rows = inventory.map(item => {
        const status = checkStatus(item);
        const dbIng = INGREDIENTS.find(i => i.id === item.ingredientId);
        const cas = dbIng ? dbIng.cas : "";
        // Wrap name in quotes to handle commas in names
        const safeName = `"${item.name.replace(/"/g, '""')}"`;

        return [
            safeName,
            cas,
            item.family,
            item.lotNumber,
            item.purchaseDate,
            status.ageMonths.toFixed(1),
            status.statusText,
            item.stockAmount.toFixed(2),
            item.pricePaid.toFixed(2), // Forced 2 decimals for currency
            item.costPerKg.toFixed(2)  // Forced 2 decimals for currency
        ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_stock_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full gap-6 p-1 bg-gray-50/50">
      
      {/* --- TOP: ADD STOCK FORM --- */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-100 pb-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 p-2 rounded-full text-orange-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Add Inventory</h3>
              <p className="text-xs text-gray-500">Track physical bottles, lots, and costs.</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleExportStock}
              className="bg-gray-600 text-white font-bold py-2 px-4 rounded shadow hover:bg-gray-700 transition-colors flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap"
              title="Download CSV of current stock"
            >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
               Export Stock
            </button>
            <button 
                onClick={onSyncCosts}
                className="bg-green-600 text-white font-bold py-2 px-4 rounded shadow hover:bg-green-700 transition-colors flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap"
                title="Update formula costs to match inventory prices"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Apply Inv. Prices
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-1">
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Ingredient</label>
            <select 
              value={selectedIngId}
              onChange={(e) => setSelectedIngId(e.target.value)}
              className="w-full text-sm border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500 h-10 bg-white"
            >
              <option value="">-- Select Material --</option>
              {INGREDIENTS.map(ing => (
                <option key={ing.id} value={ing.id}>{ing.name} ({ing.family})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Lot Number</label>
            <input 
              type="text" 
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="LOT-2023-X"
              className="w-full text-sm border-gray-300 rounded h-10"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Purchase Date</label>
            <input 
              type="date" 
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full text-sm border-gray-300 rounded h-10"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Shelf Life (Months)</label>
            <input 
              type="number" 
              value={shelfLife}
              onChange={(e) => setShelfLife(parseFloat(e.target.value))}
              className="w-full text-sm border-gray-300 rounded h-10"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Quantity (g)</label>
            <input 
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="e.g. 500"
              className="w-full text-sm border-gray-300 rounded h-10"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Price Paid (€)</label>
            <div className="flex gap-2 items-center">
              <input 
                type="text"
                inputMode="decimal" 
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="e.g. 45.50"
                className="w-full text-sm border-gray-300 rounded h-10"
              />
              <div className="whitespace-nowrap text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded h-10 flex items-center border border-gray-200">
                 Cost: <span className="font-bold text-green-700 ml-1">€{costPreview.toFixed(2)}/kg</span>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleAdd}
          disabled={!selectedIngId || !amountInput || !priceInput}
          className="w-full bg-orange-600 text-white text-sm font-bold py-3 rounded hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          Add to Inventory
        </button>
      </div>

      {/* --- BOTTOM: INVENTORY TABLE --- */}
      <div className="bg-white flex-1 rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
         <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Current Stock</h3>
         </div>
         
         <div className="flex-1 overflow-auto">
           {inventory.length === 0 ? (
             <div className="text-center p-12 text-gray-400 italic">
               No items in inventory. Add stock above.
             </div>
           ) : (
             <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 text-xs uppercase sticky top-0 z-10 shadow-sm">
                 <tr>
                   <th className="p-3 bg-gray-50">Status</th>
                   <th className="p-3 bg-gray-50">Ingredient</th>
                   <th className="p-3 bg-gray-50">Lot #</th>
                   <th className="p-3 bg-gray-50">Purchased</th>
                   <th className="p-3 bg-gray-50 text-right">Age (Mo)</th>
                   <th className="p-3 bg-gray-50 text-right">Shelf Life</th>
                   <th className="p-3 bg-gray-50 text-right">Stock</th>
                   <th className="p-3 bg-gray-50 text-right">Price Paid</th>
                   <th className="p-3 bg-gray-50 text-right">Cost/Kg</th>
                   <th className="p-3 bg-gray-50 w-10"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {inventory.map(item => {
                   const status = checkStatus(item);
                   return (
                     <tr key={item.id} className="hover:bg-gray-50 group">
                       <td className="p-3">
                          <div className="flex gap-1">
                            {status.isExpired && (
                              <span className="bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded font-bold border border-red-200">EXPIRED</span>
                            )}
                            {status.isOxidationRisk && (
                              <span className="bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded font-bold border border-orange-200">RISK</span>
                            )}
                            {!status.isExpired && !status.isOxidationRisk && (
                              <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold border border-green-200">OK</span>
                            )}
                          </div>
                       </td>
                       <td className="p-3 font-medium text-gray-900">
                         {item.name}
                         <span className="block text-[10px] text-gray-400">{item.family}</span>
                       </td>
                       <td className="p-3 font-mono text-xs text-gray-500">{item.lotNumber}</td>
                       <td className="p-3 text-gray-600">{item.purchaseDate}</td>
                       <td className="p-3 text-right text-gray-600">{status.ageMonths.toFixed(1)}</td>
                       <td className="p-3 text-right text-gray-400">{item.shelfLife}</td>
                       <td className="p-3 text-right font-mono font-bold text-gray-800">{item.stockAmount.toFixed(0)} g</td>
                       <td className="p-3 text-right font-mono text-gray-600">€{item.pricePaid.toFixed(2)}</td>
                       <td className="p-3 text-right font-mono text-gray-600">€{item.costPerKg.toFixed(2)}</td>
                       <td className="p-3 text-center">
                         <button 
                           onClick={() => onDeleteStock(item.id)}
                           className="text-gray-300 hover:text-red-500 transition-colors p-1"
                           title="Delete Stock Entry"
                         >
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                         </button>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           )}
         </div>
      </div>

    </div>
  );
};