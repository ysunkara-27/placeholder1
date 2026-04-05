#!/usr/bin/env python3
"""
Ultimate Broad Classifier for JobDrop
Clears all existing tags and implements comprehensive broader classification
Includes term period classification (Summer 2025, Co-op, etc.)
"""

import sqlite3
import json
import re
import os
import time
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import google.generativeai as genai
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class BroadClassification:
    """Data class for broader classification results"""
    position_type: str
    role_categories: List[str]
    term_periods: List[str]
    additional_tags: List[str]
    skills: List[str]
    confidence_score: int
    is_student_position: bool

# BROADER ROLE TAXONOMY
BROADER_ROLE_TAXONOMY = {
    # Position Types (More inclusive)
    'position_types': {
        'internship': ['intern', 'internship', 'summer', 'winter', 'spring', 'fall', 'seasonal'],
        'co_op': ['co-op', 'coop', 'cooperative', 'rotation', 'alternating'],
        'student_program': ['student', 'new grad', 'entry level', 'graduate program', 'campus', 'university'],
        'fellowship': ['fellowship', 'research fellow', 'postdoc', 'scholar'],
        'apprenticeship': ['apprentice', 'trainee', 'associate program']
    },
    
    # ENGINEERING (Broader categories)
    'engineering': {
        'mechanical_engineering': [
            # Traditional mechanical
            'Mechanical', 'ME', 'Mechanical Design', 'CAD', 'SolidWorks', 'AutoCAD', 
            'HVAC', 'Thermodynamics', 'Fluid', 'Manufacturing', 'Product Design',
            # Broader mechanical-related
            'Quality Engineer', 'Process Engineer', 'Production Engineer',
            'Robotics', 'Automation', 'Equipment', 'Assembly', 'Testing',
            'Materials', 'Stress', 'FEA', 'Design Engineer'
        ],
        'electrical_engineering': [
            # Traditional electrical
            'Electrical', 'EE', 'Electronics', 'Circuit', 'Power', 'Control Systems',
            'Signal Processing', 'Embedded', 'FPGA', 'PCB', 'RF',
            # Broader electrical-related
            'Hardware', 'Firmware', 'Instrumentation', 'Telecommunications',
            'Power Systems', 'Energy', 'Solar', 'Grid', 'Battery'
        ],
        'computer_engineering': [
            'Computer Engineering', 'Computer Engineer', 'Hardware Engineering',
            'VLSI', 'Chip', 'Microprocessor', 'Computer Architecture',
            'Digital Systems', 'Hardware Software', 'Embedded Programming'
        ],
        'civil_engineering': [
            'Civil', 'Structural', 'Construction', 'Infrastructure', 'Transportation',
            'Geotechnical', 'Water Resources', 'Urban Planning', 'Surveying',
            'Environmental Engineering', 'Traffic', 'Bridge', 'Building'
        ],
        'chemical_engineering': [
            'Chemical Engineering', 'Chemical Engineer', 'Process Engineering',
            'Chemical Process', 'Petrochemical', 'Pharmaceutical Engineering',
            'Bioprocess', 'Refinery', 'Chemical Plant', 'Process Control'
        ],
        'aerospace_engineering': [
            'Aerospace', 'Aeronautical', 'Astronautical', 'Aircraft', 'Spacecraft',
            'Propulsion', 'Avionics', 'Defense', 'Space', 'Aviation', 'Flight'
        ],
        'biomedical_engineering': [
            'Biomedical', 'Medical Device', 'Medical Equipment', 'Clinical Engineering',
            'Medical Technology', 'Biotechnology', 'Bioengineering', 'FDA', 'Regulatory'
        ],
        'industrial_engineering': [
            # Broader industrial/operations focus
            'Industrial', 'Operations Research', 'Supply Chain', 'Logistics',
            'Quality', 'Six Sigma', 'Lean', 'Process Optimization',
            'Systems Engineering', 'Operations Management', 'Efficiency',
            'Workflow', 'Production Planning', 'Inventory'
        ],
        'general_engineering': [
            # Catch-all for engineering roles
            'Engineer', 'Engineering', 'Technical', 'R&D', 'Development',
            'Design', 'Analysis', 'Testing', 'Validation', 'Integration'
        ]
    },
    
    # TECHNOLOGY (Broader, more inclusive)
    'technology': {
        'software_engineering': [
            # Traditional software
            'Software', 'Programming', 'Developer', 'Development', 'Coding',
            'Full Stack', 'Backend', 'Frontend', 'Web', 'Mobile', 'App',
            # Broader software-related
            'API', 'Database', 'Cloud', 'Platform', 'System', 'Application',
            'Java', 'Python', 'JavaScript', 'C++', 'React', 'Angular'
        ],
        'data_analytics': [
            # Broader data category
            'Data', 'Analytics', 'Analysis', 'Analyst', 'Business Intelligence',
            'Reporting', 'Dashboard', 'Visualization', 'Statistics', 'Research',
            'SQL', 'Excel', 'Tableau', 'Power BI', 'Insights'
        ],
        'data_science_ai': [
            'Data Science', 'Data Scientist', 'Machine Learning', 'AI',
            'Artificial Intelligence', 'Deep Learning', 'Neural Networks',
            'Predictive', 'Modeling', 'Algorithm', 'TensorFlow', 'PyTorch'
        ],
        'cybersecurity': [
            'Security', 'Cybersecurity', 'Information Security', 'Cyber',
            'Penetration Testing', 'Risk', 'Compliance', 'SOC',
            'Incident Response', 'Threat', 'Vulnerability'
        ],
        'cloud_infrastructure': [
            'Cloud', 'Infrastructure', 'DevOps', 'SRE', 'AWS', 'Azure', 'GCP',
            'Kubernetes', 'Docker', 'CI/CD', 'Terraform', 'Automation',
            'Network', 'Systems Administration'
        ],
        'product_management': [
            'Product', 'Product Manager', 'Product Owner', 'Strategy',
            'Roadmap', 'Requirements', 'Agile', 'Scrum', 'Project Management'
        ],
        'quality_assurance': [
            'QA', 'Quality Assurance', 'Testing', 'Test', 'Quality Control',
            'Automation Testing', 'Manual Testing', 'Performance Testing'
        ],
        'design_ux': [
            'Design', 'UX', 'UI', 'User Experience', 'User Interface',
            'Product Design', 'Graphic Design', 'Visual Design',
            'Creative', 'Interaction Design'
        ],
        'general_technology': [
            # Catch-all for tech roles
            'Technology', 'Tech', 'IT', 'Information Technology',
            'Digital', 'Innovation', 'Technical Support'
        ]
    },
    
    # BUSINESS & FINANCE (Broader categories)
    'business_finance': {
        'finance_banking': [
            # Broader finance category
            'Finance', 'Financial', 'Banking', 'Investment', 'Trading',
            'Capital Markets', 'Equity', 'Fixed Income', 'M&A',
            'Private Equity', 'Venture Capital', 'Accounting', 'Audit'
        ],
        'consulting': [
            'Consulting', 'Consultant', 'Strategy', 'Advisory',
            'Management Consulting', 'Business Consulting', 'Process Improvement'
        ],
        'marketing_sales': [
            # Combined marketing and sales
            'Marketing', 'Sales', 'Business Development', 'Digital Marketing',
            'Social Media', 'Brand', 'Campaign', 'Customer', 'Account Management',
            'Revenue', 'Growth', 'Lead Generation'
        ],
        'operations_supply_chain': [
            'Operations', 'Supply Chain', 'Logistics', 'Procurement',
            'Vendor', 'Process', 'Efficiency', 'Project Management'
        ],
        'business_analyst': [
            'Business Analyst', 'Business Analysis', 'Requirements',
            'Process Analysis', 'Business Intelligence', 'Strategy Analysis'
        ],
        'human_resources': [
            'Human Resources', 'HR', 'People', 'Talent', 'Recruiting',
            'Compensation', 'Benefits', 'Training', 'Employee'
        ],
        'general_business': [
            # Catch-all for business roles
            'Business', 'Management', 'Corporate', 'Administration',
            'Coordinator', 'Specialist', 'Associate'
        ]
    },
    
    # RESEARCH & SCIENCE (Broader)
    'research_science': {
        'research_development': [
            'Research', 'R&D', 'Development', 'Innovation', 'Laboratory',
            'Lab', 'Clinical', 'Academic', 'Scientific', 'Study'
        ],
        'life_sciences': [
            # Broader life sciences
            'Biology', 'Biotechnology', 'Biotech', 'Pharmaceutical', 'Drug',
            'Clinical', 'Medical Research', 'Genomics', 'Bioinformatics',
            'Chemistry', 'Biochemistry', 'Molecular'
        ],
        'physical_sciences': [
            'Physics', 'Chemistry', 'Materials Science', 'Nanotechnology',
            'Optics', 'Photonics', 'Quantum', 'Applied Physics'
        ],
        'mathematics_statistics': [
            'Mathematics', 'Statistics', 'Mathematical', 'Statistical',
            'Modeling', 'Computational', 'Actuarial', 'Quantitative'
        ]
    },
    
    # OTHER (Very broad categories)
    'other': {
        'healthcare_medical': [
            'Healthcare', 'Health', 'Medical', 'Hospital', 'Clinical',
            'Nursing', 'Pharmacy', 'Patient', 'Care', 'Wellness'
        ],
        'legal_compliance': [
            'Legal', 'Law', 'Compliance', 'Regulatory', 'Risk',
            'Patent', 'Intellectual Property', 'Contract', 'Policy'
        ],
        'media_communications': [
            'Media', 'Communication', 'Marketing', 'Content', 'Social Media',
            'PR', 'Public Relations', 'Writing', 'Journalism', 'Creative'
        ],
        'education_training': [
            'Education', 'Training', 'Teaching', 'Academic', 'Learning',
            'Curriculum', 'Student', 'Educational'
        ],
        'government_policy': [
            'Government', 'Policy', 'Public', 'Political', 'Administration',
            'Nonprofit', 'NGO', 'Think Tank'
        ],
        'general_other': [
            # Very broad catch-all
            'Intern', 'Associate', 'Assistant', 'Coordinator', 'Specialist',
            'Representative', 'Advisor', 'Support', 'Service'
        ]
    }
}

