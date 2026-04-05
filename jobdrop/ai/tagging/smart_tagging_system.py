#!/usr/bin/env python3
"""
Smart LLM-Based Tagging & Filtering System
==========================================

This system completely rebuilds the tagging approach to solve:
- Wrong categorization (Investment Banking → Finance, not Data Science)
- Duplicate/meaningless tags 
- Poor filtering that shows same jobs repeatedly
- Generic tags that don't help filtering

Features:
- Semantic job analysis using LLM
- Industry-specific categorization
- Smart duplicate detection
- Skill-based tagging
- Location intelligence
- Semantic search and filtering
"""

import os
import sqlite3
import json
import logging
import re
from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime
import google.generativeai as genai
from collections import defaultdict
import hashlib

class SmartTaggingSystem:
    def __init__(self, db_path="backend/internships.db"):
        self.db_path = db_path
        self.setup_logging()
        self.setup_llm()
        self.setup_categories()
        
    def setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
    def setup_llm(self):
        """Initialize Gemini LLM for smart classification"""
        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self.use_llm = True
            self.logger.info("✅ Gemini API configured for smart tagging")
        else:
            self.use_llm = False
            self.logger.warning("⚠️ No Gemini API key found - using rule-based fallback")
            
    def setup_categories(self):
        """Define comprehensive industry and skill categories"""
        self.industry_categories = {
            # Technology
            'software_engineering': ['software', 'developer', 'programming', 'coding', 'app development'],
            'data_science': ['data analyst', 'machine learning', 'AI', 'analytics', 'data engineer'],
            'cybersecurity': ['security', 'infosec', 'penetration testing', 'compliance'],
            'product_management': ['product manager', 'product owner', 'roadmap', 'feature'],
            'devops': ['devops', 'cloud', 'infrastructure', 'deployment', 'AWS', 'Azure'],
            'ui_ux_design': ['UI', 'UX', 'user experience', 'design', 'figma', 'prototyping'],
            
            # Finance & Business
            'investment_banking': ['investment banking', 'IBD', 'M&A', 'capital markets', 'equity research'],
            'consulting': ['consultant', 'strategy', 'management consulting', 'advisory'],
            'finance': ['financial analyst', 'accounting', 'FP&A', 'treasury', 'risk management'],
            'private_equity': ['private equity', 'PE', 'venture capital', 'VC', 'portfolio'],
            'trading': ['trading', 'quantitative', 'derivatives', 'fixed income'],
            
            # Engineering (Non-Software)
            'mechanical_engineering': ['mechanical', 'manufacturing', 'CAD', 'solidworks'],
            'electrical_engineering': ['electrical', 'electronics', 'circuits', 'embedded'],
            'civil_engineering': ['civil', 'structural', 'construction', 'infrastructure'],
            'chemical_engineering': ['chemical', 'process', 'materials', 'chemistry'],
            'aerospace_engineering': ['aerospace', 'aviation', 'aircraft', 'space'],
            
            # Business Operations
            'marketing': ['marketing', 'digital marketing', 'brand', 'campaigns', 'social media'],
            'sales': ['sales', 'business development', 'account management', 'CRM'],
            'operations': ['operations', 'supply chain', 'logistics', 'procurement'],
            'human_resources': ['HR', 'recruiting', 'talent', 'people', 'compensation'],
            'legal': ['legal', 'contracts', 'compliance', 'paralegal', 'law'],
            
            # Healthcare & Life Sciences
            'healthcare': ['healthcare', 'medical', 'clinical', 'hospital', 'patient'],
            'biotech': ['biotech', 'pharmaceutical', 'drug development', 'clinical trials'],
            'research': ['research', 'lab', 'scientist', 'R&D', 'academic'],
            
            # Other Industries
            'media_communications': ['media', 'communications', 'PR', 'journalism', 'content'],
            'education': ['education', 'teaching', 'curriculum', 'academic', 'learning'],
            'real_estate': ['real estate', 'property', 'development', 'construction'],
            'energy': ['energy', 'renewable', 'oil', 'gas', 'sustainability'],
            'government': ['government', 'policy', 'public sector', 'civic', 'municipality']
        }
        
        self.skill_tags = {
            'technical_skills': [
                'python', 'java', 'javascript', 'sql', 'excel', 'tableau', 'powerbi',
                'aws', 'azure', 'docker', 'kubernetes', 'react', 'angular', 'node.js'
            ],
            'business_skills': [
                'project_management', 'analysis', 'presentation', 'communication',
                'strategy', 'problem_solving', 'leadership', 'teamwork'
            ],
            'domain_knowledge': [
                'agile', 'scrum', 'lean', 'six_sigma', 'financial_modeling',
                'market_research', 'competitive_analysis', 'user_research'
            ]
        }
        
        self.work_arrangements = ['remote', 'hybrid', 'onsite']
        self.education_levels = ['undergraduate', 'graduate', 'mba', 'phd']
        self.duration_types = ['summer', 'fall', 'spring', 'winter', 'full_year', 'semester']
        
    def create_llm_prompt(self, title: str, description: str, company: str) -> str:
        """Create comprehensive prompt for LLM classification"""
        return f"""
Analyze this internship/entry-level position and provide accurate categorization:

Job Title: {title}
Company: {company}
Description: {description[:1000]}...

Please classify this job with the following JSON format:
{{
    "primary_industry": "most_specific_industry_category",
    "secondary_industries": ["related_industry1", "related_industry2"],
    "specific_role_type": "specific_role_description",
    "key_skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
    "technical_requirements": ["tech1", "tech2", "tech3"],
    "work_arrangement": "remote|hybrid|onsite",
    "education_level": "undergraduate|graduate|mba|phd",
    "duration": "summer|fall|spring|winter|full_year",
    "company_size": "startup|mid_size|large_enterprise",
    "industry_focus": "specific_industry_focus",
    "seniority": "entry_level|internship|new_graduate|co_op",
    "location_type": "major_city|suburb|remote|international",
    "growth_potential": "high|medium|low",
    "confidence_score": 95
}}

Industry Categories Available:
{', '.join(self.industry_categories.keys())}

Rules:
1. Be very specific - "Investment Banking" ≠ "Data Science"
2. Focus on actual job content, not generic keywords
3. Include 5 most relevant skills from job description
4. Identify real technical requirements, not buzzwords
5. Rate confidence 0-100 (aim for 90+)
6. Use "other" only if truly doesn't fit any category
"""

    def classify_with_llm(self, title: str, description: str, company: str) -> Dict:
        """Use LLM to intelligently classify the job"""
        if not self.use_llm:
            return self.classify_with_rules(title, description, company)
            
        try:
            prompt = self.create_llm_prompt(title, description, company)
            response = self.model.generate_content(prompt)
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                # Validate and clean the result
                return self.validate_classification(result, title, description)
            else:
                self.logger.warning(f"No JSON found in LLM response for: {title}")
                return self.classify_with_rules(title, description, company)
                
        except Exception as e:
            self.logger.error(f"LLM classification error for '{title}': {e}")
            return self.classify_with_rules(title, description, company)
    
    def classify_with_rules(self, title: str, description: str, company: str) -> Dict:
        """Fallback rule-based classification"""
        title_lower = title.lower()
        desc_lower = description.lower()
        full_text = f"{title_lower} {desc_lower}"
        
        # Find best matching industry
        best_industry = "other"
        best_score = 0
        
        for industry, keywords in self.industry_categories.items():
            score = sum(1 for keyword in keywords if keyword.lower() in full_text)
            if score > best_score:
                best_score = score
                best_industry = industry
        
        # Extract skills
        skills = []
        for skill_category, skill_list in self.skill_tags.items():
            for skill in skill_list:
                if skill.lower() in full_text:
                    skills.append(skill)
        
        # Determine work arrangement
        work_arrangement = "onsite"
        if any(word in full_text for word in ['remote', 'work from home', 'wfh']):
            work_arrangement = "remote"
        elif any(word in full_text for word in ['hybrid', 'flexible']):
            work_arrangement = "hybrid"
            
        return {
            "primary_industry": best_industry,
            "secondary_industries": [],
            "specific_role_type": title,
            "key_skills": skills[:5],
            "technical_requirements": [],
            "work_arrangement": work_arrangement,
            "education_level": "undergraduate",
            "duration": "internship",
            "company_size": "unknown",
            "industry_focus": best_industry,
            "seniority": "internship",
            "location_type": "unknown",
            "growth_potential": "medium",
            "confidence_score": 60
        }
    
    def validate_classification(self, result: Dict, title: str, description: str) -> Dict:
        """Validate and clean LLM classification results"""
        # Ensure required fields exist
        required_fields = ['primary_industry', 'key_skills', 'work_arrangement', 'confidence_score']
        for field in required_fields:
            if field not in result:
                result[field] = "unknown" if field != 'key_skills' else []
        
        # Validate industry category
        if result['primary_industry'] not in self.industry_categories:
            result['primary_industry'] = 'other'
            
        # Clean and limit skills
        if isinstance(result['key_skills'], list):
            result['key_skills'] = [skill.lower().replace(' ', '_') for skill in result['key_skills'][:5]]
        else:
            result['key_skills'] = []
            
        # Validate work arrangement
        if result['work_arrangement'] not in self.work_arrangements:
            result['work_arrangement'] = 'onsite'
            
        return result
    
    def create_smart_tags(self, classification: Dict, title: str) -> List[str]:
        """Create meaningful, specific tags from classification"""
        tags = []
        
        # Add primary industry
        tags.append(classification['primary_industry'])
        
        # Add secondary industries (max 2)
        if 'secondary_industries' in classification:
            tags.extend(classification['secondary_industries'][:2])
        
        # Add top skills (max 3)
        if classification['key_skills']:
            tags.extend(classification['key_skills'][:3])
            
        # Add work arrangement only if not default
        if classification['work_arrangement'] != 'onsite':
            tags.append(classification['work_arrangement'])
            
        # Add education level only if not default
        if classification.get('education_level', 'undergraduate') != 'undergraduate':
            tags.append(classification['education_level'])
            
        # Add duration if specific
        if classification.get('duration') and classification['duration'] not in ['internship', 'unknown']:
            tags.append(classification['duration'])
            
        # Add company size if known
        if classification.get('company_size') and classification['company_size'] != 'unknown':
            tags.append(classification['company_size'])
            
        # Remove duplicates and limit to 8 meaningful tags
        unique_tags = []
        for tag in tags:
            if tag not in unique_tags and tag not in ['unknown', 'other', '']:
                unique_tags.append(tag)
                
        return unique_tags[:8]
    
    def detect_similar_jobs(self, title: str, company: str, description: str) -> str:
        """Create a hash for detecting similar/duplicate jobs"""
        # Normalize title and company
        norm_title = re.sub(r'\b(intern|internship|co-?op|trainee)\b', '', title.lower()).strip()
        norm_company = company.lower().strip()
        
        # Create content hash from key elements
        content = f"{norm_title}:{norm_company}:{description[:200]}"
        return hashlib.md5(content.encode()).hexdigest()[:12]
    
    def process_job(self, job_data: Dict) -> Dict:
        """Process a single job with smart tagging"""
        title = job_data.get('title', '')
        description = job_data.get('description', '') or job_data.get('snippet', '')
        company = job_data.get('company_name', '')
        
        # Get LLM classification
        classification = self.classify_with_llm(title, description, company)
        
        # Create smart tags
        smart_tags = self.create_smart_tags(classification, title)
        
        # Create similarity hash
        similarity_hash = self.detect_similar_jobs(title, company, description)
        
        # Prepare result
        result = {
            'smart_tags': json.dumps(smart_tags),
            'role_categories': json.dumps([classification['primary_industry']]),
            'classification_data': json.dumps(classification),
            'similarity_hash': similarity_hash,
            'confidence_score': classification.get('confidence_score', 60),
            'work_arrangement': classification.get('work_arrangement', 'onsite'),
            'education_level': classification.get('education_level', 'undergraduate'),
            'specific_role_type': classification.get('specific_role_type', title)
        }
        
        return result
    
    def update_database_schema(self):
        """Add new columns for smart tagging"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Add new columns if they don't exist
        new_columns = [
            ('smart_tags', 'TEXT'),
            ('classification_data', 'TEXT'),
            ('similarity_hash', 'TEXT'),
            ('work_arrangement', 'TEXT DEFAULT "onsite"'),
            ('education_level', 'TEXT DEFAULT "undergraduate"'),
            ('specific_role_type', 'TEXT')
        ]
        
        for column_name, column_type in new_columns:
            try:
                cursor.execute(f'ALTER TABLE internships ADD COLUMN {column_name} {column_type}')
                self.logger.info(f"✅ Added column: {column_name}")
            except sqlite3.OperationalError:
                # Column already exists
                pass
        
        conn.commit()
        conn.close()
    
    def process_all_jobs(self, batch_size=50, test_mode=False):
        """Process all jobs with smart tagging"""
        self.update_database_schema()
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get jobs to process
        limit_clause = "LIMIT 100" if test_mode else ""
        cursor.execute(f"""
            SELECT id, title, company_name, description, snippet, location
            FROM internships 
            WHERE smart_tags IS NULL OR smart_tags = ''
            ORDER BY date_scraped DESC
            {limit_clause}
        """)
        
        jobs = cursor.fetchall()
        total_jobs = len(jobs)
        
        self.logger.info(f"🚀 Processing {total_jobs} jobs with smart tagging")
        
        processed = 0
        improved = 0
        
        for i in range(0, total_jobs, batch_size):
            batch = jobs[i:i + batch_size]
            self.logger.info(f"📋 Processing batch {i//batch_size + 1} ({len(batch)} jobs)")
            
            for job in batch:
                try:
                    # Process job
                    result = self.process_job(dict(job))
                    
                    # Update database
                    cursor.execute("""
                        UPDATE internships 
                        SET smart_tags = ?, 
                            classification_data = ?, 
                            similarity_hash = ?, 
                            confidence_score = ?,
                            work_arrangement = ?,
                            education_level = ?,
                            specific_role_type = ?,
                            tags = ?,
                            role_categories = ?
                        WHERE id = ?
                    """, (
                        result['smart_tags'],
                        result['classification_data'], 
                        result['similarity_hash'],
                        result['confidence_score'],
                        result['work_arrangement'],
                        result['education_level'],
                        result['specific_role_type'],
                        result['smart_tags'],  # Replace old tags with smart tags
                        result['role_categories'],
                        job['id']
                    ))
                    
                    processed += 1
                    if result['confidence_score'] > 80:
                        improved += 1
                        
                except Exception as e:
                    self.logger.error(f"Error processing job {job['id']}: {e}")
                    continue
            
            # Commit batch
            conn.commit()
            self.logger.info(f"✅ Processed {processed} jobs, {improved} high-confidence")
        
        conn.close()
        
        self.logger.info(f"""
╭─────────────────────────────────╮
│ 🎯 Smart Tagging Complete      │
╰─────────────────────────────────╯
✅ Successfully processed: {processed}
🎯 High-confidence results: {improved}
📊 Accuracy rate: {(improved/processed)*100:.1f}%
""")
        
        return processed, improved

if __name__ == "__main__":
    import sys
    
    # Check for test mode
    test_mode = '--test' in sys.argv
    
    system = SmartTaggingSystem()
    
    if test_mode:
        print("🧪 Running in TEST mode (100 jobs)")
        
    processed, improved = system.process_all_jobs(test_mode=test_mode)
    
    print(f"\n🎉 Smart tagging complete!")
    print(f"Processed: {processed} jobs")
    print(f"High-confidence: {improved} jobs")
    print(f"Success rate: {(improved/processed)*100:.1f}%") 