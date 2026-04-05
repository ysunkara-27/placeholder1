#!/usr/bin/env python3
"""
Resume Scraper Script
Analyzes existing database to determine which sites have been processed
and allows resuming the internship scraper from where it left off.
"""

import sqlite3
import sys
import os
from datetime import datetime
from rich.console import Console
from rich.table import Table

# Import the main scraper functions
from internship_scraper import main as run_full_scraper, setup_database, COMPANIES_FILE, DB_NAME

console = Console()

def analyze_database_progress():
    """Analyze what sites have been processed and their status."""
    if not os.path.exists(DB_NAME):
        console.print(f"[red]Database {DB_NAME} not found. No previous progress to analyze.[/red]")
        return [], []
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Get today's date
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Get all source URLs and their internship counts
    cursor.execute("""
        SELECT source_url, COUNT(*) as count, MAX(date_scraped) as last_scraped
        FROM internships 
        GROUP BY source_url 
        ORDER BY last_scraped DESC
    """)
    
    all_processed_sites = cursor.fetchall()
    
    # Get sites processed TODAY specifically
    cursor.execute("""
        SELECT DISTINCT source_url
        FROM internships 
        WHERE date_scraped = ?
    """, (today,))
    
    today_processed_urls = {row[0] for row in cursor.fetchall()}
    conn.close()
    
    # Load target URLs from companies.txt
    try:
        with open(COMPANIES_FILE, "r") as f:
            target_urls = [line.strip() for line in f if line.strip() and line.startswith("http")]
    except FileNotFoundError:
        console.print(f"[red]ERROR: {COMPANIES_FILE} not found.[/red]")
        return [], []
    
    # Only skip URLs that were processed TODAY
    unprocessed_urls = [url for url in target_urls if url not in today_processed_urls]
    
    return all_processed_sites, unprocessed_urls

def display_progress_report(processed_sites, unprocessed_urls):
    """Display a detailed progress report."""
    console.print("\n[bold blue]Scraping Progress Report[/bold blue]")
    console.print("=" * 50)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    if processed_sites:
        table = Table(title="✅ Previously Processed Sites")
        table.add_column("Site URL", style="cyan")
        table.add_column("Internships Found", justify="right", style="green")
        table.add_column("Last Scraped", style="yellow")
        table.add_column("Status", style="magenta")
        
        today_count = 0
        for site_url, count, last_scraped in processed_sites:
            # Truncate long URLs for display
            display_url = site_url if len(site_url) <= 60 else site_url[:57] + "..."
            status = "✅ Done Today" if last_scraped == today else "🔄 Will Re-scrape"
            if last_scraped == today:
                today_count += 1
            table.add_row(display_url, str(count), last_scraped, status)
        
        console.print(table)
        console.print(f"\n[green]Total sites in database: {len(processed_sites)}[/green]")
        console.print(f"[green]Sites completed today: {today_count}[/green]")
        total_internships = sum(site[1] for site in processed_sites)
        console.print(f"[green]Total internships in database: {total_internships}[/green]")
    
    if unprocessed_urls:
        console.print(f"\n[yellow]⏳ Sites to process today: {len(unprocessed_urls)}[/yellow]")
        for i, url in enumerate(unprocessed_urls, 1):
            console.print(f"  {i}. {url}")
    else:
        console.print(f"\n[green]🎉 All sites have been processed today ({today})![/green]")

def create_resume_companies_file(unprocessed_urls, start_from_index=0):
    """Create a temporary companies file with only unprocessed URLs."""
    if start_from_index > 0:
        unprocessed_urls = unprocessed_urls[start_from_index:]
    
    if not unprocessed_urls:
        console.print("[green]No sites remaining to process.[/green]")
        return None
    
    resume_file = "companies_resume.txt"
    with open(resume_file, "w") as f:
        for url in unprocessed_urls:
            f.write(url + "\n")
    
    console.print(f"[green]Created {resume_file} with {len(unprocessed_urls)} remaining sites.[/green]")
    return resume_file

def run_resume_scraper(companies_file):
    """Run the scraper with a custom companies file."""
    # Temporarily replace the companies file
    import internship_scraper
    original_file = internship_scraper.COMPANIES_FILE
    internship_scraper.COMPANIES_FILE = companies_file
    
    try:
        console.print(f"[blue]Starting scraper with {companies_file}...[/blue]")
        run_full_scraper()
    finally:
        # Restore original file
        internship_scraper.COMPANIES_FILE = original_file
        # Clean up temporary file
        if os.path.exists(companies_file):
            os.remove(companies_file)
            console.print(f"[yellow]Cleaned up temporary file: {companies_file}[/yellow]")

def main():
    console.print("[bold green]JobDrop Internship Scraper - Resume Tool[/bold green]")
    
    # Analyze current progress
    processed_sites, unprocessed_urls = analyze_database_progress()
    display_progress_report(processed_sites, unprocessed_urls)
    
    if not unprocessed_urls:
        console.print("\n[green]All sites have been processed. Nothing to resume.[/green]")
        return
    
    console.print("\n[bold]Options:[/bold]")
    console.print("1. Resume from the beginning of unprocessed sites")
    console.print("2. Start from a specific site number")
    console.print("3. Just show the report and exit")
    
    choice = console.input("\n[cyan]Enter your choice (1-3): [/cyan]")
    
    if choice == "1":
        resume_file = create_resume_companies_file(unprocessed_urls)
        if resume_file:
            run_resume_scraper(resume_file)
    
    elif choice == "2":
        console.print(f"\n[yellow]Unprocessed sites:[/yellow]")
        for i, url in enumerate(unprocessed_urls, 1):
            console.print(f"  {i}. {url}")
        
        try:
            start_num = int(console.input(f"\n[cyan]Enter site number to start from (1-{len(unprocessed_urls)}): [/cyan]"))
            if 1 <= start_num <= len(unprocessed_urls):
                resume_file = create_resume_companies_file(unprocessed_urls, start_num - 1)
                if resume_file:
                    run_resume_scraper(resume_file)
            else:
                console.print("[red]Invalid site number.[/red]")
        except ValueError:
            console.print("[red]Please enter a valid number.[/red]")
    
    elif choice == "3":
        console.print("[green]Report displayed. Exiting.[/green]")
    
    else:
        console.print("[red]Invalid choice.[/red]")

if __name__ == "__main__":
    main() 