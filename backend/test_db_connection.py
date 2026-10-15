import psycopg
import os
from dotenv import load_dotenv

load_dotenv()

def test_conn():
    try:
        conn = psycopg.connect(
            host=os.getenv('DB_HOST', '127.0.0.1'),
            port=os.getenv('DB_PORT', '5432'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'postgres'),
            connect_timeout=5
        )
        conn.autocommit = True
        print("Successfully connected to PostgreSQL server!")
        
        # Check if database exists
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'restaurant_db'")
        exists = cur.fetchone()
        if exists:
            print("Database 'restaurant_db' exists.")
        else:
            print("Database 'restaurant_db' DOES NOT exist. Attempting to create...")
            cur.execute("CREATE DATABASE restaurant_db")
            print("Database 'restaurant_db' created successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_conn()
