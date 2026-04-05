#!/usr/bin/env python3
"""
Runner script for Ultimate Student Position Classifier
====================================================

This script safely runs the classification system with automatic backups.
"""

import os
import sys
import shutil
from datetime import datetime
from ultimate_student_position_classifier import UltimateStudentClassifier

def backup_database(db_path="backend/internships.db"):
    """Create a backup of the database before processing"""
    backup_dir = "backend/database_backups"
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{backup_dir}/internships_backup_ultimate_{timestamp}.db"
    
    shutil.copy2(db_path, backup_path)
    print(f"✅ Database backed up to {backup_path}")
    return backup_path

def main():
    print("╭──────────────────────────────────────────╮")
    print("│ 🎯 Ultimate Student Position Classifier │")
    print("╰──────────────────────────────────────────╯")
    print("This system will:")
    print("• Filter out non-student positions (managers, supervisors, etc.)")
    print("• Properly classify remaining jobs into preset categories")
    print("• Use LLM for accurate classification")
    print("• Clean up the tagging system")
    print()
    
    # Check for test mode
    test_mode = '--test' in sys.argv
    
    if test_mode:
        print("🧪 Running in TEST mode (100 jobs only)")
    else:
        print("🚀 Running in FULL mode (all jobs)")
        
    print()
    
    # Create classifier
    classifier = UltimateStudentClassifier()
    
    # Show current database stats
    import sqlite3
    conn = sqlite3.connect("backend/internships.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM internships")
    total_jobs = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM internships 
        WHERE title LIKE '%Supervisor%' OR title LIKE '%Manager%' OR 
              title LIKE '%Director%' OR title LIKE '%Senior%' OR 
              title LIKE '%Lead%' OR title LIKE '%Principal%'
    """)
    problematic_jobs = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"📊 Current database: {total_jobs} total jobs")
    print(f"⚠️ Likely non-student positions: {problematic_jobs}")
    print()
    
    if not test_mode:
        # Create backup
        backup_path = backup_database()
        print()
        
        # Final confirmation
        response = input("Proceed with classification? This will modify your database (y/N): ")
        if response.lower() != 'y':
            print("❌ Classification cancelled")
            return
    else:
        print("Test mode - no database changes will be made")
    
    print()
    
    # Run classification
    try:
        classifier.process_database(test_mode=test_mode)
        
        if not test_mode:
            print()
            print("🎉 Classification complete! Your database has been cleaned and improved.")
            print("📊 Check the logs for detailed statistics")
            print(f"💾 Backup available at: {backup_path}")
            
    except Exception as e:
        print(f"❌ Classification failed: {e}")
        if not test_mode:
            print(f"💾 Your original database is backed up at: {backup_path}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 