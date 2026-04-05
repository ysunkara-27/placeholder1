#!/usr/bin/env python3
"""
LLM Classification Improver
===========================

This system uses Gemini API to improve the existing rule-based classifications,
focusing on low-confidence or incorrectly classified jobs.
"""

import os
import sqlite3
import json
import re
from typing import Dict, List, Optional
import google.generativeai as genai

class LLMClassificationImprover:
    def __init__(self, db_path="backend/internships.db"):
        self.db_path = db_path
        self.setup_gemini()
        
        # The existing parent/child category structure
        self.CATEGORIES = {
            'engineering': [
                'software_engineering', 'data_engineering', 'machine_learning',
                'cybersecurity', 'cloud_computing', 'mobile_development',
                'web_development', 'devops', 'qa_testing'
            ],
            'traditional_engineering': [
                'mechanical_engineering', 'electrical_engineering', 'civil_engineering',
                'chemical_engineering', 'aerospace_engineering', 'industrial_engineering',
                'biomedical_engineering', 'environmental_engineering'
            ],
            'business': [
                'business_analyst', 'project_management', 'operations',
                'supply_chain', 'consulting', 'strategy', 'business_development'
            ],
            'finance': [
                'investment_banking', 'asset_management', 'financial_analysis',
                'risk_management', 'trading', 'private_equity', 'venture_capital'
            ],
            'data_science': [
                'data_science', 'data_analysis', 'business_intelligence',
                'quantitative_research', 'actuarial', 'statistics'
            ],
            'marketing': [
                'digital_marketing', 'content_marketing', 'social_media',
                'brand_marketing', 'public_relations', 'communications'
            ],
            'design': [
                'ux_ui_design', 'graphic_design', 'product_design',
                'industrial_design', 'architecture'
            ],
            'research': [
                'research_development', 'lab_research', 'clinical_research',
                'market_research', 'academic_research'
            ],
            'legal': [
                'legal', 'compliance', 'regulatory_affairs', 'intellectual_property'
            ],
            'healthcare': [
                'clinical', 'pharmaceutical', 'biotechnology', 'medical_devices', 'nursing'
            ],
            'sales': [
                'sales', 'account_management', 'customer_success', 'business_development'
            ],
            'human_resources': [
                'hr_generalist', 'talent_acquisition', 'learning_development', 'compensation'
            ]
        }

    def setup_gemini(self):
        """Setup Gemini API"""
        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self.use_llm = True
            print("✅ Gemini API configured for LLM classification")
        else:
            self.use_llm = False
            print("⚠️ No Gemini API key found. Set GEMINI_API_KEY to use LLM classification.")

    def get_candidates_for_improvement(self, limit=100):
        """Get jobs that would benefit from LLM classification"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get low-confidence classifications or generic categories
        cursor.execute("""
            SELECT id, title, company_name, description, snippet, tags, role_categories, 
                   confidence_score, classification_reasoning, parent_category
            FROM internships 
            WHERE confidence_score <= 75 
               OR tags LIKE '%business_analyst%' 
               OR tags LIKE '%general_other%'
               OR classification_reasoning LIKE '%Default%'
            ORDER BY confidence_score ASC, RANDOM()
            LIMIT ?
        """, (limit,))
        
        jobs = cursor.fetchall()
        conn.close()
        
        print(f"📊 Found {len(jobs)} jobs that could benefit from LLM classification")
        return jobs

    def classify_with_llm(self, job_data: Dict) -> Optional[Dict]:
        """Use LLM to classify a job with high accuracy"""
        if not self.use_llm:
            return None
            
        title = job_data.get('title', '')
        company = job_data.get('company_name', '')
        description = job_data.get('description', '') or job_data.get('snippet', '')
        
        # Create category options text
        categories_text = ""
        for parent, children in self.CATEGORIES.items():
            categories_text += f"\n{parent.upper()}:\n"
            for child in children:
                categories_text += f"  - {child}\n"
        
        prompt = f"""
You are an expert job classifier for student positions (internships, co-ops, trainee programs).

ANALYZE THIS STUDENT POSITION:
Title: {title}
Company: {company}
Description: {description[:800]}...

AVAILABLE CATEGORIES:{categories_text}

INSTRUCTIONS:
1. Choose the MOST SPECIFIC child category that best fits the primary job function
2. Identify the corresponding parent category
3. Determine work arrangement: remote, hybrid, or onsite
4. Determine education level: undergraduate, graduate, phd, or any
5. Rate confidence 1-100 (be honest about uncertainty)

