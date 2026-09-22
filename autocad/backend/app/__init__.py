# iQOO CADVision Backend App Package
import sys
import os

# Ensure the backend directory is in sys.path so 'import app...' works from any CWD
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
