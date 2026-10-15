import os
import django
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler
from rest_framework.response import Response

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def test_exception_serialization():
    # Simulate a ValidationError raised with a dict
    error_dict = {'error': 'Insufficient Stock Message'}
    exc = ValidationError(error_dict)
    
    # Typical DRF exception handler logic
    response = exception_handler(exc, {})
    
    if response is not None:
        print(f"Serialized Response Data: {response.data}")
        if 'error' in response.data:
            print("SUCCESS: 'error' key is present at top level.")
        else:
            print(f"FAILED: 'error' key missing. Data structure: {response.data}")
    else:
        print("FAILED: No response generated.")

if __name__ == "__main__":
    test_exception_serialization()