RETURN ONLY JSON:
{{
    "parent_category": "exact_parent_name",
    "primary_category": "exact_child_name", 
    "work_arrangement": "remote/hybrid/onsite",
    "education_level": "undergraduate/graduate/phd/any",
    "confidence_score": 85,
    "reasoning": "Brief explanation of why this category fits best",
    "key_indicators": ["specific", "words", "that", "influenced", "decision"]
}}

Focus on the PRIMARY job function, not secondary skills or requirements.
"""
        
        try:
            response = self.model.generate_content(prompt)
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                # Validate the classification
                parent = result.get('parent_category')
                child = result.get('primary_category')
                
                if parent in self.CATEGORIES and child in self.CATEGORIES[parent]:
                    return result
                else:
                    print(f"⚠️ Invalid LLM classification: {parent} -> {child}")
                    return None
            
            print(f"⚠️ Could not parse LLM response for: {title}")
            return None
            
        except Exception as e:
            print(f"❌ LLM classification error for '{title}': {e}")
            return None

    def improve_classification(self, job_data: Dict) -> Dict:
        """Improve an existing classification using LLM"""
        # Try LLM classification first
        llm_result = self.classify_with_llm(job_data)
        
        if llm_result and llm_result['confidence_score'] >= 80:
            # Use LLM result if high confidence
            tags = [
                llm_result['primary_category'],
                llm_result['parent_category'],
                llm_result['work_arrangement'],
                llm_result['education_level'],
                'internship'  # Always include position type
            ]
            
            return {
                'tags': tags,
                'role_categories': [llm_result['primary_category']],
                'parent_category': llm_result['parent_category'],
                'work_arrangement': llm_result['work_arrangement'],
                'education_level': llm_result['education_level'],
                'confidence_score': llm_result['confidence_score'],
                'classification_reasoning': f"LLM: {llm_result['reasoning']}",
                'improved_by': 'llm'
            }
        else:
            # Keep existing classification but mark as reviewed
            existing_tags = json.loads(job_data.get('tags', '[]'))
            existing_categories = json.loads(job_data.get('role_categories', '[]'))
            
            return {
                'tags': existing_tags,
                'role_categories': existing_categories,
                'parent_category': job_data.get('parent_category'),
                'work_arrangement': job_data.get('work_arrangement'),
                'education_level': job_data.get('education_level'),
                'confidence_score': job_data.get('confidence_score', 40),
                'classification_reasoning': f"Rule-based (LLM unavailable/low confidence)",
                'improved_by': 'reviewed'
            }

    def run_improvement(self, limit=100):
        """Run LLM improvement on selected jobs"""
        if not self.use_llm:
            print("❌ Cannot run LLM improvement without Gemini API key")
            print("Set GEMINI_API_KEY environment variable and try again")
            return
        
        print("🚀 Starting LLM Classification Improvement")
        print(f"🎯 Target: {limit} jobs with low confidence or generic classifications")
        
        # Get candidates
        candidates = self.get_candidates_for_improvement(limit)
        
        if not candidates:
            print("✅ No jobs need improvement - all classifications look good!")
            return
        
        # Process improvements
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        improved = 0
        reviewed = 0
        
        for i, job in enumerate(candidates):
            try:
                print(f"📋 Processing {i+1}/{len(candidates)}: {job['title'][:50]}...")
                
                # Get improvement
                improvement = self.improve_classification(dict(job))
                
                # Update database
                cursor.execute("""
                    UPDATE internships SET
                        tags = ?,
                        role_categories = ?,
                        parent_category = ?,
                        work_arrangement = ?,
                        education_level = ?,
                        confidence_score = ?,
                        classification_reasoning = ?
                    WHERE id = ?
                """, (
                    json.dumps(improvement['tags']),
                    json.dumps(improvement['role_categories']),
                    improvement['parent_category'],
                    improvement['work_arrangement'],
                    improvement['education_level'],
                    improvement['confidence_score'],
                    improvement['classification_reasoning'],
                    job['id']
                ))
                
                if improvement['improved_by'] == 'llm':
                    improved += 1
                else:
                    reviewed += 1
                
                # Commit every 10 jobs
                if (i + 1) % 10 == 0:
                    conn.commit()
                    print(f"✅ Saved progress: {improved} improved, {reviewed} reviewed")
                    
            except Exception as e:
                print(f"❌ Error processing job {job.get('id')}: {e}")
                continue
        
        conn.commit()
        conn.close()
        
        print(f"""
╭─────────────────────────────────╮
│ 🎉 LLM Improvement Complete    │
╰─────────────────────────────────╯
🤖 LLM Improved: {improved}
👁️ Reviewed: {reviewed} 
📊 Total processed: {len(candidates)}
🎯 Higher accuracy classifications applied!
        """)

if __name__ == "__main__":
    improver = LLMClassificationImprover()
    improver.run_improvement(limit=200)  # Process up to 200 low-confidence jobs 