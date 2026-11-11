# Chromascope backend on Google Cloud Run (your Google Cloud / Firebase project, paid by its credit).
# Built by scripts/deploy_cloudrun.py, which stages this file with the backend code, the product photos and the two
# trained models into one folder and lets Cloud Build build it. The image is private to the project.
FROM python:3.14-slim

# OpenCV / face parsing need these system libraries.
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH PYTHONUNBUFFERED=1 \
    CATALOG_IMAGES_DIR=/home/user/app/catalog_images PRODUCTS_COLLECTION=products_v2
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
# CPU-only PyTorch first (much smaller than the default CUDA build), then everything else.
RUN pip install --no-cache-dir --user torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir --user -r requirements.txt

# face detector + face parser weights: facer downloads them from GitHub on first use, which would make the first photo
# after every cold start wait for that download. Fetch them while building the image instead.
RUN python -c "import facer; facer.face_detector('retinaface/mobilenet', device='cpu'); facer.face_parser('farl/celebm/448', device='cpu')"

# The code, with the two trained models already inside app/core/skin_analysis/ml/weights (staged by the deploy script).
COPY --chown=user app ./app
COPY --chown=user catalog_images ./catalog_images
# FaRL backbone (MIT), from the authors' official release instead of being uploaded.
ADD --chown=user https://github.com/FacePerceiver/FaRL/releases/download/pretrained_weights/FaRL-Base-Patch16-LAIONFace20M-ep64.pth \
    ./app/core/skin_analysis/ml/weights/FaRL-Base-Patch16-LAIONFace20M-ep64.pth

# Cloud Run tells the container which port to listen on in $PORT (8080 by default). Firestore access uses the service's
# own identity (firebase_init.py, K_SERVICE), so there is no key file in the image.
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.api.api:app --host 0.0.0.0 --port ${PORT:-8080}"]
