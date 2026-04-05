#!/usr/bin/env python3
"""
Smart Filter API Endpoints
==========================

Enhanced API endpoints that leverage the smart tagging system for:
- Semantic search and filtering
- Intelligent duplicate detection
- Industry-specific categorization
- Skill-based matching
- Better relevance scoring
"""

import sqlite3
import json
import re
from typing import Dict, List, Optional, Tuple
from collections import defaultdict, Counter
import logging

class SmartFilterAPI:
    def __init__(self, db_path="backend/internships.db"):
        self.db_path = db_path
        self.setup_logging()
        
    def setup_logging(self):
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
    
    def get_smart_filter_options(self) -> Dict:
        """Get dynamic filter options based on smart tagging"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get industry distribution
        cursor.execute("""
            SELECT role_categories, COUNT(*) as count
            FROM internships 
            WHERE smart_tags IS NOT NULL
            GROUP BY role_categories
            ORDER BY count DESC
        """)
        
        industry_counts = {}
        for row in cursor.fetchall():
            try:
                categories = json.loads(row['role_categories'])
                for category in categories:
                    industry_counts[category] = industry_counts.get(category, 0) + row['count']
            except:
                continue
        
        # Get work arrangement distribution  
        cursor.execute("""
            SELECT work_arrangement, COUNT(*) as count
            FROM internships 
            WHERE work_arrangement IS NOT NULL
            GROUP BY work_arrangement
            ORDER BY count DESC
        """)
        work_arrangements = {row['work_arrangement']: row['count'] for row in cursor.fetchall()}
        
        # Get education level distribution
        cursor.execute("""
            SELECT education_level, COUNT(*) as count
            FROM internships 
            WHERE education_level IS NOT NULL
            GROUP BY education_level
            ORDER BY count DESC
        """)
        education_levels = {row['education_level']: row['count'] for row in cursor.fetchall()}
        
        # Get top skills from smart tags
        cursor.execute("""
            SELECT smart_tags
            FROM internships 
            WHERE smart_tags IS NOT NULL AND smart_tags != ''
        """)
        
        all_skills = []
        for row in cursor.fetchall():
            try:
                tags = json.loads(row['smart_tags'])
                all_skills.extend(tags)
            except:
                continue
        
        skill_counts = Counter(all_skills)
        top_skills = {skill: count for skill, count in skill_counts.most_common(20)}
        
        # Get company size distribution
        cursor.execute("""
            SELECT classification_data, COUNT(*) as count
            FROM internships 
            WHERE classification_data IS NOT NULL
        """)
        
        company_sizes = defaultdict(int)
        for row in cursor.fetchall():
            try:
                data = json.loads(row['classification_data'])
                if 'company_size' in data and data['company_size'] != 'unknown':
                    company_sizes[data['company_size']] += row['count']
            except:
                continue
        
        conn.close()
        
        return {
            'industries': industry_counts,
            'work_arrangements': work_arrangements,
            'education_levels': education_levels,
            'top_skills': top_skills,
            'company_sizes': dict(company_sizes),
            'total_jobs': sum(industry_counts.values())
        }
    
    def semantic_search(self, 
                       query: str = '', 
                       industry: str = '',
                       skills: List[str] = [],
                       work_arrangement: str = '',
                       education_level: str = '',
                       company_size: str = '',
                       exclude_similar: bool = True,
                       page: int = 1,
                       per_page: int = 50) -> Dict:
        """Advanced semantic search with smart filtering"""
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Build the base query
        base_query = """
            SELECT DISTINCT i.*, 
                   i.smart_tags,
                   i.classification_data,
                   i.similarity_hash,
                   i.confidence_score,
                   i.work_arrangement,
                   i.education_level,
                   i.specific_role_type
            FROM internships i
            WHERE i.smart_tags IS NOT NULL
        """
        
        conditions = []
        params = []
        
        # Text search with semantic understanding
        if query:
            query_conditions = [
                "i.title LIKE ?",
                "i.description LIKE ?", 
                "i.company_name LIKE ?",
                "i.smart_tags LIKE ?",
                "i.specific_role_type LIKE ?"
            ]
            query_param = f"%{query}%"
            conditions.append(f"({' OR '.join(query_conditions)})")
            params.extend([query_param] * 5)
        
        # Industry filter
        if industry:
            conditions.append("i.role_categories LIKE ?")
            params.append(f'%"{industry}"%')
        
        # Skills filter
        if skills:
            skill_conditions = []
            for skill in skills:
                skill_conditions.append("i.smart_tags LIKE ?")
                params.append(f'%"{skill}"%')
            if skill_conditions:
                conditions.append(f"({' OR '.join(skill_conditions)})")
        
        # Work arrangement filter
        if work_arrangement:
            conditions.append("i.work_arrangement = ?")
            params.append(work_arrangement)
        
        # Education level filter
        if education_level:
            conditions.append("i.education_level = ?")
            params.append(education_level)
        
        # Company size filter
        if company_size:
            conditions.append("i.classification_data LIKE ?")
            params.append(f'%"company_size": "{company_size}"%')
        
        # Build final query
        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        # Add ordering by confidence and recency
        base_query += " ORDER BY i.confidence_score DESC, i.date_scraped DESC"
        
        # Execute query to get total count
        count_query = base_query.replace("SELECT DISTINCT i.*,", "SELECT COUNT(DISTINCT i.id)")
        count_query = re.sub(r'ORDER BY.*$', '', count_query)
        
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]
        
        # Add pagination
        offset = (page - 1) * per_page
        base_query += f" LIMIT {per_page} OFFSET {offset}"
        
        # Execute main query
        cursor.execute(base_query, params)
        results = cursor.fetchall()
        
        # Process results and calculate relevance scores
        processed_results = []
        seen_hashes = set()
        
        for row in results:
            # Skip similar jobs if requested
            if exclude_similar and row['similarity_hash'] in seen_hashes:
                continue
            
            if exclude_similar:
                seen_hashes.add(row['similarity_hash'])
            
            # Calculate relevance score
            relevance_score = self.calculate_relevance_score(
                dict(row), query, industry, skills
            )
            
            # Parse smart tags and classification data
            try:
                smart_tags = json.loads(row['smart_tags']) if row['smart_tags'] else []
                classification_data = json.loads(row['classification_data']) if row['classification_data'] else {}
            except:
                smart_tags = []
                classification_data = {}
            
            processed_job = {
                'id': row['id'],
                'title': row['title'],
                'company_name': row['company_name'],
                'location': row['location'],
                'description': row['description'],
                'snippet': row['snippet'],
                'url': row['url'],
                'date_scraped': row['date_scraped'],
                'smart_tags': smart_tags,
                'classification_data': classification_data,
                'work_arrangement': row['work_arrangement'],
                'education_level': row['education_level'],
                'specific_role_type': row['specific_role_type'],
                'confidence_score': row['confidence_score'],
                'relevance_score': relevance_score,
                'similarity_hash': row['similarity_hash']
            }
            
            processed_results.append(processed_job)
        
        # Sort by relevance score
        processed_results.sort(key=lambda x: x['relevance_score'], reverse=True)
        
        conn.close()
        
        return {
            'internships': processed_results,
            'total_count': total_count,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_count + per_page - 1) // per_page,
            'filters_applied': {
                'query': query,
                'industry': industry,
                'skills': skills,
                'work_arrangement': work_arrangement,
                'education_level': education_level,
                'company_size': company_size,
                'exclude_similar': exclude_similar
            }
        }
    
    def calculate_relevance_score(self, job: Dict, query: str, industry: str, skills: List[str]) -> float:
        """Calculate relevance score for semantic ranking"""
        score = 0.0
        
        # Base confidence score (0-40 points)
        score += (job.get('confidence_score', 0) / 100) * 40
        
        # Query match bonus (0-30 points)
        if query:
            query_lower = query.lower()
            title_match = query_lower in job.get('title', '').lower()
            desc_match = query_lower in job.get('description', '').lower()
            company_match = query_lower in job.get('company_name', '').lower()
            
            if title_match:
                score += 20
            if desc_match:
                score += 10
            if company_match:
                score += 5
        
        # Industry match bonus (0-20 points)
        if industry:
            try:
                role_categories = json.loads(job.get('role_categories', '[]'))
                if industry in role_categories:
                    score += 20
            except:
                pass
        
        # Skills match bonus (0-10 points)
        if skills:
            try:
                job_tags = json.loads(job.get('smart_tags', '[]'))
                matching_skills = set(skills) & set(job_tags)
                score += len(matching_skills) * 2
            except:
                pass
        
        return min(score, 100.0)  # Cap at 100
    
    def get_similar_jobs(self, job_id: int, limit: int = 5) -> List[Dict]:
        """Find jobs similar to a given job"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get the reference job
        cursor.execute("SELECT * FROM internships WHERE id = ?", (job_id,))
        ref_job = cursor.fetchone()
        
        if not ref_job:
            return []
        
        try:
            ref_tags = json.loads(ref_job['smart_tags']) if ref_job['smart_tags'] else []
            ref_categories = json.loads(ref_job['role_categories']) if ref_job['role_categories'] else []
        except:
            ref_tags = []
            ref_categories = []
        
        # Find similar jobs
        similar_jobs = []
        
        # Search by industry first
        if ref_categories:
            cursor.execute("""
                SELECT *, 
                       (CASE WHEN similarity_hash = ? THEN 1 ELSE 0 END) as hash_match
                FROM internships 
                WHERE id != ? 
                AND role_categories LIKE ?
                ORDER BY confidence_score DESC, date_scraped DESC
                LIMIT ?
            """, (ref_job['similarity_hash'], job_id, f'%{ref_categories[0]}%', limit * 2))
            
            candidates = cursor.fetchall()
            
            for candidate in candidates:
                try:
                    candidate_tags = json.loads(candidate['smart_tags']) if candidate['smart_tags'] else []
                    
                    # Calculate similarity score
                    tag_overlap = len(set(ref_tags) & set(candidate_tags))
                    similarity_score = tag_overlap / max(len(ref_tags), len(candidate_tags), 1)
                    
                    if similarity_score > 0.3:  # 30% similarity threshold
                        similar_jobs.append({
                            'job': dict(candidate),
                            'similarity_score': similarity_score
                        })
                except:
                    continue
        
        # Sort by similarity and return top results
        similar_jobs.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        conn.close()
        
        return [item['job'] for item in similar_jobs[:limit]]
    
    def get_trending_skills(self, days: int = 30) -> List[Dict]:
        """Get trending skills from recent job postings"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT smart_tags
            FROM internships 
            WHERE date_scraped >= date('now', '-{} days')
            AND smart_tags IS NOT NULL
        """.format(days))
        
        all_skills = []
        for row in cursor.fetchall():
            try:
                tags = json.loads(row[0])
                all_skills.extend(tags)
            except:
                continue
        
        skill_counts = Counter(all_skills)
        trending_skills = [
            {'skill': skill, 'count': count} 
            for skill, count in skill_counts.most_common(15)
        ]
        
        conn.close()
        return trending_skills

