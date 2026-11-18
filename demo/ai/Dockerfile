FROM python:3.11-slim

WORKDIR /app

# The production mini PC can have a slow route to PyPI for large MediaPipe/OpenCV
# wheels. Keep dependency versions unchanged, but allow slow reads and transient
# download failures to recover instead of aborting the image build.
ENV PIP_DEFAULT_TIMEOUT=300 \
    PIP_RETRIES=10 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/models && \
    python -c "import urllib.request; urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task','/app/models/pose_landmarker_full.task')" && \
    groupadd --system --gid 10001 aitm && \
    useradd --system --uid 10001 --gid aitm --no-create-home --shell /usr/sbin/nologin aitm && \
    chown -R aitm:aitm /app/models

COPY . .

ENV POSE_MODEL_PATH=/app/models/pose_landmarker_full.task
EXPOSE 8000
USER 10001:10001

CMD ["python", "main.py"]
