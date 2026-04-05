import sqlite3
import pandas as pd
from tabulate import tabulate

def view_database():
    """View the internships database in a nice table format"""
    try:
        # Connect to database
        conn = sqlite3.connect('internships.db')
        
        # First, show the schema
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(internships)")
        schema_info = cursor.fetchall()
        
        print("=== DATABASE SCHEMA ===")
        schema_headers = ["Column ID", "Name", "Type", "Not Null", "Default", "Primary Key"]
        print(tabulate(schema_info, headers=schema_headers, tablefmt="grid"))
        print()
        
        # Show all records
        cursor.execute("SELECT COUNT(*) FROM internships")
        count = cursor.fetchone()[0]
        print(f"=== DATABASE CONTENTS ({count} records) ===")
        
        if count > 0:
            # Get all data
            df = pd.read_sql_query("SELECT * FROM internships", conn)
            
            # Display in a nice table format
            print(tabulate(df, headers='keys', tablefmt="grid", showindex=False, maxcolwidths=50))
        else:
            print("No records found in the database.")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    view_database() 