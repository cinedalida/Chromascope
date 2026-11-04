"""Start the backend for local end-to-end tests: wait for the Firestore emulator, seed it, then run the API.

Only for the emulator (the seed script refuses anything else). Used by frontend/playwright.emulator.config.js.
"""
import os
import socket
import subprocess
import sys
import time

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
host, port = os.environ.get("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080").split(":")

deadline = time.time() + 120
while True:
    try:
        socket.create_connection((host, int(port)), timeout=1).close()
        break
    except OSError:
        if time.time() > deadline:
            sys.exit("Firestore emulator did not start within 120 s")
        time.sleep(1)

subprocess.run([sys.executable, "-m", "scripts.seed_emulator"], cwd=BACKEND, check=True)
# Optional: the full scraped catalog (npm run dev:local -- --full-catalog), into the emulator only.
if os.environ.get("CATALOG_JSON"):
    subprocess.run([sys.executable, "-m", "scripts.import_catalog", os.environ["CATALOG_JSON"],
                    "--collection", "products", "--apply"], cwd=BACKEND, check=True)
# subprocess, not os.execv: on Windows execv does not quote arguments, so a path with spaces breaks.
sys.exit(subprocess.run([sys.executable, "-m", "uvicorn", "app.api.api:app", "--host", "127.0.0.1", "--port", "8000"],
                        cwd=BACKEND).returncode)