# TERM PERIOD CLASSIFICATION
TERM_PERIODS = {
    'seasonal_terms': {
        'summer_2024': ['summer 2024', 'summer2024', '2024 summer'],
        'fall_2024': ['fall 2024', 'fall2024', '2024 fall', 'autumn 2024'],
        'winter_2024': ['winter 2024', 'winter2024', '2024 winter'],
        'spring_2025': ['spring 2025', 'spring2025', '2025 spring'],
        'summer_2025': ['summer 2025', 'summer2025', '2025 summer'],
        'fall_2025': ['fall 2025', 'fall2025', '2025 fall', 'autumn 2025'],
        'winter_2025': ['winter 2025', 'winter2025', '2025 winter'],
        'spring_2026': ['spring 2026', 'spring2026', '2026 spring'],
        'summer_2026': ['summer 2026', 'summer2026', '2026 summer'],
        'fall_2026': ['fall 2026', 'fall2026', '2026 fall', 'autumn 2026'],
        'winter_2026': ['winter 2026', 'winter2026', '2026 winter']
    },
    'program_types': {
        'co_op_program': ['co-op', 'coop', 'cooperative education', 'rotation program'],
        'internship_program': ['internship', 'intern program', 'summer internship'],
        'new_grad_program': ['new grad', 'new graduate', 'graduate program', 'entry level'],
        'fellowship_program': ['fellowship', 'research fellowship', 'postdoc'],
        'year_round': ['year round', 'year-round', 'ongoing', 'continuous']
    },
    'duration': {
        'short_term': ['3 month', '10 week', '12 week', 'summer only'],
        'medium_term': ['6 month', 'semester', 'academic year'],
        'long_term': ['8 month', '12 month', 'year long', 'extended']
    }
}

