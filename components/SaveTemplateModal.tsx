import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName: string;
}

export const SaveTemplateModal: React.FC<Props> = ({ isOpen, onClose, onSave, defaultName }) => {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (isOpen) setName(defaultName);
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold mb-4 text-gray-800">Save Accord as Template</h3>
        <p className="text-xs text-gray-500 mb-4">
          This will save the relative ratios of ingredients in this accord for future reuse.
        </p>
        <input
          autoFocus
          type="text"
          className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          placeholder="Template Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSave(name)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium">Cancel</button>
          <button
            onClick={() => onSave(name)}
            disabled={!name.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
};