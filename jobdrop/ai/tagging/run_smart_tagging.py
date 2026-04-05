#!/usr/bin/env python3
"""
Runner for Smart Tagging System
==============================

Safely run the smart tagging system with automatic backups.
"""

import os
import sys
import shutil
from datetime import datetime
from smart_tagging_system import SmartTaggingSystem

def backup_database(db_path="backend/internships.db"):
    """Create a backup of the database before processing"""
    backup_dir = "backend/database_backups"
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{backup_dir}/internships_backup_smart_tagging_{timestamp}.db"
    
    shutil.copy2(db_path, backup_path)
    print(f"✅ Database backed up to: {backup_path}")
    return backup_path

def main():
    print("""
╭──────────────────────────────────────────╮
│ 🧠 Smart LLM-Based Tagging System       │
╰──────────────────────────────────────────╯
This system will:
• Fix wrong categorizations (Investment Banking ≠ Data Science)
• Create meaningful, specific tags
• Remove duplicate/generic tags  
• Enable semantic filtering
• Detect similar jobs to reduce redundancy
""")
    
    # Check for test mode
    test_mode = '--test' in sys.argv
    
    if test_mode:
        print("🧪 Running in TEST mode (100 jobs only)\n")
    else:
        print("🚀 Running on ALL jobs in database\n")
        
    # Check for API key
    if not os.getenv('GEMINI_API_KEY'):
        print("❌ Error: GEMINI_API_KEY environment variable not set")
        print("Please set it with: export GEMINI_API_KEY='your_key_here'")
        return 1
    
    # Backup database
    if not test_mode:
        backup_path = backup_database()
        print()
    
    # Run smart tagging
    try:
        system = SmartTaggingSystem()
        processed, improved = system.process_all_jobs(test_mode=test_mode)
        
        print(f"""
🎉 Smart tagging completed successfully!

Results:
• Processed: {processed} jobs
• High-confidence: {improved} jobs  
• Success rate: {(improved/processed)*100:.1f}%

Your site now has:
✅ Accurate industry categorization
✅ Meaningful, specific tags
✅ Smart duplicate detection
✅ Better filtering capabilities
""")
        
        if not test_mode:
            print(f"💾 Backup saved at: {backup_path}")
            
        return 0
        
    except Exception as e:
        print(f"❌ Error during processing: {e}")
        return 1

if __name__ == "__main__":
    exit(main()) 