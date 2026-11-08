# Chromascope backend on a Hugging Face Space (Docker SDK, free CPU). Built by scripts/deploy_space.py, which stages
# this file with the backend code and product photos (PLAN_MIGRATION.md, Phase 4). Secrets come from Space settings.
FROM python:3.14-slim

# OpenCV / face parsing need these system libraries.
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Spaces run the container as user 1000.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH PYTHONUNBUFFERED=1 \
    CATALOG_IMAGES_DIR=/home/user/app/catalog_images PRODUCTS_COLLECTION=products_v2
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
# CPU-only PyTorch first (much smaller than the default CUDA build), then everything else.
RUN pip install --no-cache-dir --user torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir --user -r requirements.txt

COPY --chown=user app ./app
COPY --chown=user catalog_images ./catalog_images
COPY --chown=user fetch_models.py .

# FaRL backbone (MIT), downloaded from the authors' official release instead of being uploaded with the Space.
ADD --chown=user https://github.com/FacePerceiver/FaRL/releases/download/pretrained_weights/FaRL-Base-Patch16-LAIONFace20M-ep64.pth \
    ./app/core/skin_analysis/ml/weights/FaRL-Base-Patch16-LAIONFace20M-ep64.pth

EXPOSE 7860
# The trained models come from the private model repo at startup (fetch_models.py, HF_MODELS_TOKEN secret).
CMD ["sh", "-c", "python fetch_models.py && exec uvicorn app.api.api:app --host 0.0.0.0 --port 7860"]
