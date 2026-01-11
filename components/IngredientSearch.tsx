import React, { useState, useEffect, useRef } from 'react';
import { Ingredient } from '../types';

interface Props {
  ingredients: Ingredient[];
  onAdd: (ingredient: Ingredient) => void;
  onAddNew: (name: string) => void;
}

export const IngredientSearch: React.FC<Props> = ({ ingredients, onAdd, onAddNew }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 1. Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // 2. THE STRICT LOGIC (Untouched)
  const term = searchTerm.toLowerCase().trim();
  
  const filteredList = ingredients.filter(ing => {
    // If empty: Show first 1000 items
    if (!term) return true;
    
    // Strict Prefix Match
    const nameStart = ing.name.toLowerCase().startsWith(term);
    const casStart = ing.cas ? ing.cas.startsWith(term) : false;
    
    return nameStart || casStart;
  }).slice(0, 1000);

  return (
    <div className="relative w-full max-w-md mb-5" ref={wrapperRef}>
      
      {/* INPUT FIELD */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search (Start of Name e.g. 'Bi' for Birch)..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-white border border-gray-300 rounded-md py-3 pl-4 pr-10 text-sm text-gray-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none placeholder-gray-500"
        />
        {/* Search Icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      {/* DROPDOWN RESULTS */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white shadow-xl max-h-96 rounded-md ring-1 ring-black ring-opacity-5 flex flex-col border border-gray-200 text-sm">
          
          {/* SCROLLABLE LIST AREA */}
          <div className="overflow-y-auto flex-1">
            
            {/* OPTION 1: CREATE NEW */}
            {searchTerm && (
              <div 
                onClick={() => { onAddNew(searchTerm); setSearchTerm(''); setIsOpen(false); }}
                className="cursor-pointer select-none relative py-3 px-4 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-b border-indigo-100 font-medium transition-colors"
              >
                <span className="block text-xs uppercase tracking-wider text-indigo-400 mb-0.5">Custom Ingredient</span>
                Create "{searchTerm}"
              </div>
            )}

            {/* OPTION 2: THE LIST */}
            {filteredList.map((ing, index) => (
              <div
                // Fix: Use index in key to force fresh render, preventing ghost items
                key={`${ing.id}_${index}`} 
                onClick={() => { onAdd(ing); setSearchTerm(''); setIsOpen(false); }}
                className="cursor-pointer select-none relative py-2.5 px-4 hover:bg-gray-50 text-gray-900 border-b border-gray-100 last:border-0 transition-colors group flex justify-between items-center"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-900">{ing.name}</span>
                  <span className="text-xs font-mono text-gray-400">{ing.cas || 'No CAS'}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                  {ing.family || 'Raw'}
                </span>
              </div>
            ))}

            {/* OPTION 3: NO RESULTS */}
            {filteredList.length === 0 && !searchTerm && (
              <div className="py-4 px-4 text-center text-gray-400 text-xs italic">No ingredients found.</div>
            )}
            
            {/* OPTION 4: NO MATCH */}
            {filteredList.length === 0 && searchTerm && (
              <div className="py-4 px-4 text-center text-gray-400 text-xs italic">
                No ingredient starts with "{searchTerm}"
              </div>
            )}
          </div>

          {/* FOOTER: RESULT COUNT */}
          <div className="py-2 px-4 bg-gray-50 text-right text-[10px] text-gray-400 italic border-t border-gray-100 rounded-b-md shrink-0">
            Showing {filteredList.length} results
          </div>

        </div>
      )}
    </div>
  );
};