#!/usr/bin/env python3
"""
LLM-Powered Database Cleaner for Internship Data
Uses Gemini to intelligently clean, normalize, and validate internship postings
"""

import sqlite3
import json
import os
import time
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import shutil
from rich.console import Console
from rich.progress import Progress, track
from rich.prompt import Confirm, Prompt
from rich.table import Table
from rich import print as rprint

# Import our LLM adapters
from llm_adapters import LLMFactory, UniversalRateLimiter

# Configuration
DB_PATH = "internships.db"
BACKUP_DIR = "database_backups"
LOG_FILE = "database_cleanup.log"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class DatabaseCleaner:
    """LLM-powered database cleaner for internship data"""
    
    def __init__(self, use_rate_limiting: bool = True):
        self.console = Console()
        self.llm = None
        self.stats = {
            'total_records': 0,
            'removed_non_internships': 0,
            'removed_duplicates': 0,
            'removed_old_records': 0,
            'normalized_records': 0,
            'errors': 0
        }
        
        # Initialize LLM
        try:
            adapter = LLMFactory.create_adapter("gemini")
            if use_rate_limiting:
                self.llm = UniversalRateLimiter(adapter, requests_per_minute=30)  # Conservative rate limit
            else:
                self.llm = adapter
            self.console.print(f"[green]✅ Initialized {self.llm.get_model_name()}[/green]")
        except Exception as e:
            self.console.print(f"[red]❌ Failed to initialize LLM: {e}[/red]")
            raise
    
    def create_backup(self) -> str:
        """Create a backup of the database before cleaning"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path(BACKUP_DIR)
        backup_dir.mkdir(exist_ok=True)
        
        backup_path = backup_dir / f"internships_backup_{timestamp}.db"
        shutil.copy2(DB_PATH, backup_path)
        
        self.console.print(f"[green]✅ Database backed up to: {backup_path}[/green]")
        return str(backup_path)
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get current database statistics"""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        stats = {}
        
        # Total records
        cursor.execute("SELECT COUNT(*) as total FROM internships")
        stats['total_records'] = cursor.fetchone()['total']
        
        # By region
        cursor.execute("SELECT region, COUNT(*) as count FROM internships GROUP BY region ORDER BY count DESC")
        stats['by_region'] = dict(cursor.fetchall())
        
        # By year
        cursor.execute("SELECT year, COUNT(*) as count FROM internships WHERE year IS NOT NULL GROUP BY year ORDER BY year DESC")
        stats['by_year'] = dict(cursor.fetchall())
        
        # Records with questionable titles (likely not internships)
        cursor.execute("""
            SELECT COUNT(*) as count FROM internships 
            WHERE LOWER(title) NOT LIKE '%intern%' 
            AND LOWER(title) NOT LIKE '%co-op%' 
            AND LOWER(title) NOT LIKE '%coop%'
            AND LOWER(title) NOT LIKE '%student%'
        """)
        stats['questionable_titles'] = cursor.fetchone()['count']
        
        conn.close()
        return stats
    
    def display_stats(self, stats: Dict[str, Any]):
        """Display database statistics in a nice table"""
        table = Table(title="Database Statistics")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Total Records", str(stats['total_records']))
        table.add_row("Questionable Titles", str(stats['questionable_titles']))
        
        # Regional breakdown
        for region, count in stats['by_region'].items():
            percentage = (count / stats['total_records']) * 100
            table.add_row(f"  {region or 'Unknown'}", f"{count} ({percentage:.1f}%)")
        
        self.console.print(table)
    
    def is_internship_or_coop(self, title: str, description: str, types: str) -> Tuple[bool, float, str]:
        """Use LLM to determine if a posting is actually an internship or co-op"""
        
        prompt = f"""
You are an expert at identifying internship and co-op positions. Analyze this job posting and determine if it's truly an internship, co-op, or student position.

TITLE: {title}
DESCRIPTION: {description[:1000]}...  
TYPES: {types}

CRITERIA FOR INTERNSHIPS/CO-OPS:
- Explicitly mentions "intern", "internship", "co-op", "coop"
- Designed for students (undergraduate, graduate, PhD)
- Temporary/fixed duration (usually 3-12 months)
- Part of academic program or student development
- Entry-level positions for students
- Summer/semester programs for students

NOT INTERNSHIPS:
- Full-time permanent positions
- "Graduate" programs that are permanent roles
- "University graduate" positions (these are entry-level permanent jobs)
- "Apprenticeships" (these are longer-term training programs)
- "Fellows" or "Fellowship" (usually longer-term research positions)
- Regular employment targeting recent graduates

Respond in JSON format:
{{
    "is_internship": true/false,
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation of why this is or isn't an internship"
}}
"""
        
        try:
            response = self.llm.generate_content(prompt, response_format="application/json")
            result = json.loads(response)
            return result['is_internship'], result['confidence'], result['reasoning']
        except Exception as e:
            logger.error(f"LLM error for title '{title}': {e}")
            return True, 0.5, "Error in LLM analysis - keeping as safe default"
    
    def normalize_with_llm(self, record: Dict) -> Dict:
        """Use LLM to normalize and enhance record data"""
        
        prompt = f"""
Normalize and standardize this internship posting data. Extract key information and fix any inconsistencies.

TITLE: {record.get('title', '')}
COMPANY: {record.get('company_name', '')}
LOCATION: {record.get('location', '')}
DESCRIPTION: {record.get('description', '')[:800]}...
CURRENT_SEMESTER: {record.get('semester', '')}
CURRENT_YEAR: {record.get('year', '')}

TASKS:
1. Normalize the title (proper capitalization, remove redundant words)
2. Standardize company name (fix common misspellings, use official names)
3. Extract semester (Summer, Fall, Spring, Winter, Year-round) from title/description
4. Extract year (2024, 2025, 2026) from title/description
5. Identify if position is remote, hybrid, or onsite
6. Extract key skills/technologies mentioned
7. Determine if it's paid/unpaid (if mentioned)
8. Extract application deadline if mentioned

Respond in JSON format:
{{
    "normalized_title": "Clean, standardized title",
    "normalized_company": "Official company name", 
    "semester": "Summer/Fall/Spring/Winter/Year-round",
    "year": 2024/2025/2026,
    "remote_type": "Remote/Hybrid/Onsite/Unknown",
    "key_skills": ["skill1", "skill2"],
    "is_paid": true/false/null,
    "deadline": "YYYY-MM-DD or null",
    "priority_score": 1-10
}}
"""
        
        try:
            response = self.llm.generate_content(prompt, response_format="application/json")
            return json.loads(response)
        except Exception as e:
            logger.error(f"LLM normalization error for record {record.get('id', 'unknown')}: {e}")
            return {}
    
    def remove_non_internships(self, batch_size: int = 50) -> int:
        """Remove positions that aren't actually internships or co-ops"""
        self.console.print("\n[bold blue]🔍 Phase 1: Identifying Non-Internship Positions[/bold blue]")
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get potentially problematic records first
        cursor.execute("""
            SELECT id, title, description, types
            FROM internships 
            WHERE LOWER(title) NOT LIKE '%intern%' 
            AND LOWER(title) NOT LIKE '%co-op%' 
            AND LOWER(title) NOT LIKE '%coop%'
            AND LOWER(title) NOT LIKE '%student%'
            ORDER BY title
        """)
        
        questionable_records = cursor.fetchall()
        self.console.print(f"Found {len(questionable_records)} potentially non-internship records to review")
        
        to_remove = []
        
        # Process in batches
        for i in track(range(0, len(questionable_records), batch_size), description="Analyzing records..."):
            batch = questionable_records[i:i+batch_size]
            
            for record in batch:
                is_internship, confidence, reasoning = self.is_internship_or_coop(
                    record['title'], 
                    record['description'] or '',
                    record['types'] or ''
                )
                
                if not is_internship and confidence > 0.7:
                    to_remove.append({
                        'id': record['id'],
                        'title': record['title'],
                        'reasoning': reasoning,
                        'confidence': confidence
                    })
                elif not is_internship and confidence > 0.5:
                    # Ask user for confirmation on uncertain cases
                    self.console.print(f"\n[yellow]🤔 Uncertain case (confidence: {confidence:.2f})[/yellow]")
                    self.console.print(f"Title: {record['title']}")
                    self.console.print(f"Reasoning: {reasoning}")
                    
                    if Confirm.ask("Remove this record?"):
                        to_remove.append({
                            'id': record['id'],
                            'title': record['title'],
                            'reasoning': reasoning,
                            'confidence': confidence
                        })
            
            # Small delay to respect rate limits
            time.sleep(1)
        
        # Show what will be removed
        if to_remove:
            self.console.print(f"\n[red]🗑️  Will remove {len(to_remove)} non-internship records:[/red]")
            for item in to_remove[:10]:  # Show first 10
                self.console.print(f"  • {item['title']} (confidence: {item['confidence']:.2f})")
            
            if len(to_remove) > 10:
                self.console.print(f"  ... and {len(to_remove) - 10} more")
            
            if Confirm.ask("\nProceed with removal?"):
                # Remove the records
                ids_to_remove = [item['id'] for item in to_remove]
                cursor.executemany("DELETE FROM internships WHERE id = ?", [(id_,) for id_ in ids_to_remove])
                conn.commit()
                
                self.console.print(f"[green]✅ Removed {len(to_remove)} non-internship records[/green]")
                self.stats['removed_non_internships'] = len(to_remove)
            else:
                self.console.print("[yellow]Skipped removal step[/yellow]")
        else:
            self.console.print("[green]✅ No obvious non-internship records found[/green]")
        
        conn.close()
        return len(to_remove)
    
    def normalize_all_records(self, batch_size: int = 30) -> int:
        """Normalize all remaining records using LLM"""
        self.console.print("\n[bold blue]🔧 Phase 2: Normalizing Records[/bold blue]")
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all records that need normalization
        cursor.execute("SELECT * FROM internships ORDER BY date_scraped DESC")
        records = cursor.fetchall()
        
        updated_count = 0
        
        # Process in batches
        for i in track(range(0, len(records), batch_size), description="Normalizing records..."):
            batch = records[i:i+batch_size]
            
            for record in batch:
                try:
                    # Convert row to dict
                    record_dict = dict(record)
                    
                    # Get LLM normalization
                    normalized = self.normalize_with_llm(record_dict)
                    
                    if normalized:
                        # Update the record
                        cursor.execute("""
                            UPDATE internships SET
                                normalized_title = ?,
                                normalized_company = ?,
                                semester = ?,
                                year = ?,
                                priority_score = ?
                            WHERE id = ?
                        """, (
                            normalized.get('normalized_title', record['title']),
                            normalized.get('normalized_company', record['company_name']),
                            normalized.get('semester', record['semester']),
                            normalized.get('year', record['year']),
                            normalized.get('priority_score', 5),
                            record['id']
                        ))
                        updated_count += 1
                
                except Exception as e:
                    logger.error(f"Error normalizing record {record['id']}: {e}")
                    self.stats['errors'] += 1
            
            # Commit batch and add delay
            conn.commit()
            time.sleep(2)  # Respect rate limits
        
        conn.close()
        self.stats['normalized_records'] = updated_count
        self.console.print(f"[green]✅ Normalized {updated_count} records[/green]")
        return updated_count
    
    def remove_duplicates(self) -> int:
        """Remove duplicate records based on application_link"""
        self.console.print("\n[bold blue]🔄 Phase 3: Removing Duplicates[/bold blue]")
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Find duplicates (keep most recent by date_scraped)
        cursor.execute("""
            DELETE FROM internships WHERE id NOT IN (
                SELECT id FROM (
                    SELECT id, application_link, MAX(date_scraped) as max_date
                    FROM internships
                    GROUP BY application_link
                )
            )
        """)
        
        removed_count = cursor.rowcount
        conn.commit()
        conn.close()
        
        self.stats['removed_duplicates'] = removed_count
        self.console.print(f"[green]✅ Removed {removed_count} duplicate records[/green]")
        return removed_count
    
    def remove_old_records(self, days_old: int = 365) -> int:
        """Remove records older than specified days"""
        self.console.print(f"\n[bold blue]🗓️  Phase 4: Removing Records Older Than {days_old} Days[/bold blue]")
        
        cutoff_date = (datetime.now() - timedelta(days=days_old)).strftime('%Y-%m-%d')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM internships WHERE date_scraped < ?", (cutoff_date,))
        removed_count = cursor.rowcount
        conn.commit()
        conn.close()
        
        self.stats['removed_old_records'] = removed_count
        self.console.print(f"[green]✅ Removed {removed_count} old records[/green]")
        return removed_count
    
    def prioritize_us_records(self) -> int:
        """Boost priority scores for US-based internships"""
        self.console.print("\n[bold blue]🇺🇸 Phase 5: Prioritizing US Records[/bold blue]")
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Boost US records
        cursor.execute("""
            UPDATE internships 
            SET priority_score = COALESCE(priority_score, 5) + 3
            WHERE region = 'North America' 
            AND (country = 'USA' OR country IS NULL OR country = '')
        """)
        
        us_boosted = cursor.rowcount
        
        # Moderate boost for other North American countries
        cursor.execute("""
            UPDATE internships 
            SET priority_score = COALESCE(priority_score, 5) + 1
            WHERE region = 'North America' 
            AND country NOT IN ('USA', '', NULL)
        """)
        
        na_boosted = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        self.console.print(f"[green]✅ Boosted {us_boosted} US records and {na_boosted} other North American records[/green]")
        return us_boosted + na_boosted
    
    def generate_cleanup_report(self) -> None:
        """Generate a final cleanup report"""
        self.console.print("\n[bold green]📊 Cleanup Complete! Summary Report:[/bold green]")
        
        # Display stats
        table = Table(title="Cleanup Statistics")
        table.add_column("Action", style="cyan")
        table.add_column("Count", style="green")
        
        table.add_row("Total Records Processed", str(self.stats['total_records']))
        table.add_row("Non-Internships Removed", str(self.stats['removed_non_internships']))
        table.add_row("Duplicates Removed", str(self.stats['removed_duplicates']))
        table.add_row("Old Records Removed", str(self.stats['removed_old_records']))
        table.add_row("Records Normalized", str(self.stats['normalized_records']))
        table.add_row("Errors Encountered", str(self.stats['errors']))
        
        self.console.print(table)
        
        # Get final stats
        final_stats = self.get_database_stats()
        self.console.print(f"\n[bold cyan]Final database contains {final_stats['total_records']} records[/bold cyan]")
        
        # Calculate US percentage
        us_records = final_stats['by_region'].get('North America', 0)
        us_percentage = (us_records / final_stats['total_records']) * 100 if final_stats['total_records'] > 0 else 0
        self.console.print(f"US/North America: {us_records} records ({us_percentage:.1f}%)")
    
    def run_full_cleanup(self):
        """Run the complete database cleanup process"""
        self.console.print("[bold blue]🚀 Starting LLM-Powered Database Cleanup[/bold blue]")
        
        # Get initial stats
        initial_stats = self.get_database_stats()
        self.stats['total_records'] = initial_stats['total_records']
        
        self.console.print(f"\nStarting with {initial_stats['total_records']} records")
        self.display_stats(initial_stats)
        
        # Create backup
        backup_path = self.create_backup()
        
        # Confirm before proceeding
        if not Confirm.ask("\nProceed with database cleanup?"):
            self.console.print("[yellow]Cleanup cancelled[/yellow]")
            return
        
        try:
            # Phase 1: Remove non-internships
            self.remove_non_internships()
            
            # Phase 2: Normalize records
            self.normalize_all_records()
            
            # Phase 3: Remove duplicates
            self.remove_duplicates()
            
            # Phase 4: Remove old records
            self.remove_old_records()
            
            # Phase 5: Prioritize US records
            self.prioritize_us_records()
            
            # Generate final report
            self.generate_cleanup_report()
            
            self.console.print(f"\n[green]✅ Cleanup completed successfully![/green]")
            self.console.print(f"[green]💾 Backup saved at: {backup_path}[/green]")
            
        except Exception as e:
            self.console.print(f"[red]❌ Error during cleanup: {e}[/red]")
            logger.error(f"Cleanup error: {e}")
            
            # Offer to restore backup
            if Confirm.ask("Restore from backup?"):
                shutil.copy2(backup_path, DB_PATH)
                self.console.print("[green]✅ Database restored from backup[/green]")

def main():
    """Main entry point"""
    console = Console()
    
    # Check if database exists
    if not os.path.exists(DB_PATH):
        console.print(f"[red]❌ Database not found: {DB_PATH}[/red]")
        return
    
    # Check for API key
    if not os.getenv("GEMINI_API_KEY"):
        console.print("[red]❌ GEMINI_API_KEY environment variable not set[/red]")
        console.print("Please set your Gemini API key: export GEMINI_API_KEY='your-key-here'")
        return
    
    try:
        cleaner = DatabaseCleaner()
        cleaner.run_full_cleanup()
    except Exception as e:
        console.print(f"[red]❌ Failed to initialize cleaner: {e}[/red]")

if __name__ == "__main__":
    main()