# BROADER CLASSIFICATION PROMPT
BROADER_CLASSIFICATION_PROMPT = """
You are an expert job classification system focused on BROAD, INCLUSIVE categorization. 
Err on the side of INCLUDING rather than excluding categories.

POSITION DETAILS:
Title: {title}
Company: {company}
Location: {location} 
Description: {description}

CLASSIFICATION APPROACH - BE BROAD AND INCLUSIVE:

1. **POSITION TYPE** (Choose primary, be generous):
   - internship: ANY student position, summer/winter programs, temporary roles
   - co_op: Rotation programs, alternating work/school, longer-term student roles
   - student_program: New grad programs, campus programs, entry-level for students

2. **ROLE CATEGORIES** (Select ALL that could possibly apply - be generous):

ENGINEERING (If ANY engineering aspects):
- mechanical_engineering: Manufacturing, quality, testing, design, materials, robotics
- electrical_engineering: Hardware, electronics, power, energy, embedded systems
- computer_engineering: Hardware, embedded, computer systems
- civil_engineering: Construction, infrastructure, environmental
- chemical_engineering: Process, pharmaceutical, chemical industry
- aerospace_engineering: Aviation, defense, space, aircraft
- biomedical_engineering: Medical devices, healthcare technology
- industrial_engineering: Operations, quality, logistics, process optimization
- general_engineering: Any other engineering role

TECHNOLOGY (If ANY tech aspects):
- software_engineering: Programming, development, coding, apps, web
- data_analytics: Data analysis, reporting, business intelligence, research
- data_science_ai: Machine learning, AI, predictive modeling
- cybersecurity: Security, risk, compliance
- cloud_infrastructure: Cloud, DevOps, infrastructure, systems
- product_management: Product roles, strategy, project management
- quality_assurance: Testing, QA, quality control
- design_ux: Design, UX/UI, creative roles
- general_technology: IT, tech support, digital roles

BUSINESS & FINANCE (If ANY business aspects):
- finance_banking: Finance, banking, investment, accounting
- consulting: Strategy, advisory, business consulting
- marketing_sales: Marketing, sales, business development, customer roles
- operations_supply_chain: Operations, logistics, supply chain
- business_analyst: Analysis, requirements, business intelligence
- human_resources: HR, people, recruiting, talent
- general_business: Business roles, management, administration

RESEARCH & SCIENCE (If ANY research aspects):
- research_development: Research, R&D, innovation, lab work
- life_sciences: Biology, biotech, pharmaceutical, medical research
- physical_sciences: Physics, chemistry, materials science
- mathematics_statistics: Math, statistics, quantitative analysis

OTHER (If doesn't fit above):
- healthcare_medical: Healthcare, medical, clinical (non-research)
- legal_compliance: Legal, compliance, regulatory, risk
- media_communications: Media, communications, content, creative
- education_training: Education, training, academic
- government_policy: Government, policy, public sector
- general_other: Catch-all for other roles

3. **TERM PERIODS** (Extract time information):
   - Seasonal: summer_2024, fall_2024, winter_2024, spring_2025, summer_2025, fall_2025, winter_2025, spring_2026, summer_2026, fall_2026, winter_2026
   - Program: co_op_program, internship_program, new_grad_program, fellowship_program, year_round
   - Duration: short_term, medium_term, long_term

4. **ADDITIONAL TAGS**: usa, canada, remote, hybrid, entry_level, paid, unpaid

CRITICAL RULES FOR BROAD CLASSIFICATION:
- A "Quality Engineer" gets: mechanical_engineering + industrial_engineering + general_engineering
- A "Software Engineer" gets: software_engineering + general_technology 
- A "Data Analyst" gets: data_analytics + general_technology
- A "Business Analyst" gets: business_analyst + data_analytics + general_business
- Research roles get: research_development + relevant science field
- ANY manufacturing role gets: mechanical_engineering or industrial_engineering
- Multiple tags are ENCOURAGED - be generous with categories

RESPONSE FORMAT (JSON):
{{
    "position_type": "internship/co_op/student_program",
    "role_categories": ["category1", "category2", "category3", ...], 
    "term_periods": ["summer_2025", "internship_program", "short_term"],
    "additional_tags": ["usa", "entry_level", "paid"],
    "skills": ["python", "excel", "autocad", "sql", ...],
    "confidence_score": 85,
    "reasoning": "Explanation of broad classification choices",
    "is_student_position": true/false
}}

REMEMBER: When in doubt, INCLUDE the category. Be generous and broad!
"""

