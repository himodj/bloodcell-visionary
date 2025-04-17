
// Update the global cell type order to match the Python backend
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

// Update getCellTypeColor function to reflect new order
export const getCellTypeColor = (cellType: CellType): string => {
  const colorMap: Record<CellType, string> = {
    'IG Immature White Cell': '#5AC8FA',
    'Basophil': '#AF52DE',
    'Eosinophil': '#FF9500',
    'Erythroblast': '#FF2D55',
    'Lymphocyte': '#34C759',
    'Monocyte': '#FFCC00', 
    'Neutrophil': '#007AFF',
    'Platelet': '#0A84FF',
    'RBC': '#FF4B55'
  };
  
  return colorMap[cellType] || '#8E8E93';
};
