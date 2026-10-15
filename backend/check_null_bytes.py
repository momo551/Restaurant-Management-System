with open('core/settings.py', 'rb') as f:
    content = f.read()
    if b'\x00' in content:
        index = content.find(b'\x00')
        print(f"Found null byte at index {index}")
        # Print a bit of context around the null byte
        start = max(0, index - 20)
        end = min(len(content), index + 20)
        print(f"Context: {content[start:end]}")
    else:
        print("No null bytes found in settings.py")
