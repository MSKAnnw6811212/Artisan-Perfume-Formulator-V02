import { NCS } from '../types';

/**
 * Natural Complex Substance (NCS) Breakdown Matrix
 * Synchronized with the 500-ingredient Master List.
 * Source: Tisserand & Young / ISO Standards.
 */
export const NCS_DATA: NCS[] = [
  // --- CITRUS ---
  {
    id: 'bergamot_oil',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.40 },
      { name: 'Linalool', cas: '78-70-6', percent: 0.12 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.007 },
      { name: 'Berzapten', cas: '484-20-8', percent: 0.002 } // Phototoxic
    ]
  },
  {
    id: 'lemon_oil',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.68 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.025 },
      { name: 'Geraniol', cas: '106-24-1', percent: 0.003 }
    ]
  },
  {
    id: 'sweet_orange_oil',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.95 },
      { name: 'Linalool', cas: '78-70-6', percent: 0.005 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.001 }
    ]
  },
  {
    id: 'grapefruit_oil',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.90 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.005 },
      { name: 'Nootkatone', cas: '4674-50-4', percent: 0.01 }
    ]
  },
  {
    id: 'mandarin_oil',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.72 },
      { name: 'Dimethyl Anthranilate', cas: '85-91-6', percent: 0.003 }
    ]
  },
  {
    id: 'lime_oil_distilled',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.45 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.005 } // Distilled has less citral
    ]
  },
  {
    id: 'lime_oil_expressed',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.55 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.04 }, // Expressed has high citral
      { name: 'Geraniol', cas: '106-24-1', percent: 0.005 }
    ]
  },
  {
    id: 'petitgrain_oil',
    constituents: [
      { name: 'Linalool', cas: '78-70-6', percent: 0.25 },
      { name: 'Limonene', cas: '5989-27-5', percent: 0.05 },
      { name: 'Geraniol', cas: '106-24-1', percent: 0.03 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.001 }
    ]
  },

  // --- FLORALS ---
  {
    id: 'rose_otto',
    constituents: [
      { name: 'Citronellol', cas: '106-22-9', percent: 0.35 },
      { name: 'Geraniol', cas: '106-24-1', percent: 0.18 },
      { name: 'Eugenol', cas: '97-53-0', percent: 0.015 },
      { name: 'Methyl Eugenol', cas: '93-15-2', percent: 0.012 }, // Restricted
      { name: 'Farnesol', cas: '4602-84-0', percent: 0.01 }
    ]
  },
  {
    id: 'rose_abs',
    constituents: [
      { name: 'Phenylethyl Alcohol', cas: '60-12-8', percent: 0.65 },
      { name: 'Citronellol', cas: '106-22-9', percent: 0.12 },
      { name: 'Geraniol', cas: '106-24-1', percent: 0.07 },
      { name: 'Eugenol', cas: '97-53-0', percent: 0.015 },
      { name: 'Methyl Eugenol', cas: '93-15-2', percent: 0.008 }
    ]
  },
  {
    id: 'jasmine_grandiflorum',
    constituents: [
      { name: 'Benzyl Benzoate', cas: '120-51-4', percent: 0.12 },
      { name: 'Benzyl Acetate', cas: '140-11-4', percent: 0.22 },
      { name: 'Linalool', cas: '78-70-6', percent: 0.06 },
      { name: 'Eugenol', cas: '97-53-0', percent: 0.005 }
    ]
  },
  {
    id: 'jasmine_sambac',
    constituents: [
      { name: 'Benzyl Alcohol', cas: '100-51-6', percent: 0.04 },
      { name: 'Linalool', cas: '78-70-6', percent: 0.08 },
      { name: 'Methyl Anthranilate', cas: '134-20-3', percent: 0.005 }
    ]
  },
  {
    id: 'ylang_ylang_oil',
    constituents: [
      { name: 'Linalool', cas: '78-70-6', percent: 0.18 },
      { name: 'Benzyl Benzoate', cas: '120-51-4', percent: 0.08 },
      { name: 'Benzyl Salicylate', cas: '118-58-1', percent: 0.04 },
      { name: 'Geraniol', cas: '106-24-1', percent: 0.015 },
      { name: 'Farnesol', cas: '4602-84-0', percent: 0.02 },
      { name: 'Isoeugenol', cas: '97-54-1', percent: 0.008 }
    ]
  },
  {
    id: 'lavender_oil',
    constituents: [
      { name: 'Linalool', cas: '78-70-6', percent: 0.38 },
      { name: 'Geraniol', cas: '106-24-1', percent: 0.005 },
      { name: 'Coumarin', cas: '91-64-5', percent: 0.002 }
    ]
  },
  {
    id: 'neroli_oil',
    constituents: [
      { name: 'Linalool', cas: '78-70-6', percent: 0.36 },
      { name: 'Limonene', cas: '5989-27-5', percent: 0.12 },
      { name: 'Geraniol', cas: '106-24-1', percent: 0.03 },
      { name: 'Farnesol', cas: '4602-84-0', percent: 0.03 }
    ]
  },
  {
    id: 'geranium_oil',
    constituents: [
      { name: 'Citronellol', cas: '106-22-9', percent: 0.35 },
      { name: 'Geraniol', cas: '106-24-1', percent: 0.15 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.01 }
    ]
  },

  // --- SPICES ---
  {
    id: 'clove_bud_oil',
    constituents: [
      { name: 'Eugenol', cas: '97-53-0', percent: 0.82 },
      { name: 'Isoeugenol', cas: '97-54-1', percent: 0.001 }
    ]
  },
  {
    id: 'cinnamon_bark_oil',
    constituents: [
      { name: 'Cinnamal', cas: '104-55-2', percent: 0.65 },
      { name: 'Eugenol', cas: '97-53-0', percent: 0.06 },
      { name: 'Linalool', cas: '78-70-6', percent: 0.03 }
    ]
  },
  {
    id: 'cardamom_oil',
    constituents: [
      { name: 'Linalool', cas: '78-70-6', percent: 0.04 },
      { name: 'Limonene', cas: '5989-27-5', percent: 0.02 },
      { name: 'Citral', cas: '5392-40-5', percent: 0.003 }
    ]
  },
  {
    id: 'black_pepper_oil',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.18 },
      { name: 'Linalool', cas: '78-70-6', percent: 0.005 }
    ]
  },
  {
    id: 'nutmeg_oil',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.04 },
      { name: 'Isoeugenol', cas: '97-54-1', percent: 0.005 },
      { name: 'Methyleugenol', cas: '93-15-2', percent: 0.005 }
    ]
  },

  // --- WOODS & RESINS ---
  {
    id: 'oakmoss_abs',
    constituents: [
      { name: 'Atranol', cas: '526-37-4', percent: 0.015 },
      { name: 'Chloroatranol', cas: '57074-21-2', percent: 0.008 }
    ]
  },
  {
    id: 'patchouli_oil',
    constituents: [
      { name: 'Eugenol', cas: '97-53-0', percent: 0.001 }
    ]
  },
  {
    id: 'vetiver_oil',
    constituents: [
      { name: 'Isoeugenol', cas: '97-54-1', percent: 0.001 }
    ]
  },
  {
    id: 'sandalwood_oil',
    constituents: [
      { name: 'Farnesol', cas: '4602-84-0', percent: 0.005 }
    ]
  },
  {
    id: 'olibanum_oil',
    constituents: [
      { name: 'Limonene', cas: '5989-27-5', percent: 0.15 },
      { name: 'Linalool', cas: '78-70-6', percent: 0.01 }
    ]
  }
];