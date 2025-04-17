
export type CellType = 
  | 'IG Immature White Cell'
  | 'Basophil'
  | 'Eosinophil'
  | 'Erythroblast'
  | 'Lymphocyte'
  | 'Monocyte'
  | 'Neutrophil'
  | 'Platelet'
  | 'RBC';

// Update the cell_counts initialization to match the new order
const cell_counts = {
  'IG Immature White Cell': 0,
  'Basophil': 0,
  'Eosinophil': 0,
  'Erythroblast': 0,
  'Lymphocyte': 0,
  'Monocyte': 0, 
  'Neutrophil': 0,
  'Platelet': 0,
  'RBC': 0
};
