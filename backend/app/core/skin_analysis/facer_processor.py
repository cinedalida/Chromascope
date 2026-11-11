import torch
import facer
import numpy as np
import os
import cv2
from PIL import Image

class FaceProcessor:
    def __init__(self, device='cpu'):
        self.device = device
        print("Loading Face Segmentation Models...")
        
        # You can change these to the heavier models if you want more accuracy
        # detector: 'retinaface/resnet50' | retinaface/mobilenet | parser: 'farl/celebm/448'  | resnet18/fast
        self.face_detector = facer.face_detector('retinaface/mobilenet', device=device)
        self.face_parser = facer.face_parser('farl/celebm/448', device=device)
        
        # 1 = KEEP (Face + Hair + Eyes etc), 0 = REMOVE (Background + Clothes + Neck)
        self.label_mappings = {
            'general_head': { 
                'background': 0, 'neck': 0, 'face': 1, 'cloth': 0, 
                'rr': 1, 'lr': 1, 'rb': 1, 'lb': 1, 're': 1, 'le': 1, 
                'nose': 1, 'imouth': 1, 'llip': 1, 'ulip': 1, 
                'hair': 1, 'eyeg': 1, 'hat': 0, 'earr': 1, 'neckl': 0
            },
            'face_skin': { 
                # Pure skin for foundation/color analysis. Excludes eyes, lips, hair.
                'face': 1, 'nose': 1 
            },
            # 'face_lips': { 
            #     # Upper and lower lip only
            #     'llip': 1, 'ulip': 1 
            # }
        }

    def parse(self, image_source):
        """
        Detects the face and parses it ONCE. The result can be turned into any number of masks with apply_mask(),
        so the (expensive) detector + FaRL parser never run twice for the same photo.
        """
        # Accept either a file path or a PIL Image ----
        if isinstance(image_source, Image.Image):
            image_np = np.array(image_source.convert("RGB"))
            image_tensor = torch.from_numpy(image_np)   # ← convert to tensor first
            base_name = "pil_input.jpg"
        else:
            image_tensor = facer.read_hwc(image_source)
            base_name = os.path.basename(image_source)

        image_tensor = facer.hwc2bchw(image_tensor).to(self.device)

        with torch.inference_mode():
            # Detect and Parse Face
            faces = self.face_detector(image_tensor)
            if 'rects' not in faces or faces['rects'].numel() == 0:
                raise ValueError("No face detected in the image.")

            # Only the first (highest-scoring) face is ever used, so the parser must not spend time on extra detections
            # (large photos often return a few small false ones, and the network cost grows with every face).
            faces = {key: (value[:1] if key in ('rects', 'points', 'scores', 'image_ids') else value)
                     for key, value in faces.items()}
            faces = self.face_parser(image_tensor, faces)

            # argmax of the logits equals argmax of their softmax (monotonic), so the softmax over every pixel is skipped
            predicted_labels = faces['seg']['logits'].argmax(dim=1)  # [1, H, W]

        return {
            'image_tensor': image_tensor[0],            # [3, H, W] uint8
            'labels': predicted_labels[0],              # [H, W]
            'label_names': faces['seg']['label_names'],
            'base_name': base_name,
        }

    def apply_mask(self, parsed, target='face_skin', save_debug=False, debug_dir="test_output"):
        """
        Builds the RGB-M image + mask for one target (see label_mappings) from a parse() result.
        Targets available: 'general_head', 'face_skin'
        """
        if target not in self.label_mappings:
            raise ValueError(f"Target '{target}' not found. Choose from: {list(self.label_mappings.keys())}")

        label_mapping = self.label_mappings[target]
        image_tensor = parsed['image_tensor']
        label_names = parsed['label_names']

        # Build lookup table dynamically
        lookup_tensor = torch.zeros(len(label_names), dtype=torch.uint8, device=self.device)
        for i, name in enumerate(label_names):
            lookup_tensor[i] = label_mapping.get(name, 0)

        # Apply mask
        mapped_labels = lookup_tensor[parsed['labels']]  # [H, W]

        # Multiply original image by mask
        # Expand mask to [3, H, W] so it matches the RGB image
        mask_expanded = mapped_labels.unsqueeze(0).expand_as(image_tensor)
        rgb_m = image_tensor * mask_expanded

        # Convert to PIL Image
        rgb_m_np = rgb_m.cpu().permute(1, 2, 0).numpy().astype(np.uint8)
        final_image = Image.fromarray(rgb_m_np)

        # Convert the mask tensor to a numpy array so sklearn/skimage can read it
        mask_np = mapped_labels.cpu().numpy()

        # Save Debug Images (if enabled)
        if save_debug:
            os.makedirs(debug_dir, exist_ok=True)
            base_name = parsed['base_name']

            mask_img = (mask_np * 255).astype(np.uint8)
            cv2.imwrite(os.path.join(debug_dir, f"mask_{target}_{base_name}"), mask_img)

            final_image.save(os.path.join(debug_dir, f"rgb_m_{target}_{base_name}"))
            print(f"Debug images saved to {debug_dir}/")

        # Return both the image and the mask!
        return {
            'image': final_image,
            'mask': mask_np
        }

    def generate_rgb_m(self, image_source, target='face_skin', save_debug=False, debug_dir="test_output"):
        """Segments one target area (parse + mask in one call). Use parse() + apply_mask() to get several targets."""
        if target not in self.label_mappings:
            raise ValueError(f"Target '{target}' not found. Choose from: {list(self.label_mappings.keys())}")
        return self.apply_mask(self.parse(image_source), target, save_debug, debug_dir)
