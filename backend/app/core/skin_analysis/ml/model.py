import torch
import torch.nn as nn
import open_clip
import os

class ArmocromiaModel(nn.Module):
    def __init__(self, farl_path, num_classes=12, backbone_dim=512, dropout=0.0):
        super().__init__()
        
        # 1. Load base CLIP architecture
        self.backbone, _, _ = open_clip.create_model_and_transforms('ViT-B-16', pretrained=None)
        
        # 2. Load FaRL weights
        if not os.path.exists(farl_path):
            raise FileNotFoundError(f"Missing FaRL weights at {farl_path}")
            
        state = torch.load(farl_path, map_location="cpu", weights_only=True)
        weights = state.get("state_dict", state)
        self.backbone.load_state_dict(weights, strict=False)

        # 3. Custom classification head
        hidden_dim = backbone_dim // 2 
        self.head = nn.Sequential(
            nn.Linear(backbone_dim, hidden_dim),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout),
            nn.Linear(hidden_dim, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.backbone.encode_image(x) 
        logits = self.head(features)             
        return logits