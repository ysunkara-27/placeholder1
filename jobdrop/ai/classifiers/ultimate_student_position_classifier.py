#!/usr/bin/env python3
"""
Ultimate Student Position Classifier
====================================

This system uses LLM to properly classify student positions and filter out 
regular full-time jobs that shouldn't be in an internship database.

Features:
- Filters out non-student positions (managers, supervisors, regular full-time roles)
- Classifies into preset parent/child categories
- Uses LLM for accurate classification
- Handles edge cases and provides confidence scores
"""

import os
import sqlite3
import json
import logging
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import google.generativeai as genai

class UltimateStudentClassifier:
    def __init__(self, db_path="backend/internships.db"):
        self.db_path = db_path
        self.setup_logging()
        self.setup_gemini()
        
        # Preset classification categories
        self.PARENT_CATEGORIES = {
            'engineering': {
                'name': 'Engineering & Technology',
                'children': [
                    'software_engineering', 'data_engineering', 'machine_learning',
                    'cybersecurity', 'cloud_computing', 'mobile_development',
                    'web_development', 'devops', 'qa_testing'
                ]
            },
            'traditional_engineering': {
                'name': 'Traditional Engineering',
                'children': [
                    'mechanical_engineering', 'electrical_engineering', 'civil_engineering',
                    'chemical_engineering', 'aerospace_engineering', 'industrial_engineering',
                    'biomedical_engineering', 'environmental_engineering'
                ]
            },
            'business': {
                'name': 'Business & Operations',
                'children': [
                    'business_analyst', 'project_management', 'operations',
                    'supply_chain', 'consulting', 'strategy', 'business_development'
                ]
            },
            'finance': {
                'name': 'Finance & Investment',
                'children': [
                    'investment_banking', 'asset_management', 'financial_analysis',
                    'risk_management', 'trading', 'private_equity', 'venture_capital'
                ]
            },
            'data_science': {
                'name': 'Data Science & Analytics',
                'children': [
                    'data_science', 'data_analysis', 'business_intelligence',
                    'quantitative_research', 'actuarial', 'statistics'
                ]
            },
            'marketing': {
                'name': 'Marketing & Communications',
                'children': [
                    'digital_marketing', 'content_marketing', 'social_media',
                    'brand_marketing', 'public_relations', 'communications'
                ]
            },
            'design': {
                'name': 'Design & Creative',
                'children': [
                    'ux_ui_design', 'graphic_design', 'product_design',
                    'industrial_design', 'architecture'
                ]
            },
            'research': {
                'name': 'Research & Development',
                'children': [
                    'research_development', 'lab_research', 'clinical_research',
                    'market_research', 'academic_research'
                ]
            },
            'legal': {
                'name': 'Legal & Compliance',
                'children': [
                    'legal', 'compliance', 'regulatory_affairs', 'intellectual_property'
                ]
            },
            'healthcare': {
                'name': 'Healthcare & Life Sciences',
                'children': [
                    'clinical', 'pharmaceutical', 'biotechnology', 'medical_devices', 'nursing'
                ]
            },
            'sales': {
                'name': 'Sales & Customer Success',
                'children': [
                    'sales', 'account_management', 'customer_success', 'business_development'
                ]
            },
            'human_resources': {
                'name': 'Human Resources',
                'children': [
                    'hr_generalist', 'talent_acquisition', 'learning_development', 'compensation'
                ]
            }
        }
        
        # Position types for student positions
        self.VALID_POSITION_TYPES = [
            'internship', 'co_op', 'new_graduate', 'trainee_program', 
            'fellowship', 'apprenticeship', 'entry_level'
        ]
        
        # Work arrangements
        self.WORK_ARRANGEMENTS = ['remote', 'hybrid', 'onsite']
        
        # Education levels
        self.EDUCATION_LEVELS = ['undergraduate', 'graduate', 'phd', 'any']

    def setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('classification.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)

    def setup_gemini(self):
        """Setup Gemini API for LLM classification"""
        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self.use_llm = True
            self.logger.info("✅ Gemini API configured for LLM classification")
        else:
            self.use_llm = False
            self.logger.warning("⚠️ No Gemini API key found, will use rule-based only")

    def is_student_position(self, title: str, description: str) -> Tuple[bool, str, int]:
        """
        Determine if this is actually a student position or a regular full-time job
        Returns: (is_student_position, reasoning, confidence_score)
        """
        title_lower = title.lower()
        desc_lower = description.lower()
        
        # First, check for clear student position indicators in title
        if any(term in title_lower for term in ['intern', 'co-op', 'co op', 'trainee', 'student']):
            # If it's clearly an internship in the title, we need very strong evidence to exclude it
            strong_exclusions_title_only = [
                r'^(manager|supervisor|director|senior|principal|lead|chief)',  # Only if title starts with these
                r'\b(vice president|vp|ceo|cto|cfo|coo)\b',  # Executive titles anywhere in title
            ]
            
            for pattern in strong_exclusions_title_only:
                if re.search(pattern, title_lower):
                    return False, f"Strong exclusion in title: {pattern}", 95
                    
            # If title contains student terms, it's very likely a student position
            return True, "Clear student position terms in title", 95
        
        # For titles without clear student terms, apply stricter filtering
        exclusion_patterns_title = [
            # Management positions in title
            r'\b(manager|supervisor|director|vice president|vp|head of|chief)\b',
            # Senior/Lead roles in title
            r'\b(senior|principal|staff|lead)\s+(engineer|developer|scientist|analyst)\b',
            # Executive roles
            r'\b(executive|president|ceo|cto|cfo|coo)\b',
        ]
        
        # Check title for exclusions
        for pattern in exclusion_patterns_title:
            if re.search(pattern, title_lower):
                return False, f"Management/Senior role in title: {pattern}", 90
        
        # Check description for very specific full-time indicators (not student-friendly terms)
        description_exclusions = [
            r'\b[3-9]\+?\s*years?\s+(of\s+)?(required\s+)?experience\b',
            r'\bminimum\s+[3-9]\s+years?\s+experience\b',
            r'\b10\+?\s*years?\s+experience\b',
            r'\bpermanent\s+position\b',
            r'\bfull.time\s+employee\b',
            r'\bcareer\s+opportunity\s+for\s+experienced\b',
            r'\bmanage\s+a\s+team\s+of\b',
            r'\bdirect\s+reports\s+required\b',
            r'\$\d{6,}\s*per\s*year\b',  # High salary ranges
            r'\$1\d{2},000\+\b'  # $100k+ salaries
        ]
        
        for pattern in description_exclusions:
            if re.search(pattern, desc_lower):
                return False, f"Full-time indicator in description: {pattern}", 85
        
        # Student position indicators
        student_indicators = [
            # Explicit student terms (highest weight)
            r'\b(intern|internship|co.?op|trainee|fellowship|apprentice)\b',
            r'\bstudent\b',
            r'\bentry.level\b',
            r'\bnew.grad(uate)?\b',
            r'\brecent.grad(uate)?\b',
            # Program indicators
            r'\brotation(al)?\s+program\b',
            r'\bgraduate\s+program\b',
            r'\btraining\s+program\b',
            r'\bsummer\s+20\d{2}\b',
            r'\b20\d{2}\s+(summer|fall|spring|winter)\b',
            r'\b(fall|spring|summer|winter)\s+20\d{2}\b',
            # Duration indicators (temporary nature)
            r'\b\d+\s+(week|month)\s+(internship|program|position)\b',
            r'\btemporary\b',
            r'\b\d+\s*-\s*\d+\s+months?\b',
            # Education requirements
            r'\bcurrently\s+enrolled\b',
            r'\bpursuing\s+(bachelor|master|phd|degree)\b',
            r'\bgraduation\s+date\b',
            r'\buniversity\s+(recruiting|hire|student)\b',
            r'\bcampus\s+(recruiting|hire)\b',
            r'\bstudent\s+(position|role|opportunity)\b',
            # Academic terms
            r'\b(undergraduate|graduate|phd|masters?)\s+(student|program)\b',
            r'\bworking\s+student\b',
            r'\bwerkstudent\b'  # German term for working student
        ]
        
        student_score = 0
        matched_indicators = []
        
        for indicator in student_indicators:
            if re.search(indicator, title_lower):
                student_score += 20
                matched_indicators.append(f"title: {indicator}")
            if re.search(indicator, desc_lower):
                student_score += 10
                matched_indicators.append(f"desc: {indicator}")
        
        if student_score >= 20:
            return True, f"Student position indicators: {', '.join(matched_indicators)}", min(95, student_score)
        else:
            return False, "No clear student position indicators found", 30

    def classify_with_llm(self, title: str, description: str, company: str) -> Optional[Dict]:
        """Use LLM to classify the position"""
        if not self.use_llm:
            return None
            
        try:
            # Create the classification prompt
            categories_text = "\n".join([
                f"{parent}: {data['name']} -> {', '.join(data['children'])}" 
                for parent, data in self.PARENT_CATEGORIES.items()
            ])
            
            prompt = f"""
Classify this student position into the most appropriate category:

TITLE: {title}
COMPANY: {company}
DESCRIPTION: {description[:1000]}...

AVAILABLE CATEGORIES:
{categories_text}

WORK ARRANGEMENTS: {', '.join(self.WORK_ARRANGEMENTS)}
EDUCATION LEVELS: {', '.join(self.EDUCATION_LEVELS)}

Return ONLY a JSON object with this exact structure:
{{
    "parent_category": "one of the parent categories",
    "primary_category": "one of the child categories",
    "work_arrangement": "remote/hybrid/onsite",
    "education_level": "undergraduate/graduate/phd/any",
    "confidence_score": 85,
    "reasoning": "Brief explanation for classification",
    "keywords_matched": ["key", "words", "that", "influenced", "decision"]
}}

Focus on the primary job function, not secondary skills mentioned.
"""
            
            response = self.model.generate_content(prompt)
            
            # Parse JSON from response
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                # Validate the response
                if (result.get('parent_category') in self.PARENT_CATEGORIES and
                    result.get('primary_category') in 
                    self.PARENT_CATEGORIES[result['parent_category']]['children']):
                    return result
            
            self.logger.warning(f"Invalid LLM response for: {title}")
            return None
            
        except Exception as e:
            self.logger.error(f"LLM classification error for '{title}': {e}")
            return None

    def classify_with_rules(self, title: str, description: str) -> Dict:
        """Fallback rule-based classification"""
        title_lower = title.lower()
        desc_lower = (description or '').lower()
        full_text = f"{title_lower} {desc_lower}"
        
        # Engineering patterns
        if any(term in full_text for term in ['software', 'python', 'java', 'javascript', 'react', 'backend', 'frontend', 'fullstack']):
            return {
                'parent_category': 'engineering',
                'primary_category': 'software_engineering',
                'work_arrangement': 'hybrid',
                'education_level': 'undergraduate',
                'confidence_score': 75,
                'reasoning': 'Software engineering keywords detected',
                'keywords_matched': ['software', 'engineering']
            }
        elif any(term in full_text for term in ['data science', 'machine learning', 'ai', 'analytics', 'python', 'sql']):
            return {
                'parent_category': 'data_science',
                'primary_category': 'data_science',
                'work_arrangement': 'hybrid',
                'education_level': 'undergraduate',
                'confidence_score': 75,
                'reasoning': 'Data science keywords detected',
                'keywords_matched': ['data', 'analytics']
            }
        elif any(term in full_text for term in ['mechanical', 'electrical', 'civil', 'chemical', 'aerospace']):
            return {
                'parent_category': 'traditional_engineering',
                'primary_category': 'mechanical_engineering',
                'work_arrangement': 'onsite',
                'education_level': 'undergraduate',
                'confidence_score': 70,
                'reasoning': 'Traditional engineering keywords detected',
                'keywords_matched': ['engineering']
            }
        elif any(term in full_text for term in ['finance', 'investment', 'banking', 'trading', 'analyst']):
            return {
                'parent_category': 'finance',
                'primary_category': 'financial_analysis',
                'work_arrangement': 'onsite',
                'education_level': 'undergraduate',
                'confidence_score': 70,
                'reasoning': 'Finance keywords detected',
                'keywords_matched': ['finance']
            }
        elif any(term in full_text for term in ['marketing', 'brand', 'social media', 'content']):
            return {
                'parent_category': 'marketing',
                'primary_category': 'digital_marketing',
                'work_arrangement': 'hybrid',
                'education_level': 'undergraduate',
                'confidence_score': 70,
                'reasoning': 'Marketing keywords detected',
                'keywords_matched': ['marketing']
            }
        else:
            return {
                'parent_category': 'business',
                'primary_category': 'business_analyst',
                'work_arrangement': 'hybrid',
                'education_level': 'undergraduate',
                'confidence_score': 40,
                'reasoning': 'Default business classification',
                'keywords_matched': []
            }

    def create_tags(self, classification: Dict, position_type: str = 'internship') -> List[str]:
        """Create clean, useful tags from classification"""
        tags = []
        
        # Add primary classification tags
        tags.append(classification['primary_category'])
        tags.append(classification['parent_category'])
        
        # Add arrangement and education
        tags.append(classification['work_arrangement'])
        tags.append(classification['education_level'])
        
        # Add position type
        tags.append(position_type)
        
        # Limit to 5 most important tags
        return tags[:5]

    def classify_position(self, job_data: Dict) -> Optional[Dict]:
        """Main classification function"""
        title = job_data.get('title', '')
        description = job_data.get('description', '') or job_data.get('snippet', '')
        company = job_data.get('company_name', '')
        
        # First, check if this is actually a student position
        is_student, student_reasoning, student_confidence = self.is_student_position(title, description)
        
        if not is_student:
            self.logger.info(f"❌ Filtering out non-student position: {title} - {student_reasoning}")
            return None  # This indicates the job should be removed
        
        # Try LLM classification first
        classification = None
        if self.use_llm:
            classification = self.classify_with_llm(title, description, company)
        
        # Fallback to rule-based if LLM fails
        if not classification:
            classification = self.classify_with_rules(title, description)
        
        # Create clean tags
        tags = self.create_tags(classification)
        
        # Return complete classification
        return {
            'primary_category': classification['primary_category'],
            'parent_category': classification['parent_category'],
            'work_arrangement': classification['work_arrangement'],
            'education_level': classification['education_level'],
            'tags': tags,
            'confidence_score': classification['confidence_score'],
            'reasoning': classification['reasoning'],
            'keywords_matched': classification.get('keywords_matched', []),
            'is_student_position': True,
            'student_position_confidence': student_confidence,
            'student_position_reasoning': student_reasoning
        }

    def process_database(self, test_mode: bool = False, batch_size: int = 50):
        """Process all jobs in the database"""
        self.logger.info("🚀 Starting ultimate student position classification")
        
        if test_mode:
            self.logger.info("🧪 Running in TEST mode")
            
        # Connect to database
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            # Get all jobs
            limit_clause = "LIMIT 100" if test_mode else ""
            cursor.execute(f"SELECT * FROM internships {limit_clause}")
            jobs = cursor.fetchall()
            
            self.logger.info(f"📊 Processing {len(jobs)} jobs")
            
            processed = 0
            filtered_out = 0
            classification_errors = 0
            
            for i in range(0, len(jobs), batch_size):
                batch = jobs[i:i + batch_size]
                self.logger.info(f"📋 Processing batch {i // batch_size + 1} ({len(batch)} jobs)")
                
                for job in batch:
                    try:
                        # Convert Row to dict
                        job_dict = dict(job)
                        
                        # Classify the position
                        classification = self.classify_position(job_dict)
                        
                        if classification is None:
                            # This job should be filtered out
                            if not test_mode:
                                cursor.execute("DELETE FROM internships WHERE id = ?", (job['id'],))
                            filtered_out += 1
                            self.logger.info(f"🗑️ Filtered out: {job['title']}")
                            continue
                        
                        # Update the job with new classification
                        if not test_mode:
                            cursor.execute("""
                                UPDATE internships SET
                                    tags = ?,
                                    role_categories = ?,
                                    parent_category = ?,
                                    work_arrangement = ?,
                                    education_level = ?,
                                    confidence_score = ?,
                                    classification_reasoning = ?,
                                    last_classified = ?
                                WHERE id = ?
                            """, (
                                json.dumps(classification['tags']),
                                json.dumps([classification['primary_category']]),
                                classification['parent_category'],
                                classification['work_arrangement'],
                                classification['education_level'],
                                classification['confidence_score'],
                                classification['reasoning'],
                                datetime.now().date().isoformat(),
                                job['id']
                            ))
                        
                        processed += 1
                        
                        if processed % 10 == 0:
                            self.logger.info(f"✅ Processed {processed} jobs, filtered out {filtered_out}")
                            
                    except Exception as e:
                        classification_errors += 1
                        self.logger.error(f"❌ Error processing job {job.get('id', 'unknown')}: {e}")
                        continue
                
                # Commit batch
                if not test_mode:
                    conn.commit()
            
            # Final statistics
            self.logger.info(f"""
╭─────────────────────────────────╮
│ 🎯 Classification Complete      │
╰─────────────────────────────────╯
✅ Successfully processed: {processed}
🗑️ Filtered out non-student jobs: {filtered_out}
❌ Classification errors: {classification_errors}
📊 Total jobs remaining: {processed}
            """)
            
        finally:
            conn.close()

if __name__ == "__main__":
    import sys
    
    classifier = UltimateStudentClassifier()
    
    # Check command line arguments
    test_mode = '--test' in sys.argv
    
    # Process the database
    classifier.process_database(test_mode=test_mode) 