# Integration functions for Flask app
def setup_smart_filter_routes(app, db_path="backend/internships.db"):
    """Add smart filter routes to Flask app"""
    
    smart_api = SmartFilterAPI(db_path)
    
    @app.route('/api/internships/smart-search', methods=['GET'])
    def smart_search():
        from flask import request, jsonify
        
        # Get parameters
        query = request.args.get('query', '')
        industry = request.args.get('industry', '')
        skills = request.args.getlist('skills')
        work_arrangement = request.args.get('work_arrangement', '')
        education_level = request.args.get('education_level', '')
        company_size = request.args.get('company_size', '')
        exclude_similar = request.args.get('exclude_similar', 'true').lower() == 'true'
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)
        
        try:
            results = smart_api.semantic_search(
                query=query,
                industry=industry,
                skills=skills,
                work_arrangement=work_arrangement,
                education_level=education_level,
                company_size=company_size,
                exclude_similar=exclude_similar,
                page=page,
                per_page=per_page
            )
            
            return jsonify(results)
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/internships/smart-filters', methods=['GET'])
    def smart_filter_options():
        from flask import jsonify
        
        try:
            options = smart_api.get_smart_filter_options()
            return jsonify(options)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/internships/<int:job_id>/similar', methods=['GET'])
    def similar_jobs(job_id):
        from flask import request, jsonify
        
        limit = min(int(request.args.get('limit', 5)), 20)
        
        try:
            similar = smart_api.get_similar_jobs(job_id, limit)
            return jsonify({'similar_jobs': similar})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/internships/trending-skills', methods=['GET'])
    def trending_skills():
        from flask import request, jsonify
        
        days = min(int(request.args.get('days', 30)), 90)
        
        try:
            skills = smart_api.get_trending_skills(days)
            return jsonify({'trending_skills': skills})
        except Exception as e:
            return jsonify({'error': str(e)}), 500 