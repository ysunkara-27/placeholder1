#!/usr/bin/env python3
"""
Enhanced Filtering System for JobDrop
Provides improved search and filtering capabilities
"""

import sqlite3
import json
import re
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

class EnhancedFilterSystem:
    """Enhanced filtering system with improved search and categorization"""
    
    def __init__(self, db_path: str = 'backend/internships.db'):
        self.db_path = db_path
        
    def get_filter_categories(self) -> Dict[str, List[str]]:
        """Get organized filter categories for the frontend"""
        return {
            'engineering': [
                'software_engineering',
                'data_science', 
                'mechanical_engineering',
                'electrical_engineering',
                'civil_engineering',
                'chemical_engineering',
                'engineering_general'
            ],
            'business': [
                'business_analyst',
                'consulting',
                'product_management',
                'marketing',
                'operations',
                'human_resources'
            ],
            'finance': [
                'investment_banking',
                'finance_general'
            ],
            'technology': [
                'software_engineering',
                'data_science',
                'cybersecurity'
            ],
            'research': [
                'research_development'
            ],
            'design': [
                'design_ux'
            ]
        }
    
    def search_jobs_enhanced(self, 
                           search_query: Optional[str] = None,
                           categories: Optional[List[str]] = None,
                           parent_categories: Optional[List[str]] = None,
                           work_arrangement: Optional[str] = None,
                           education_level: Optional[str] = None,
                           time_periods: Optional[List[str]] = None,
                           company: Optional[str] = None,
                           location: Optional[str] = None,
                           min_priority: Optional[int] = None,
                           region: Optional[str] = None,
                           limit: Optional[int] = 50,
                           offset: Optional[int] = 0) -> Dict:
        """Enhanced search with multiple filter options"""
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Build the query
        query_parts = ["SELECT * FROM internships WHERE 1=1"]
        params = []
        
        # Search query with relevance scoring
        if search_query:
            search_query = search_query.strip()
            query_parts.append("""
                AND (
                    LOWER(title) LIKE LOWER(?) OR 
                    LOWER(company_name) LIKE LOWER(?) OR 
                    LOWER(description) LIKE LOWER(?) OR 
                    LOWER(snippet) LIKE LOWER(?) OR
                    LOWER(tags) LIKE LOWER(?)
                )
            """)
            search_param = f"%{search_query}%"
            params.extend([search_param] * 5)
        
        # Category filtering
        if categories:
            category_conditions = []
            for category in categories:
                category_conditions.append("LOWER(tags) LIKE LOWER(?)")
                params.append(f"%{category}%")
            query_parts.append(f"AND ({' OR '.join(category_conditions)})")
        
        # Parent category filtering
        if parent_categories:
            parent_conditions = []
            filter_categories = self.get_filter_categories()
            
            for parent_cat in parent_categories:
                if parent_cat in filter_categories:
                    # Add all child categories for this parent
                    for child_cat in filter_categories[parent_cat]:
                        parent_conditions.append("LOWER(tags) LIKE LOWER(?)")
                        params.append(f"%{child_cat}%")
                else:
                    # Direct parent category match
                    parent_conditions.append("LOWER(tags) LIKE LOWER(?)")
                    params.append(f"%{parent_cat}%")
            
            if parent_conditions:
                query_parts.append(f"AND ({' OR '.join(parent_conditions)})")
        
        # Work arrangement filtering
        if work_arrangement:
            query_parts.append("AND LOWER(tags) LIKE LOWER(?)")
            params.append(f"%{work_arrangement}%")
        
        # Education level filtering
        if education_level:
            query_parts.append("AND LOWER(tags) LIKE LOWER(?)")
            params.append(f"%{education_level}%")
        
        # Time period filtering
        if time_periods:
            time_conditions = []
            for period in time_periods:
                time_conditions.append("LOWER(tags) LIKE LOWER(?)")
                params.append(f"%{period}%")
            query_parts.append(f"AND ({' OR '.join(time_conditions)})")
        
        # Company filtering
        if company:
            query_parts.append("AND LOWER(company_name) LIKE LOWER(?)")
            params.append(f"%{company}%")
        
        # Location filtering
        if location:
            query_parts.append("AND LOWER(location) LIKE LOWER(?)")
            params.append(f"%{location}%")
        
        # Region filtering
        if region and region.lower() != 'all regions':
            query_parts.append("AND region = ?")
            params.append(region)
        
        # Priority filtering
        if min_priority:
            query_parts.append("AND COALESCE(priority_score, 0) >= ?")
            params.append(min_priority)
        
        # Ordering - prioritize recent jobs and high priority
        if search_query:
            # When searching, add relevance scoring
            relevance_score = """
                (CASE WHEN LOWER(title) LIKE LOWER(?) THEN 100 ELSE 0 END +
                 CASE WHEN LOWER(company_name) LIKE LOWER(?) THEN 50 ELSE 0 END +
                 CASE WHEN LOWER(description) LIKE LOWER(?) THEN 20 ELSE 0 END +
                 CASE WHEN LOWER(tags) LIKE LOWER(?) THEN 25 ELSE 0 END) as relevance_score
            """
            query_parts[0] = query_parts[0].replace("SELECT *", f"SELECT *, {relevance_score}")
            search_param = f"%{search_query}%"
            params.extend([search_param] * 4)
            
            query_parts.append("ORDER BY relevance_score DESC, date_scraped DESC, COALESCE(priority_score, 0) DESC")
        else:
            query_parts.append("ORDER BY date_scraped DESC, COALESCE(priority_score, 0) DESC")
        
        # Add pagination
        if limit:
            query_parts.append("LIMIT ?")
            params.append(limit)
            if offset:
                query_parts.append("OFFSET ?")
                params.append(offset)
        
        # Execute query
        final_query = " ".join(query_parts)
        cursor.execute(final_query, params)
        jobs = cursor.fetchall()
        
        # Get total count for pagination
        count_query = final_query.replace("SELECT *", "SELECT COUNT(*)")
        if search_query:
            # Remove the relevance score calculation for count query
            count_query = re.sub(r'SELECT COUNT\(\*\), .*? as relevance_score', 'SELECT COUNT(*)', count_query)
            # Remove the extra search parameters used for relevance scoring
            count_params = params[:-4] if search_query else params
        else:
            count_params = params
        
        # Remove LIMIT and OFFSET for count
        count_query = re.sub(r'LIMIT \?( OFFSET \?)?$', '', count_query).strip()
        if limit:
            count_params = count_params[:-1]  # Remove limit param
            if offset:
                count_params = count_params[:-1]  # Remove offset param
        
        cursor.execute(count_query, count_params)
        total_count = cursor.fetchone()[0]
        
        conn.close()
        
        # Format results
        formatted_jobs = []
        for job in jobs:
            # Parse JSON fields safely
            try:
                tags = json.loads(job['tags']) if job['tags'] else []
                types = json.loads(job['types']) if job['types'] else []
                role_categories = json.loads(job['role_categories']) if job['role_categories'] else []
            except:
                tags = []
                types = []
                role_categories = []
            
            formatted_job = {
                'id': job['id'],
                'title': job['title'],
                'company_name': job['company_name'],
                'location': job['location'],
                'snippet': job['snippet'],
                'description': job['description'],
                'deadline': job['deadline'],
                'posted_date': job['posted_date'],
                'application_link': job['application_link'],
                'source_url': job['source_url'],
                'date_scraped': job['date_scraped'],
                'semester': job['semester'],
                'year': job['year'],
                'region': job['region'],
                'country': job['country'],
                'priority_score': job['priority_score'] or 0,
                'position_type': job['position_type'],
                'tags': tags,
                'types': types,
                'role_categories': role_categories,
                'all_categories': list(set(tags + types + role_categories)),
                'relevance_score': job.get('relevance_score', 0) if search_query else 0
            }
            formatted_jobs.append(formatted_job)
        
        return {
            'internships': formatted_jobs,
            'total_count': total_count,
            'returned_count': len(formatted_jobs),
            'has_more': total_count > (offset or 0) + len(formatted_jobs),
            'filters_applied': {
                'search_query': search_query,
                'categories': categories,
                'parent_categories': parent_categories,
                'work_arrangement': work_arrangement,
                'education_level': education_level,
                'time_periods': time_periods,
                'company': company,
                'location': location,
                'min_priority': min_priority,
                'region': region
            }
        }
    
    def get_filter_options(self) -> Dict:
        """Get all available filter options with counts"""
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all unique tags and their counts
        cursor.execute("""
            SELECT tags, COUNT(*) as count 
            FROM internships 
            WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'
            GROUP BY tags
        """)
        
        tag_counter = defaultdict(int)
        for row in cursor.fetchall():
            try:
                tags = json.loads(row['tags'])
                for tag in tags:
                    if tag and tag != 'other':
                        tag_counter[tag] += row['count']
            except:
                continue
        
        # Get companies
        cursor.execute("""
            SELECT company_name, COUNT(*) as count 
            FROM internships 
            GROUP BY company_name 
            ORDER BY count DESC 
            LIMIT 100
        """)
        companies = [{'name': row['company_name'], 'count': row['count']} for row in cursor.fetchall()]
        
        # Get regions
        cursor.execute("""
            SELECT region, COUNT(*) as count 
            FROM internships 
            WHERE region IS NOT NULL 
            GROUP BY region 
            ORDER BY count DESC
        """)
        regions = [{'name': row['region'], 'count': row['count']} for row in cursor.fetchall()]
        
        # Get years
        cursor.execute("""
            SELECT year, COUNT(*) as count 
            FROM internships 
            WHERE year IS NOT NULL 
            GROUP BY year 
            ORDER BY year DESC
        """)
        years = [{'year': row['year'], 'count': row['count']} for row in cursor.fetchall()]
        
        conn.close()
        
        # Organize categories
        filter_categories = self.get_filter_categories()
        organized_categories = {}
        
        for parent, children in filter_categories.items():
            organized_categories[parent] = []
            for child in children:
                count = tag_counter.get(child, 0)
                if count > 0:
                    organized_categories[parent].append({
                        'name': child,
                        'display_name': child.replace('_', ' ').title(),
                        'count': count
                    })
        
        # Work arrangements
        work_arrangements = []
        for arrangement in ['remote', 'hybrid', 'onsite']:
            count = tag_counter.get(arrangement, 0)
            if count > 0:
                work_arrangements.append({
                    'name': arrangement,
                    'display_name': arrangement.title(),
                    'count': count
                })
        
        # Education levels
        education_levels = []
        for level in ['undergraduate', 'graduate', 'phd']:
            count = tag_counter.get(level, 0)
            if count > 0:
                education_levels.append({
                    'name': level,
                    'display_name': level.title(),
                    'count': count
                })
        
        return {
            'categories': organized_categories,
            'companies': companies,
            'regions': regions,
            'years': years,
            'work_arrangements': work_arrangements,
            'education_levels': education_levels,
            'total_jobs': sum(tag_counter.values()) if tag_counter else 0
        }
    
    def suggest_searches(self, query: str, limit: int = 5) -> List[str]:
        """Suggest search terms based on partial query"""
        
        if not query or len(query) < 2:
            return []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Search in titles and company names
        cursor.execute("""
            SELECT title, company_name 
            FROM internships 
            WHERE LOWER(title) LIKE LOWER(?) OR LOWER(company_name) LIKE LOWER(?)
            LIMIT ?
        """, (f"%{query}%", f"%{query}%", limit * 2))
        
        suggestions = set()
        for row in cursor.fetchall():
            # Extract words that match the query
            title_words = row['title'].lower().split()
            company_words = row['company_name'].lower().split()
            
            for word in title_words + company_words:
                if query.lower() in word and len(word) > 2:
                    suggestions.add(word.title())
        
        conn.close()
        
        return list(suggestions)[:limit]

def main():
    """Test the enhanced filter system"""
    filter_system = EnhancedFilterSystem()
    
    print("🔍 Testing Enhanced Filter System")
    print("=================================")
    
    # Test basic search
    results = filter_system.search_jobs_enhanced(
        search_query="software engineer",
        limit=5
    )
    print(f"Software engineer search: {results['total_count']} results")
    
    # Test category filtering
    results = filter_system.search_jobs_enhanced(
        parent_categories=["engineering"],
        limit=5
    )
    print(f"Engineering category: {results['total_count']} results")
    
    # Get filter options
    options = filter_system.get_filter_options()
    print(f"Available categories: {list(options['categories'].keys())}")
    print(f"Top companies: {[c['name'] for c in options['companies'][:5]]}")

if __name__ == "__main__":
    main() 