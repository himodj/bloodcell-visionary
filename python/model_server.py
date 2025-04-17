
# Update class labels to match the specified order
class_labels = [
    'IG Immature White Cell', 'Basophil', 'Eosinophil', 'Erythroblast',  
    'Lymphocyte', 'Monocyte', 'Neutrophil', 'Platelet', 'RBC'
]

# Log class label order for debugging
logger.info(f"Class labels order: {', '.join(class_labels)}")
