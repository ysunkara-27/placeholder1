import sqlite3
import json
import re
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from rich import print as rprint

console = Console()

class DatabaseManager:
    def __init__(self, db_path='internships.db'):
        self.db_path = db_path
        
    def get_connection(self):
        """Get a database connection"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # This allows dict-like access to rows
            return conn
        except Exception as e:
            console.print(f"[red]Error connecting to database: {e}[/red]")
            return None
    
    def show_schema(self):
        """Display the current database schema"""
        conn = self.get_connection()
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(internships)")
        schema_info = cursor.fetchall()
        
        table = Table(title="Database Schema")
        table.add_column("ID", style="cyan")
        table.add_column("Column Name", style="green")
        table.add_column("Type", style="yellow")
        table.add_column("Not Null", style="magenta")
        table.add_column("Primary Key", style="red")
        
        for row in schema_info:
            table.add_row(
                str(row[0]),
                row[1],
                row[2],
                "Yes" if row[3] else "No",
                "Yes" if row[5] else "No"
            )
        
        console.print(table)
        conn.close()
    
    def show_stats(self):
        """Show database statistics"""
        conn = self.get_connection()
        if not conn:
            return
            
        cursor = conn.cursor()
        
        # Total records
        cursor.execute("SELECT COUNT(*) FROM internships")
        total_records = cursor.fetchone()[0]
        
        # Records by company
        cursor.execute("""
            SELECT company_name, COUNT(*) as count 
            FROM internships 
            GROUP BY company_name 
            ORDER BY count DESC 
            LIMIT 10
        """)
        top_companies = cursor.fetchall()
        
        # Records by region
        cursor.execute("""
            SELECT region, COUNT(*) as count 
            FROM internships 
            WHERE region IS NOT NULL 
            GROUP BY region 
            ORDER BY count DESC
        """)
        regions = cursor.fetchall()
        
        # Recent records
        cursor.execute("""
            SELECT COUNT(*) FROM internships 
            WHERE date_scraped >= date('now', '-7 days')
        """)
        recent_records = cursor.fetchone()[0]
        
        console.print(Panel(f"[bold]Total Records: {total_records}[/bold]", title="Database Statistics"))
        
        # Top companies table
        table = Table(title="Top 10 Companies by Internship Count")
        table.add_column("Company", style="cyan")
        table.add_column("Count", style="green")
        for company, count in top_companies:
            table.add_row(company, str(count))
        console.print(table)
        
        # Regions table
        table = Table(title="Internships by Region")
        table.add_column("Region", style="cyan")
        table.add_column("Count", style="green")
        for region, count in regions:
            table.add_row(region or "Unknown", str(count))
        console.print(table)
        
        console.print(f"[yellow]Recent records (last 7 days): {recent_records}[/yellow]")
        conn.close()
    
    def search_records(self, search_term=None, company=None, region=None, limit=20):
        """Search for specific records"""
        conn = self.get_connection()
        if not conn:
            return
            
        cursor = conn.cursor()
        
        query = "SELECT * FROM internships WHERE 1=1"
        params = []
        
        if search_term:
            query += " AND (title LIKE ? OR description LIKE ? OR company_name LIKE ?)"
            search_pattern = f"%{search_term}%"
            params.extend([search_pattern, search_pattern, search_pattern])
        
        if company:
            query += " AND company_name LIKE ?"
            params.append(f"%{company}%")
        
        if region:
            query += " AND region = ?"
            params.append(region)
        
        query += " ORDER BY date_scraped DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        if not records:
            console.print("[yellow]No records found matching your criteria.[/yellow]")
            conn.close()
            return
        
        table = Table(title=f"Search Results ({len(records)} records)")
        table.add_column("ID", style="cyan", width=8)
        table.add_column("Title", style="green", width=30)
        table.add_column("Company", style="yellow", width=20)
        table.add_column("Location", style="magenta", width=15)
        table.add_column("Date Scraped", style="blue", width=12)
        
        for record in records:
            table.add_row(
                record['id'][:8],
                record['title'][:28] + "..." if len(record['title']) > 30 else record['title'],
                record['company_name'][:18] + "..." if len(record['company_name']) > 20 else record['company_name'],
                record['location'][:13] + "..." if len(record['location']) > 15 else record['location'],
                record['date_scraped']
            )
        
        console.print(table)
        conn.close()
    
    def clean_duplicates(self):
        """Remove duplicate records based on application_link"""
        conn = self.get_connection()
        if not conn:
            return
            
        cursor = conn.cursor()
        
        # Count duplicates
        cursor.execute("""
            SELECT COUNT(*) - COUNT(DISTINCT application_link) 
            FROM internships
        """)
        duplicate_count = cursor.fetchone()[0]
        
        if duplicate_count == 0:
            console.print("[green]No duplicates found![/green]")
            conn.close()
            return
        
        console.print(f"[yellow]Found {duplicate_count} duplicate records.[/yellow]")
        
        if Confirm.ask("Do you want to remove duplicates?"):
            # Keep the most recent record for each application_link
            cursor.execute("""
                DELETE FROM internships 
                WHERE id NOT IN (
                    SELECT MAX(id) 
                    FROM internships 
                    GROUP BY application_link
                )
            """)
            
            deleted_count = cursor.rowcount
            conn.commit()
            console.print(f"[green]Removed {deleted_count} duplicate records.[/green]")
        
        conn.close()
    
    def clean_company_names(self):
        """Standardize company names"""
        conn = self.get_connection()
        if not conn:
            return
            
        cursor = conn.cursor()
        
        # Get all unique company names
        cursor.execute("SELECT DISTINCT company_name FROM internships ORDER BY company_name")
        companies = cursor.fetchall()
        
        console.print("[yellow]Current company names:[/yellow]")
        for i, company in enumerate(companies[:20], 1):
            console.print(f"{i}. {company[0]}")
        
        if len(companies) > 20:
            console.print(f"... and {len(companies) - 20} more")
        
        # Common name mappings
        name_mappings = {
            'google': 'Google',
            'microsoft': 'Microsoft',
            'apple': 'Apple',
            'amazon': 'Amazon',
            'meta': 'Meta',
            'facebook': 'Meta',
            'netflix': 'Netflix',
            'tesla': 'Tesla',
            'spacex': 'SpaceX',
            'uber': 'Uber',
            'lyft': 'Lyft',
            'airbnb': 'Airbnb',
            'stripe': 'Stripe',
            'square': 'Square',
            'salesforce': 'Salesforce',
            'oracle': 'Oracle',
            'ibm': 'IBM',
            'intel': 'Intel',
            'nvidia': 'NVIDIA',
            'amd': 'AMD'
        }
        
        if Confirm.ask("Do you want to standardize company names?"):
            updated_count = 0
            for old_name, new_name in name_mappings.items():
                cursor.execute("""
                    UPDATE internships 
                    SET company_name = ? 
                    WHERE LOWER(company_name) LIKE ?
                """, (new_name, f"%{old_name}%"))
                updated_count += cursor.rowcount
            
            conn.commit()
            console.print(f"[green]Updated {updated_count} company names.[/green]")
        
        conn.close()
    
    def remove_old_records(self, days_old=90):
        """Remove records older than specified days"""
        conn = self.get_connection()
        if not conn:
            return
            
        cursor = conn.cursor()
        
        # Count old records
        cursor.execute("""
            SELECT COUNT(*) FROM internships 
            WHERE date_scraped < date('now', '-{} days')
        """.format(days_old))
        
        old_count = cursor.fetchone()[0]
        
        if old_count == 0:
            console.print(f"[green]No records older than {days_old} days found.[/green]")
            conn.close()
            return
        
        console.print(f"[yellow]Found {old_count} records older than {days_old} days.[/yellow]")
        
        if Confirm.ask(f"Do you want to delete records older than {days_old} days?"):
            cursor.execute("""
                DELETE FROM internships 
                WHERE date_scraped < date('now', '-{} days')
            """.format(days_old))
            
            deleted_count = cursor.rowcount
            conn.commit()
            console.print(f"[green]Deleted {deleted_count} old records.[/green]")
        
        conn.close()
    
    def export_data(self, filename=None):
        """Export data to JSON or CSV"""
        conn = self.get_connection()
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM internships ORDER BY date_scraped DESC")
        records = cursor.fetchall()
        
        if not filename:
            filename = f"internships_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        # Convert to list of dictionaries
        data = []
        for record in records:
            row_dict = dict(record)
            # Parse JSON fields
            if row_dict.get('types'):
                try:
                    row_dict['types'] = json.loads(row_dict['types'])
                except:
                    pass
            data.append(row_dict)
        
        # Export to JSON
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        
        console.print(f"[green]Exported {len(data)} records to {filename}[/green]")
        conn.close()
    
    def backup_database(self):
        """Create a backup of the database"""
        import shutil
        from datetime import datetime
        
        backup_name = f"internships_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        
        try:
            shutil.copy2(self.db_path, backup_name)
            console.print(f"[green]Database backed up to {backup_name}[/green]")
        except Exception as e:
            console.print(f"[red]Backup failed: {e}[/red]")

def main():
    """Main interactive menu"""
    manager = DatabaseManager()
    
    while True:
        console.print("\n" + "="*50)
        console.print("[bold blue]Database Management Tool[/bold blue]")
        console.print("="*50)
        console.print("1. Show database schema")
        console.print("2. Show database statistics")
        console.print("3. Search records")
        console.print("4. Clean duplicates")
        console.print("5. Clean company names")
        console.print("6. Remove old records")
        console.print("7. Export data")
        console.print("8. Backup database")
        console.print("9. Exit")
        
        choice = Prompt.ask("Choose an option", choices=["1", "2", "3", "4", "5", "6", "7", "8", "9"])
        
        if choice == "1":
            manager.show_schema()
        elif choice == "2":
            manager.show_stats()
        elif choice == "3":
            search_term = Prompt.ask("Search term (optional)")
            company = Prompt.ask("Company name (optional)")
            region = Prompt.ask("Region (optional)")
            manager.search_records(
                search_term if search_term else None,
                company if company else None,
                region if region else None
            )
        elif choice == "4":
            manager.clean_duplicates()
        elif choice == "5":
            manager.clean_company_names()
        elif choice == "6":
            days = Prompt.ask("Remove records older than (days)", default="90")
            manager.remove_old_records(int(days))
        elif choice == "7":
            filename = Prompt.ask("Export filename (optional)")
            manager.export_data(filename if filename else None)
        elif choice == "8":
            manager.backup_database()
        elif choice == "9":
            console.print("[green]Goodbye![/green]")
            break

if __name__ == "__main__":
    main() 