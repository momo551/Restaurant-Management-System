import os
import sys

# Add the current directory to sys.path
sys.path.append(os.getcwd())

try:
    import core.settings
    print("Settings imported successfully")
except Exception as e:
    import traceback
    traceback.print_exc()
