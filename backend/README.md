# Backend - Restaurant Management System

This is the backend API for the Restaurant Management System, built with **Django** and **Django Rest Framework**.

## Prerequisites

- [Python 3.8+](https://www.python.org/downloads/)
- [pip](https://pip.pypa.io/en/stable/installation/)

## Setup Instructions

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    ```

3.  **Activate the virtual environment:**
    - On Windows:
        ```bash
        venv\Scripts\activate
        ```
    - On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```

4.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Apply database migrations:**
    ```bash
    python manage.py migrate
    ```

## Running the Server

Start the development server:

```bash
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/`.
Admin interface: `http://127.0.0.1:8000/admin/`

## Key Technologies

- **Django**: Web framework
- **Django Rest Framework (DRF)**: API toolkit
- **SQLite**: Default database (can be configured in `settings.py`)