class UltimateBroadClassifier:
    """Ultimate broad classifier that clears existing data and reclassifies everything"""
    
    def __init__(self, gemini_api_key: str, db_path: str = "backend/internships.db"):
        self.db_path = db_path
        
        # Configure Gemini
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Rate limiting
        self.request_count = 0
        self.last_request_time = 0
        self.max_requests_per_minute = 60
    
    def rate_limit(self):
        """Simple rate limiting for API calls"""
        current_time = time.time()
        if current_time - self.last_request_time < 60:
            self.request_count += 1
            if self.request_count >= self.max_requests_per_minute:
                sleep_time = 60 - (current_time - self.last_request_time)
                logger.info(f"Rate limit reached, sleeping for {sleep_time:.2f} seconds")
                time.sleep(sleep_time)
                self.request_count = 0
                self.last_request_time = time.time()
        else:
            self.request_count = 1
            self.last_request_time = current_time
    
    def clear_existing_tags(self):
        """Clear all existing tags and role classifications"""
        logger.info("🧹 CLEARING ALL EXISTING TAGS AND CLASSIFICATIONS...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Clear existing classification fields
        cursor.execute("""
            UPDATE internships SET
                types = NULL,
                tags = NULL,
                position_type = NULL,
                role_primary = NULL,
                role_categories = NULL,
                additional_tags = NULL,
                skills = NULL,
                confidence_score = NULL,
                industry_sector = NULL,
                experience_level = NULL,
                last_classified = NULL
        """)
        
        conn.commit()
        
        # Get count of cleared records
        cursor.execute("SELECT COUNT(*) FROM internships")
        total_count = cursor.fetchone()[0]
        
        conn.close()
        
        logger.info(f"✅ CLEARED {total_count} records - ready for fresh classification!")
        return total_count
    
    def upgrade_database_schema(self):
        """Add new enhanced tagging fields if they don't exist"""
        logger.info("🔧 Upgrading database schema...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get existing columns
        cursor.execute("PRAGMA table_info(internships)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        
        # Add new columns for enhanced classification
        new_columns = [
            ('position_type', 'TEXT'),           # internship, co_op, student_program, etc.
            ('role_primary', 'TEXT'),            # Primary role category
            ('role_categories', 'TEXT'),         # JSON array of all role categories
            ('term_periods', 'TEXT'),            # JSON array of term periods
            ('additional_tags', 'TEXT'),         # JSON array of additional tags
            ('skills', 'TEXT'),                  # JSON array of technical skills
            ('confidence_score', 'INTEGER'),     # Classification confidence (0-100)
            ('industry_sector', 'TEXT'),         # Industry classification
            ('experience_level', 'TEXT'),        # entry, intermediate, advanced
            ('last_classified', 'DATE')          # When classification was done
        ]
        
        for column_name, column_type in new_columns:
            if column_name not in existing_columns:
                try:
                    cursor.execute(f"ALTER TABLE internships ADD COLUMN {column_name} {column_type}")
                    logger.info(f"✅ Added column: {column_name}")
                except sqlite3.OperationalError as e:
                    logger.warning(f"⚠️ Column {column_name} might already exist: {e}")
        
        conn.commit()
        conn.close()
        logger.info("✅ Database schema upgraded!")
    
    def classify_position(self, title: str, company: str, location: str, description: str) -> BroadClassification:
        """Classify a single position using the broader system"""
        
        # Rate limit API calls
        self.rate_limit()
        
        prompt = BROADER_CLASSIFICATION_PROMPT.format(
            title=title, 
            company=company, 
            location=location, 
            description=description[:2000]
        )
        
        try:
            response = self.model.generate_content(prompt)
            result = json.loads(response.text)
            
            return BroadClassification(
                position_type=result.get('position_type', 'internship'),
                role_categories=result.get('role_categories', []),
                term_periods=result.get('term_periods', []),
                additional_tags=result.get('additional_tags', []),
                skills=result.get('skills', []),
                confidence_score=result.get('confidence_score', 50),
                is_student_position=result.get('is_student_position', True)
            )
            
        except Exception as e:
            logger.error(f"LLM error for '{title}': {e}")
            return self.fallback_classification(title, description)
    
    def fallback_classification(self, title: str, description: str) -> BroadClassification:
        """Fallback classification using keyword matching"""
        text = f"{title} {description}".lower()
        
        # Basic position type detection
        position_type = 'internship'
        if any(word in text for word in ['co-op', 'coop', 'cooperative']):
            position_type = 'co_op'
        elif any(word in text for word in ['new grad', 'graduate program']):
            position_type = 'student_program'
        
        # Basic role categorization
        role_categories = []
        
        # Check all taxonomy categories
        for domain, categories in BROADER_ROLE_TAXONOMY.items():
            if domain == 'position_types':
                continue
            for category, keywords in categories.items():
                if any(keyword.lower() in text for keyword in keywords):
                    role_categories.append(category)
        
        # If no specific category found, use general categories
        if not role_categories:
            if any(word in text for word in ['engineer', 'engineering']):
                role_categories.append('general_engineering')
            elif any(word in text for word in ['tech', 'software', 'data']):
                role_categories.append('general_technology')
            elif any(word in text for word in ['business', 'analyst']):
                role_categories.append('general_business')
            else:
                role_categories.append('general_other')
        
        # Basic term period detection
        term_periods = []
        for period_type, periods in TERM_PERIODS.items():
            for period, keywords in periods.items():
                if any(keyword in text for keyword in keywords):
                    term_periods.append(period)
        
        return BroadClassification(
            position_type=position_type,
            role_categories=role_categories,
            term_periods=term_periods,
            additional_tags=['entry_level'],
            skills=[],
            confidence_score=70,
            is_student_position=True
        )
    
    def reclassify_all_records(self, batch_size: int = 50):
        """Reclassify ALL records in the database"""
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all records
        cursor.execute("SELECT COUNT(*) FROM internships")
        total_count = cursor.fetchone()[0]
        
        logger.info(f"🚀 Starting broader classification of {total_count} records...")
        
        processed = 0
        
        # Process in batches
        offset = 0
        while offset < total_count:
            cursor.execute("""
                SELECT id, title, company_name, location, description 
                FROM internships 
                LIMIT ? OFFSET ?
            """, (batch_size, offset))
            
            batch = cursor.fetchall()
            if not batch:
                break
            
            for record in batch:
                record_id, title, company, location, description = record
                
                # Classify the position
                classification = self.classify_position(
                    title or '', 
                    company or '', 
                    location or '', 
                    description or ''
                )
                
                # Determine primary role
                role_primary = classification.role_categories[0] if classification.role_categories else 'general_other'
                
                # Update database
                cursor.execute("""
                    UPDATE internships SET
                        position_type = ?,
                        role_primary = ?,
                        role_categories = ?,
                        term_periods = ?,
                        additional_tags = ?,
                        skills = ?,
                        confidence_score = ?,
                        types = ?,
                        tags = ?,
                        last_classified = ?
                    WHERE id = ?
                """, (
                    classification.position_type,
                    role_primary,
                    json.dumps(classification.role_categories),
                    json.dumps(classification.term_periods),
                    json.dumps(classification.additional_tags),
                    json.dumps(classification.skills),
                    classification.confidence_score,
                    json.dumps(classification.role_categories),  # For backward compatibility
                    json.dumps(classification.role_categories + classification.term_periods + classification.additional_tags),  # Combined tags
                    datetime.now().strftime('%Y-%m-%d'),
                    record_id
                ))
                
                processed += 1
                
                if processed % 10 == 0:
                    conn.commit()
                    logger.info(f"✅ Processed {processed}/{total_count} records ({processed/total_count*100:.1f}%)")
            
            offset += batch_size
        
        conn.commit()
        conn.close()
        
        logger.info(f"🎉 BROADER CLASSIFICATION COMPLETE! Processed {processed} records")
        return processed
    
    def generate_classification_report(self):
        """Generate a report on the new classification results"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        print("\n" + "="*60)
        print("🎉 BROADER CLASSIFICATION RESULTS REPORT")
        print("="*60)
        
        # Total records
        cursor.execute("SELECT COUNT(*) FROM internships")
        total = cursor.fetchone()[0]
        print(f"Total records classified: {total}")
        
        # Position types
        print("\n📊 POSITION TYPES:")
        cursor.execute("""
            SELECT position_type, COUNT(*) as count 
            FROM internships 
            WHERE position_type IS NOT NULL 
            GROUP BY position_type 
            ORDER BY count DESC
        """)
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} ({row[1]/total*100:.1f}%)")
        
        # Top role categories
        print("\n🏷️ TOP ROLE CATEGORIES:")
        cursor.execute("""
            SELECT role_primary, COUNT(*) as count 
            FROM internships 
            WHERE role_primary IS NOT NULL 
            GROUP BY role_primary 
            ORDER BY count DESC 
            LIMIT 15
        """)
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} ({row[1]/total*100:.1f}%)")
        
        # Term periods
        print("\n📅 TERM PERIODS DETECTED:")
        cursor.execute("SELECT term_periods FROM internships WHERE term_periods IS NOT NULL AND term_periods != '[]'")
        term_counts = {}
        for row in cursor.fetchall():
            try:
                periods = json.loads(row[0])
                for period in periods:
                    term_counts[period] = term_counts.get(period, 0) + 1
            except:
                pass
        
        for term, count in sorted(term_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {term}: {count}")
        
        # Coverage stats
        cursor.execute("SELECT COUNT(*) FROM internships WHERE role_categories IS NOT NULL AND role_categories != '[]'")
        classified = cursor.fetchone()[0]
        coverage = (classified / total * 100) if total > 0 else 0
        
        print(f"\n✅ CLASSIFICATION COVERAGE: {coverage:.1f}% ({classified}/{total})")
        
        # Confidence scores
        cursor.execute("SELECT AVG(confidence_score) FROM internships WHERE confidence_score IS NOT NULL")
        avg_confidence = cursor.fetchone()[0] or 0
        print(f"📈 AVERAGE CONFIDENCE SCORE: {avg_confidence:.1f}/100")
        
        conn.close()

def main():
    """Main function to run the ultimate broad classifier"""
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        logger.error("❌ GEMINI_API_KEY environment variable not set")
        print("Please set your Gemini API key: export GEMINI_API_KEY='your-key-here'")
        return
    
    # Initialize classifier
    classifier = UltimateBroadClassifier(api_key)
    
    print("🚀 ULTIMATE BROADER CLASSIFICATION SYSTEM")
    print("="*50)
    print("This will:")
    print("1. Clear ALL existing tags and classifications")
    print("2. Upgrade database schema") 
    print("3. Reclassify ALL records with broader categories")
    print("4. Add term period classification (Summer 2025, Co-op, etc.)")
    print("5. Generate comprehensive report")
    print()
    
    confirm = input("⚠️ This will CLEAR all existing tags. Continue? (yes/no): ")
    if confirm.lower() != 'yes':
        print("❌ Operation cancelled")
        return
    
    try:
        # Step 1: Upgrade schema
        classifier.upgrade_database_schema()
        
        # Step 2: Clear existing data
        cleared_count = classifier.clear_existing_tags()
        
        # Step 3: Reclassify everything
        processed_count = classifier.reclassify_all_records()
        
        # Step 4: Generate report
        classifier.generate_classification_report()
        
        print("\n🎉 ULTIMATE BROADER CLASSIFICATION COMPLETE!")
        print(f"✅ Cleared: {cleared_count} records")
        print(f"✅ Reclassified: {processed_count} records")
        print("✅ Added term period classification")
        print("✅ Broader role categories implemented")
        
    except Exception as e:
        logger.error(f"❌ Error during classification: {e}")
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main() 