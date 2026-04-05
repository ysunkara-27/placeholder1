#!/usr/bin/env python3
"""
Enhanced Job Classification System
Fixes over-tagging and inaccurate classification issues in JobDrop
"""

import sqlite3
import json
import re
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Set
from collections import Counter
import google.generativeai as genai

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedJobClassifier:
    """Enhanced job classification with improved accuracy and reduced over-tagging"""
    
    def __init__(self, db_path: str = 'backend/internships.db'):
        self.db_path = db_path
        self.setup_gemini()
        
    def setup_gemini(self):
        """Setup Gemini API if available"""
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        if self.gemini_api_key:
            genai.configure(api_key=self.gemini_api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            logger.info("✅ Gemini API configured for enhanced classification")
        else:
            self.model = None
            logger.info("⚠️ No Gemini API key found, using rule-based classification only")
    
    def get_precise_job_categories(self) -> Dict[str, Dict]:
        """Define precise, non-overlapping job categories with strict matching rules"""
        return {
            # ENGINEERING - Very specific keywords
            'software_engineering': {
                'parent': 'engineering',
                'keywords': {
                    'title_required': ['software engineer', 'software developer', 'swe ', ' swe', 'full stack', 'backend', 'frontend', 'web developer', 'app developer'],
                    'title_optional': ['programming', 'coding', 'developer'],
                    'description': ['python', 'javascript', 'java', 'react', 'angular', 'node.js', 'api development', 'software development']
                },
                'exclude_keywords': ['mechanical', 'civil', 'electrical', 'chemical', 'hardware', 'manufacturing'],
                'min_score': 30
            },
            
            'data_science': {
                'parent': 'engineering', 
                'keywords': {
                    'title_required': ['data scientist', 'data science', 'machine learning', 'ml engineer', 'ai engineer', 'data engineer'],
                    'title_optional': ['analytics engineer', 'quantitative analyst'],
                    'description': ['python', 'sql', 'pandas', 'tensorflow', 'pytorch', 'machine learning', 'data analysis', 'modeling']
                },
                'exclude_keywords': ['marketing only', 'sales only'],
                'min_score': 35
            },
            
            'mechanical_engineering': {
                'parent': 'engineering',
                'keywords': {
                    'title_required': ['mechanical engineer', 'manufacturing engineer', 'design engineer', 'robotics engineer'],
                    'title_optional': ['product design', 'cad engineer'],
                    'description': ['solidworks', 'autocad', 'cad', 'manufacturing', 'mechanical design', 'thermodynamics']
                },
                'exclude_keywords': ['software', 'programming', 'web', 'app'],
                'min_score': 35
            },
            
            'electrical_engineering': {
                'parent': 'engineering',
                'keywords': {
                    'title_required': ['electrical engineer', 'electronics engineer', 'power engineer', 'rf engineer'],
                    'title_optional': ['circuit design', 'embedded engineer'],
                    'description': ['circuit', 'electrical', 'power systems', 'electronics', 'embedded systems']
                },
                'exclude_keywords': ['software only', 'web development'],
                'min_score': 35
            },
            
            'civil_engineering': {
                'parent': 'engineering',
                'keywords': {
                    'title_required': ['civil engineer', 'structural engineer', 'construction engineer'],
                    'title_optional': ['infrastructure engineer'],
                    'description': ['construction', 'structural', 'civil engineering', 'infrastructure']
                },
                'exclude_keywords': ['software', 'programming'],
                'min_score': 35
            },
            
            'chemical_engineering': {
                'parent': 'engineering',
                'keywords': {
                    'title_required': ['chemical engineer', 'process engineer'],
                    'title_optional': ['materials engineer'],
                    'description': ['chemical process', 'process engineering', 'chemical engineering']
                },
                'exclude_keywords': ['software', 'programming'],
                'min_score': 35
            },
            
            # BUSINESS & FINANCE - More precise categorization
            'investment_banking': {
                'parent': 'finance',
                'keywords': {
                    'title_required': ['investment banking', 'equity capital markets', 'debt capital markets', 'mergers acquisitions', 'm&a analyst'],
                    'title_optional': ['capital markets', 'corporate finance'],
                    'description': ['investment banking', 'capital markets', 'equity research', 'debt financing']
                },
                'exclude_keywords': ['software', 'engineering'],
                'min_score': 40
            },
            
            'consulting': {
                'parent': 'business',
                'keywords': {
                    'title_required': ['consultant', 'consulting', 'strategy consultant'],
                    'title_optional': ['business analyst', 'strategy analyst'],
                    'description': ['consulting', 'strategy', 'business consulting', 'management consulting']
                },
                'exclude_keywords': ['software development', 'programming'],
                'min_score': 30
            },
            
            'product_management': {
                'parent': 'business',
                'keywords': {
                    'title_required': ['product manager', 'product management', 'program manager'],
                    'title_optional': ['product owner'],
                    'description': ['product management', 'product strategy', 'roadmap', 'product development']
                },
                'exclude_keywords': ['software engineer', 'developer'],
                'min_score': 30
            },
            
            'marketing': {
                'parent': 'business',
                'keywords': {
                    'title_required': ['marketing', 'brand marketing', 'digital marketing', 'content marketing'],
                    'title_optional': ['communications', 'social media'],
                    'description': ['marketing', 'brand', 'campaigns', 'digital marketing']
                },
                'exclude_keywords': ['engineering', 'software development'],
                'min_score': 25
            },
            
            'business_analyst': {
                'parent': 'business',
                'keywords': {
                    'title_required': ['business analyst', 'data analyst', 'operations analyst'],
                    'title_optional': ['analyst'],
                    'description': ['business analysis', 'data analysis', 'requirements', 'process improvement']
                },
                'exclude_keywords': ['software engineer', 'developer'],
                'min_score': 25
            },
            
            'finance_general': {
                'parent': 'finance',
                'keywords': {
                    'title_required': ['financial analyst', 'finance', 'corporate finance', 'fp&a'],
                    'title_optional': ['accounting', 'treasury'],
                    'description': ['financial analysis', 'accounting', 'finance', 'budgeting']
                },
                'exclude_keywords': ['engineering', 'software'],
                'min_score': 25
            },
            
            # RESEARCH & SCIENCE
            'research_development': {
                'parent': 'research',
                'keywords': {
                    'title_required': ['research', 'r&d', 'research scientist', 'research engineer'],
                    'title_optional': ['lab', 'laboratory'],
                    'description': ['research', 'laboratory', 'scientific research', 'innovation']
                },
                'exclude_keywords': ['marketing research only'],
                'min_score': 30
            },
            
            # DESIGN & UX
            'design_ux': {
                'parent': 'design',
                'keywords': {
                    'title_required': ['ux designer', 'ui designer', 'product designer', 'graphic designer'],
                    'title_optional': ['visual designer', 'interaction designer'],
                    'description': ['design', 'user experience', 'user interface', 'visual design']
                },
                'exclude_keywords': ['engineering', 'software development'],
                'min_score': 30
            },
            
            # CYBERSECURITY
            'cybersecurity': {
                'parent': 'technology',
                'keywords': {
                    'title_required': ['cybersecurity', 'security analyst', 'information security', 'security engineer'],
                    'title_optional': ['risk analyst'],
                    'description': ['cybersecurity', 'security', 'risk management', 'compliance']
                },
                'exclude_keywords': [],
                'min_score': 30
            },
            
            # OPERATIONS
            'operations': {
                'parent': 'business',
                'keywords': {
                    'title_required': ['operations', 'supply chain', 'logistics', 'operations analyst'],
                    'title_optional': ['procurement'],
                    'description': ['operations', 'supply chain', 'logistics', 'process improvement']
                },
                'exclude_keywords': ['software', 'engineering design'],
                'min_score': 25
            },
            
            # HR - Very strict to avoid false positives
            'human_resources': {
                'parent': 'business',
                'keywords': {
                    'title_required': ['human resources', 'hr analyst', 'recruiting', 'talent acquisition', 'people operations'],
                    'title_optional': [],
                    'description': ['human resources', 'recruiting', 'talent', 'hr']
                },
                'exclude_keywords': ['software', 'engineer', 'developer', 'technical'],
                'min_score': 35
            }
        }
    
    def classify_job_enhanced(self, title: str, company: str, location: str, description: str) -> Dict:
        """Enhanced classification that's more precise and less over-inclusive"""
        
        # Clean and normalize input
        full_text = f"{title} {description}".lower()
        title_text = title.lower()
        
        # Use LLM classification if available
        if self.model:
            try:
                llm_result = self.classify_with_llm(title, company, location, description)
                if llm_result and llm_result.get('confidence_score', 0) >= 70:
                    return llm_result
            except Exception as e:
                logger.warning(f"LLM classification failed: {e}")
        
        # Fallback to rule-based classification
        return self.classify_with_rules(title_text, full_text, company, location)
    
    def classify_with_rules(self, title_text: str, full_text: str, company: str, location: str) -> Dict:
        """Precise rule-based classification"""
        
        categories = self.get_precise_job_categories()
        scores = {}
        
        # Score each category
        for category, config in categories.items():
            score = 0
            matched_keywords = []
            
            # Check required title keywords (highest weight)
            for keyword in config['keywords']['title_required']:
                if keyword in title_text:
                    score += 50  # High score for required matches
                    matched_keywords.append(f"title_req:{keyword}")
                    break  # Only need one required match
            
            # Check optional title keywords (if we have required match)
            if score > 0:  # Only if we found a required match
                for keyword in config['keywords'].get('title_optional', []):
                    if keyword in title_text:
                        score += 20
                        matched_keywords.append(f"title_opt:{keyword}")
            
            # Check description keywords (lower weight)
            for keyword in config['keywords'].get('description', []):
                if keyword in full_text:
                    score += 10
                    matched_keywords.append(f"desc:{keyword}")
            
            # Apply exclusion penalties
            for exclude_keyword in config.get('exclude_keywords', []):
                if exclude_keyword in full_text:
                    score -= 30  # Heavy penalty for exclusions
            
            # Only include if meets minimum threshold
            if score >= config['min_score']:
                scores[category] = {
                    'score': score,
                    'keywords': matched_keywords,
                    'parent': config['parent']
                }
        
        # Select the best match (not multiple)
        if not scores:
            return self.get_default_classification(title_text, full_text)
        
        # Get the highest scoring category
        best_category = max(scores.items(), key=lambda x: x[1]['score'])
        category_name = best_category[0]
        category_data = best_category[1]
        
        # Determine work arrangement
        work_arrangement = self.detect_work_arrangement(title_text, full_text, location)
        
        # Determine education level
        education_level = self.detect_education_level(title_text, full_text)
        
        # Detect time periods
        time_periods = self.extract_time_periods(title_text, full_text)
        
        return {
            'primary_category': category_name,
            'parent_category': category_data['parent'],
            'work_arrangement': work_arrangement,
            'education_level': education_level,
            'time_periods': time_periods,
            'confidence_score': min(95, max(20, category_data['score'])),
            'reasoning': f"Matched {category_name} with score {category_data['score']} based on: {', '.join(category_data['keywords'][:3])}",
            'is_student_position': True,
            'keywords_matched': category_data['keywords']
        }
    
    def get_default_classification(self, title_text: str, full_text: str) -> Dict:
        """Default classification for jobs that don't match specific categories"""
        
        # Basic fallback logic
        if any(word in title_text for word in ['engineer', 'engineering']):
            return {
                'primary_category': 'engineering_general',
                'parent_category': 'engineering',
                'work_arrangement': 'onsite',
                'education_level': 'undergraduate',
                'time_periods': ['internship_program'],
                'confidence_score': 30,
                'reasoning': 'General engineering role detected',
                'is_student_position': True,
                'keywords_matched': ['engineer']
            }
        elif any(word in title_text for word in ['analyst', 'analysis']):
            return {
                'primary_category': 'business_analyst',
                'parent_category': 'business',
                'work_arrangement': 'onsite',
                'education_level': 'undergraduate',
                'time_periods': ['internship_program'],
                'confidence_score': 25,
                'reasoning': 'General analyst role detected',
                'is_student_position': True,
                'keywords_matched': ['analyst']
            }
        else:
            return {
                'primary_category': 'general_other',
                'parent_category': 'other',
                'work_arrangement': 'onsite',
                'education_level': 'undergraduate',
                'time_periods': ['internship_program'],
                'confidence_score': 20,
                'reasoning': 'No specific category match found',
                'is_student_position': True,
                'keywords_matched': []
            }
    
    def detect_work_arrangement(self, title: str, description: str, location: str) -> str:
        """Detect work arrangement (remote, hybrid, onsite)"""
        text = f"{title} {description} {location}".lower()
        
        if any(word in text for word in ['remote', 'work from home', 'distributed']):
            return 'remote'
        elif any(word in text for word in ['hybrid', 'flexible']):
            return 'hybrid'
        else:
            return 'onsite'
    
    def detect_education_level(self, title: str, description: str) -> str:
        """Detect required education level"""
        text = f"{title} {description}".lower()
        
        if any(word in text for word in ['phd', 'doctoral', 'graduate student']):
            return 'phd'
        elif any(word in text for word in ['graduate', 'masters', 'mba']):
            return 'graduate'
        else:
            return 'undergraduate'
    
    def extract_time_periods(self, title: str, description: str) -> List[str]:
        """Extract time periods from job text"""
        text = f"{title} {description}".lower()
        periods = []
        
        # Seasonal periods
        seasons = ['summer', 'fall', 'winter', 'spring']
        years = ['2024', '2025', '2026', '2027']
        
        for season in seasons:
            for year in years:
                if f"{season} {year}" in text:
                    periods.append(f"{season}_{year}")
        
        # Program types
        if any(word in text for word in ['co-op', 'coop', 'cooperative']):
            periods.append('co_op_program')
        elif 'internship' in text:
            periods.append('internship_program')
        
        # Duration
        if any(word in text for word in ['3 month', 'summer', '12 week']):
            periods.append('short_term')
        elif any(word in text for word in ['6 month', 'semester']):
            periods.append('medium_term')
        elif any(word in text for word in ['8 month', '12 month', 'year round']):
            periods.append('long_term')
        
        return periods if periods else ['internship_program']
    
    def classify_with_llm(self, title: str, company: str, location: str, description: str) -> Optional[Dict]:
        """Use LLM for classification when available"""
        if not self.model:
            return None
            
        prompt = f"""
        Classify this job posting into ONE primary category. Be precise and conservative.
        
        Job Title: {title}
        Company: {company}
        Location: {location}
        Description: {description[:500]}
        
        Choose the SINGLE most appropriate category from:
        - software_engineering: Programming, development, coding
        - data_science: Data science, ML, AI engineering
        - mechanical_engineering: Mechanical, manufacturing, robotics
        - electrical_engineering: Electronics, circuits, power systems
        - civil_engineering: Construction, infrastructure
        - chemical_engineering: Chemical processes, materials
        - investment_banking: Investment banking, capital markets
        - consulting: Strategy consulting, business consulting
        - product_management: Product management, program management
        - marketing: Marketing, brand, communications
        - business_analyst: Business analysis, operations analysis
        - finance_general: Finance, accounting, treasury
        - research_development: Research, R&D, laboratory work
        - design_ux: UX/UI design, product design
        - cybersecurity: Security, risk, compliance
        - operations: Operations, supply chain, logistics
        - human_resources: HR, recruiting, talent
        - engineering_general: Other engineering roles
        - general_other: Doesn't fit other categories
        
        Respond with JSON: {{"primary_category": "category_name", "confidence_score": 85, "reasoning": "brief explanation"}}
        """
        
        try:
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                result['parent_category'] = self.get_parent_category(result['primary_category'])
                # Add missing fields for LLM results
                if 'work_arrangement' not in result:
                    result['work_arrangement'] = 'onsite'
                if 'education_level' not in result:
                    result['education_level'] = 'undergraduate'
                if 'time_periods' not in result:
                    result['time_periods'] = ['internship_program']
                if 'is_student_position' not in result:
                    result['is_student_position'] = True
                if 'keywords_matched' not in result:
                    result['keywords_matched'] = []
                return result
        except Exception as e:
            logger.warning(f"LLM classification error: {e}")
            return None
        
        return None
    
    def get_parent_category(self, primary_category: str) -> str:
        """Get parent category for a given primary category"""
        categories = self.get_precise_job_categories()
        return categories.get(primary_category, {}).get('parent', 'other')
    
    def process_database(self, batch_size: int = 50, max_records: Optional[int] = None) -> Dict[str, int]:
        """Process the entire database with enhanced classification"""
        
        logger.info("🚀 Starting enhanced classification process")
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all jobs
        query = "SELECT id, title, company_name, location, description, snippet FROM internships ORDER BY date_scraped DESC"
        if max_records:
            query += f" LIMIT {max_records}"
        
        cursor.execute(query)
        jobs = cursor.fetchall()
        total_jobs = len(jobs)
        
        logger.info(f"📊 Processing {total_jobs} jobs in batches of {batch_size}")
        
        stats = {
            'processed': 0,
            'high_confidence': 0,  # 70%+
            'medium_confidence': 0,  # 40-69%
            'low_confidence': 0,  # <40%
            'category_counts': Counter(),
            'parent_category_counts': Counter()
        }
        
        # Process in batches
        for i in range(0, total_jobs, batch_size):
            batch = jobs[i:i + batch_size]
            
            for job in batch:
                try:
                    # Extract job details
                    title = job['title'] if job['title'] else ''
                    company = job['company_name'] if job['company_name'] else ''
                    location = job['location'] if job['location'] else ''
                    description = (job['description'] if job['description'] else '') or (job['snippet'] if job['snippet'] else '') or ''
                    
                    # Classify job
                    result = self.classify_job_enhanced(title, company, location, description)
                    
                    # Create clean tag list (no duplicates, no generic tags)
                    tags = [
                        result['primary_category'],
                        result['parent_category'],
                        result['work_arrangement'],
                        result['education_level']
                    ] + result.get('time_periods', [])
                    
                    # Remove duplicates and 'other' tags
                    clean_tags = list(set([tag for tag in tags if tag and tag != 'other']))
                    
                    # Update database
                    cursor.execute("""
                        UPDATE internships SET
                            position_type = ?,
                            role_categories = ?,
                            tags = ?,
                            priority_score = ?,
                            types = ?,
                            normalized_title = ?,
                            normalized_company = ?,
                            normalized_description = ?
                        WHERE id = ?
                    """, (
                        'internship',  # Default position type
                        json.dumps([result['primary_category']]),
                        json.dumps(clean_tags),
                        result['confidence_score'],
                        json.dumps([result['primary_category']]),  # For backward compatibility
                        title,
                        company,
                        description[:200] if description else '',
                        job['id']
                    ))
                    
                    # Update statistics
                    stats['processed'] += 1
                    stats['category_counts'][result['primary_category']] += 1
                    stats['parent_category_counts'][result['parent_category']] += 1
                    
                    confidence = result['confidence_score']
                    if confidence >= 70:
                        stats['high_confidence'] += 1
                    elif confidence >= 40:
                        stats['medium_confidence'] += 1
                    else:
                        stats['low_confidence'] += 1
                        
                except Exception as e:
                    logger.error(f"Error processing job {job['id'] if 'id' in job.keys() else 'unknown'}: {e}")
                    continue
            
            # Commit batch
            conn.commit()
            logger.info(f"✅ Processed batch {i//batch_size + 1}/{(total_jobs + batch_size - 1)//batch_size}")
        
        conn.close()
        
        # Print final statistics
        logger.info("📈 CLASSIFICATION COMPLETE")
        logger.info(f"Total processed: {stats['processed']}")
        logger.info(f"High confidence (70%+): {stats['high_confidence']}")
        logger.info(f"Medium confidence (40-69%): {stats['medium_confidence']}")
        logger.info(f"Low confidence (<40%): {stats['low_confidence']}")
        
        logger.info("Top categories:")
        for category, count in stats['category_counts'].most_common(10):
            logger.info(f"  {category}: {count}")
        
        return stats

def main():
    """Main function to run the enhanced classification"""
    classifier = EnhancedJobClassifier()
    
    print("🚀 Enhanced Job Classification System")
    print("====================================")
    
    # Ask user for confirmation
    import sys
    response = input("This will reclassify ALL jobs in the database. Continue? (y/N): ")
    if response.lower() != 'y':
        print("❌ Cancelled")
        sys.exit(0)
    
    # Run classification
    stats = classifier.process_database(batch_size=50, max_records=None)
    
    print("\n✅ Classification complete!")
    print(f"📊 Processed {stats['processed']} jobs")
    print(f"🎯 High confidence: {stats['high_confidence']}")
    print(f"⚠️  Low confidence: {stats['low_confidence']}")

if __name__ == "__main__":
    main() 