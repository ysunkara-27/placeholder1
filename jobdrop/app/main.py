import os
import json
import sqlite3
import time
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify, request, session
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore, auth
from dotenv import load_dotenv
# import stripe  # Removed - payment functionality disabled
from subscription import SubscriptionManager
import xml.etree.ElementTree as ET
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai.adapters.smart_filter_api import setup_smart_filter_routes

# Load environment variables for local development
load_dotenv()

# --- App Initialization ---
print("🚀 Initializing Flask app...")
app = Flask(__name__)
CORS(app, supports_credentials=True)  # Enable CORS with credentials

# Set a consistent secret key for production
# In production, use environment variable, otherwise generate a random one for dev
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))
print("✅ Flask app initialized successfully")

# --- SQLite Database Configuration ---
# Use different paths for different environments
# Only use production path when actually deployed on Render platform
if os.getenv('RENDER') == 'true':
    # In production on Render, use a path that might persist longer
    INTERNSHIPS_DB_PATH = '/opt/render/project/src/backend/database/internships.db'
else:
    # For local development - use path relative to project root
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    INTERNSHIPS_DB_PATH = os.path.join(project_root, 'backend', 'database', 'internships.db')

# Removed deploy_production_database function to prevent startup issues

def initialize_database():
    """Initialize the database with the required schema"""
    try:
        conn = sqlite3.connect(INTERNSHIPS_DB_PATH)
        cursor = conn.cursor()
        
        # Create the internships table with enhanced schema if it doesn't exist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS internships (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            company_name TEXT NOT NULL,
            location TEXT,
            snippet TEXT,
            deadline TEXT,
            posted_date TEXT,
            types TEXT,
            application_link TEXT NOT NULL UNIQUE,
            source_url TEXT,
            date_scraped DATE NOT NULL,
            description TEXT,
            semester TEXT,
            year INTEGER,
            region TEXT,
            country TEXT,
            tags TEXT,
            priority_score INTEGER,
            normalized_title TEXT,
            normalized_company TEXT,
            normalized_description TEXT
        )
        """)
        
        conn.commit()
        conn.close()
        print(f"✅ Database initialized at: {INTERNSHIPS_DB_PATH}")
        return True
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False

def get_db_connection():
    """Get a connection to the SQLite internships database"""
    try:
        conn = sqlite3.connect(INTERNSHIPS_DB_PATH)
        conn.row_factory = sqlite3.Row  # This allows dict-like access to rows
        return conn
    except Exception as e:
        print(f"❌ Error connecting to SQLite database: {e}")
        print(f"❌ Database path: {INTERNSHIPS_DB_PATH}")
        return None

def get_available_columns(conn):
    """Get list of available columns in the internships table for backward compatibility"""
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(internships)")
        columns = [column[1] for column in cursor.fetchall()]
        return columns
    except Exception as e:
        print(f"❌ Error getting table columns: {e}")
        return []

def build_compatible_query(available_columns, search=None):
    """Build a database query that only uses available columns"""
    
    # Define column mappings and fallbacks
    column_config = {
        'base_columns': ['id', 'title', 'company_name', 'location', 'snippet', 'deadline', 'posted_date', 'types', 'application_link', 'source_url', 'date_scraped', 'description'],
        'enhanced_columns': {
            'tags': 'types',  # fallback to types
            'priority_score': '0',  # fallback to 0
            'normalized_title': 'title',  # fallback to title
            'normalized_company': 'company_name',  # fallback to company_name
            'normalized_description': 'description',  # fallback to description
            'semester': 'NULL',
            'year': 'NULL',
            'region': 'NULL',
            'country': 'NULL'
        }
    }
    
    # Build SELECT clause with available columns only
    select_parts = []
    for col in column_config['base_columns']:
        if col in available_columns:
            select_parts.append(col)
    
    # Add enhanced columns if available, otherwise use fallbacks
    for enhanced_col, fallback in column_config['enhanced_columns'].items():
        if enhanced_col in available_columns:
            select_parts.append(enhanced_col)
        else:
            if fallback in available_columns:
                select_parts.append(f"{fallback} as {enhanced_col}")
            else:
                select_parts.append(f"{fallback} as {enhanced_col}")
    
    # Build the query
    if search:
        # Build relevance scoring based on available columns
        relevance_parts = []
        relevance_parts.append("CASE WHEN LOWER(title) LIKE LOWER(?) THEN 100 ELSE 0 END")
        relevance_parts.append("CASE WHEN LOWER(company_name) LIKE LOWER(?) THEN 75 ELSE 0 END")
        
        if 'normalized_title' in available_columns:
            relevance_parts.append("CASE WHEN LOWER(normalized_title) LIKE LOWER(?) THEN 90 ELSE 0 END")
        
        # Use tags if available, otherwise types
        tag_column = 'tags' if 'tags' in available_columns else 'types'
        relevance_parts.append(f"CASE WHEN LOWER({tag_column}) LIKE LOWER(?) THEN 50 ELSE 0 END")
        
        relevance_parts.append("CASE WHEN LOWER(description) LIKE LOWER(?) THEN 25 ELSE 0 END")
        relevance_parts.append("CASE WHEN date_scraped >= date('now', '-7 days') THEN 15 ELSE 0 END")
        
        relevance_score = f"({' + '.join(relevance_parts)}) as relevance_score"
        select_parts.append(relevance_score)
        
        # Build WHERE clause
        where_parts = []
        where_parts.append("LOWER(title) LIKE LOWER(?)")
        where_parts.append("LOWER(company_name) LIKE LOWER(?)")
        where_parts.append("LOWER(snippet) LIKE LOWER(?)")
        where_parts.append("LOWER(description) LIKE LOWER(?)")
        
        if 'normalized_title' in available_columns:
            where_parts.append("LOWER(normalized_title) LIKE LOWER(?)")
        if 'normalized_company' in available_columns:
            where_parts.append("LOWER(normalized_company) LIKE LOWER(?)")
        if 'normalized_description' in available_columns:
            where_parts.append("LOWER(normalized_description) LIKE LOWER(?)")
            
        where_parts.append(f"LOWER({tag_column}) LIKE LOWER(?)")
        
        where_clause = f"WHERE ({' OR '.join(where_parts)})"
    else:
        select_parts.append("0 as relevance_score")
        where_clause = "WHERE 1=1"
    
    query = f"SELECT {', '.join(select_parts)} FROM internships {where_clause}"
    return query

def get_safe_column_value(row, column, fallback=None):
    """Safely get a column value with fallback for missing columns"""
    try:
        if column in row.keys():
            return row[column]
        else:
            return fallback
    except:
        return fallback

# --- Firebase Initialization ---
db = None  # Global variable for Firestore client
subscription_manager = None  # Global variable for subscription manager

def initialize_firebase():
    """
    Initializes the Firebase Admin SDK and the Firestore client.
    This function is called once when the application starts.
    """
    global db, subscription_manager
    try:
        print("🔄 Starting Firebase initialization...")
        
        # Check if Firebase app is already initialized to prevent errors
        if not firebase_admin._apps:
            print("🔄 Firebase not yet initialized, setting up...")
            
            # Option 1: Render deployment (using JSON from environment variable)
            if 'FIREBASE_SERVICE_ACCOUNT_KEY' in os.environ:
                print("🔄 Using FIREBASE_SERVICE_ACCOUNT_KEY from environment...")
                service_account_info = json.loads(os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY'))
                cred = credentials.Certificate(service_account_info)
                firebase_admin.initialize_app(cred)
                print("✅ Firebase initialized successfully from environment variable.")
            # Option 2: Local development (using a file path)
            elif 'GOOGLE_APPLICATION_CREDENTIALS' in os.environ:
                print("🔄 Using GOOGLE_APPLICATION_CREDENTIALS from environment...")
                cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
                firebase_admin.initialize_app(cred)
                print("✅ Firebase initialized successfully from service account file.")
            else:
                print("⚠️ No Firebase credentials found. Continuing without Firebase...")
                db = None
                subscription_manager = None
                return

        print("🔄 Setting up Firestore client...")
        db = firestore.client()
        
        print("🔄 Setting up Subscription Manager...")
        subscription_manager = SubscriptionManager(db)
        
        print("🔄 Setting up Stripe...")
        # Initialize Stripe - disabled since payment functionality is removed
        # stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
        
        print("✅ All services initialized successfully")

    except Exception as e:
        print(f"⚠️ Error initializing Firebase: {e}")
        print(f"Error details: {str(e)}")
        print("⚠️ Continuing without Firebase features...")
        # Don't raise the exception to allow the app to start without Firebase
        db = None
        subscription_manager = None

# Initialize services when the app starts
# This code runs when Gunicorn imports the `app` object
print("🔄 Initializing application services...")

# Initialize database
try:
    # Don't fail startup if database isn't available yet
    # The get_db_connection() function will handle database access during API calls
    print(f"🔍 Database path configured: {INTERNSHIPS_DB_PATH}")
    if os.path.exists(INTERNSHIPS_DB_PATH):
        print("✅ Database file found")
    else:
        print("⚠️ Database file not found at startup - will check again during API calls")
    print("✅ Database initialization successful")
except Exception as e:
    print(f"⚠️ Database initialization failed: {e}")
    print("⚠️ Will attempt to connect during API calls")

# Initialize Firebase
try:
    initialize_firebase()
    print("✅ Firebase initialization successful")
except Exception as e:
    print(f"⚠️ Firebase initialization failed: {e}")
    print("⚠️ App will start without Firebase features")
    db = None
    subscription_manager = None

print("✅ Application services initialized")

# --- Utility Functions ---
def format_timestamp(timestamp):
    """Convert Firestore timestamp to a readable string"""
    if timestamp is None:
        return "Unknown"
    try:
        # Firestore timestamps can be timezone-aware datetime objects
        return timestamp.strftime('%Y-%m-%d %H:%M:%S')
    except Exception as e:
        print(f"Error formatting timestamp: {e}")
        return "Unknown"

def get_firebase_config():
    """Get Firebase configuration from environment variables"""
    return {
        'apiKey': os.getenv('FIREBASE_API_KEY', ''),
        'authDomain': os.getenv('FIREBASE_AUTH_DOMAIN', ''),
        'projectId': os.getenv('FIREBASE_PROJECT_ID', ''),
        'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET', ''),
        'messagingSenderId': os.getenv('FIREBASE_MESSAGING_SENDER_ID', ''),
        'appId': os.getenv('FIREBASE_APP_ID', ''),
        'measurementId': os.getenv('FIREBASE_MEASUREMENT_ID', '')
    }

# --- Authentication Middleware ---
def verify_token():
    """Verify the Firebase ID token from the Authorization header"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        print("❌ No Authorization header or invalid format")
        return None
    
    token = auth_header.split('Bearer ')[1]
    try:
        print(f"🔄 Verifying token: {token[:20]}...")
        decoded_token = auth.verify_id_token(token)
        print(f"✅ Token verified successfully for user: {decoded_token.get('email')}")
        return decoded_token
    except Exception as e:
        print(f"❌ Error verifying token: {e}")
        print(f"❌ Token that failed: {token[:50]}...")
        return None

# --- API Endpoints ---
@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html', firebase_config=get_firebase_config())

@app.route('/filter')
def filter_page():
    """Serve the filter page"""
    return render_template('filter.html', firebase_config=get_firebase_config())

@app.route('/companies')
def companies_page():
    """Serve the companies page"""
    return render_template('companies.html', firebase_config=get_firebase_config())

@app.route('/request')
def request_page():
    """Serve the company request page"""
    return render_template('request.html', firebase_config=get_firebase_config())

@app.route('/settings')
def settings():
    """Serve the settings page"""
    return render_template('settings.html', 
                         stripe_publishable_key=os.getenv('STRIPE_PUBLISHABLE_KEY'),
                         stripe_price_id=os.getenv('STRIPE_PRICE_ID'),
                         firebase_config=get_firebase_config())

@app.route('/tracking')
def tracking():
    """Serve the tracking page"""
    return render_template('tracking.html', firebase_config=get_firebase_config())

@app.route('/debug-auth')
def debug_auth():
    """Debug page for testing authentication without main app complexity"""
    return render_template('debug_auth.html', firebase_config=get_firebase_config())

@app.route('/test-job-actions')
def test_job_actions():
    """Test page for job actions functionality"""
    return render_template('test_job_actions.html', firebase_config=get_firebase_config())

@app.route('/api/auth/verify', methods=['POST'])
def verify_auth():
    """Verify the Firebase ID token and return user info"""
    token = verify_token()
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    return jsonify({
        'uid': token['uid'],
        'email': token.get('email'),
        'name': token.get('name')
    })

@app.route('/api/internships')
def get_internships():
    """Enhanced API endpoint to get internships with advanced search, filtering, and pagination"""
    try:
        start_time = time.time()
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)  # Cap at 100
        search = request.args.get('search', '').strip()
        company = request.args.get('company', '').strip()
        location = request.args.get('location', '').strip()
        position_type_filter = request.args.get('position_type', '').strip()
        tags_filter = request.args.get('tags', '').strip()
        year_filter = request.args.get('year', '').strip()
        semester_filter = request.args.get('semester', '').strip()
        region_param = request.args.get('region', '').strip()
        sort_by = request.args.get('sort_by', 'latest').strip()
        date_filter = request.args.get('date', '').strip()
        show_all_regions = request.args.get('show_all_regions', 'false').lower() == 'true'
        
        # Authentication check
        is_authenticated = False
        has_unlimited_access = False
        subscription_status = None
        
        # Get page offset
        offset = (page - 1) * per_page
        
        # Connect to database
        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database not available'}), 500
            
        cursor = conn.cursor()
        
        # Check if tags column exists for backward compatibility
        cursor.execute("PRAGMA table_info(internships)")
        columns = [column[1] for column in cursor.fetchall()]
        has_tags_column = 'tags' in columns
        
        print(f"❌ No Authorization header or invalid format")
        print(f"Fetching page {page} ({per_page} jobs per page) from SQLite database...")
        
        # Enhanced search with tag-based filtering
        if tags_filter:
            if has_tags_column:
                print(f"🏷️ Filtering by tags: {tags_filter}")
            else:
                print(f"🏷️ Filtering by types (legacy): {tags_filter}")
        
        # Get latest scrape date for highlighting new jobs
        cursor.execute("SELECT MAX(date_scraped) as latest_date FROM internships")
        latest_scrape_result = cursor.fetchone()
        latest_scrape_date = latest_scrape_result['latest_date'] if latest_scrape_result else None
        
        # Build dynamic query with enhanced search capabilities
        params = []
        has_active_search = bool(search or company or location or tags_filter)
        
        # Choose base query based on whether we have tags column
        if has_tags_column:
            base_query = """
                SELECT *, 
                       CASE WHEN LOWER(title) LIKE LOWER(?) OR LOWER(company_name) LIKE LOWER(?) THEN 10 ELSE 0 END +
                       CASE WHEN LOWER(tags) LIKE LOWER(?) THEN 8 ELSE 0 END +
                       CASE WHEN LOWER(snippet) LIKE LOWER(?) THEN 5 ELSE 0 END +
                       CASE WHEN LOWER(description) LIKE LOWER(?) THEN 3 ELSE 0 END as relevance_score
                FROM internships WHERE 
            """
        else:
            # Fallback query for legacy database without tags column
            base_query = """
                SELECT *, 
                       CASE WHEN LOWER(title) LIKE LOWER(?) OR LOWER(company_name) LIKE LOWER(?) THEN 10 ELSE 0 END +
                       CASE WHEN LOWER(types) LIKE LOWER(?) THEN 8 ELSE 0 END +
                       CASE WHEN LOWER(snippet) LIKE LOWER(?) THEN 5 ELSE 0 END +
                       CASE WHEN LOWER(description) LIKE LOWER(?) THEN 3 ELSE 0 END as relevance_score
                FROM internships WHERE 
            """
        
        if has_active_search:
            if has_tags_column:
                # Enhanced search with relevance scoring
                search_param = f"%{search}%" if search else "%"
                base_query += "(LOWER(title) LIKE LOWER(?) OR LOWER(company_name) LIKE LOWER(?) OR LOWER(snippet) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?) OR LOWER(tags) LIKE LOWER(?))"
                params.extend([search_param] * 7)  # 2 for relevance scoring + 5 for search
            else:
                # Legacy search without tags
                search_param = f"%{search}%" if search else "%"
                base_query += "(LOWER(title) LIKE LOWER(?) OR LOWER(company_name) LIKE LOWER(?) OR LOWER(snippet) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?) OR LOWER(types) LIKE LOWER(?))"
                params.extend([search_param] * 7)  # 2 for relevance scoring + 5 for search
        else:
            # No active search - show all with basic relevance
            base_query += "1=1"
            params.extend(["%"] * 5)  # For relevance scoring placeholders
        
        # Add filters
        if company:
            base_query += " AND LOWER(company_name) LIKE LOWER(?)"
            params.append(f"%{company}%")
        
        if location:
            base_query += " AND LOWER(location) LIKE LOWER(?)"
            params.append(f"%{location}%")
        
        if position_type_filter:
            base_query += " AND position_type = ?"
            params.append(position_type_filter)
        
        if tags_filter:
            if has_tags_column:
                base_query += " AND LOWER(tags) LIKE LOWER(?)"
            else:
                # Use types column as fallback
                base_query += " AND LOWER(types) LIKE LOWER(?)"
            params.append(f"%{tags_filter}%")
        
        if year_filter and 'year' in columns:
            base_query += " AND year = ?"
            params.append(int(year_filter))
        
        if semester_filter and 'semester' in columns:
            base_query += " AND LOWER(semester) = LOWER(?)"
            params.append(semester_filter)
        
        # Enhanced date filtering
        if date_filter:
            from datetime import datetime, timedelta
            if date_filter == '24hours':
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                base_query += " AND date_scraped >= ?"
                params.append(yesterday)
            elif date_filter == 'today':
                today = datetime.now().strftime('%Y-%m-%d')
                base_query += " AND date_scraped = ?"
                params.append(today)
            elif date_filter == 'week':
                week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
                base_query += " AND date_scraped >= ?"
                params.append(week_ago)
            elif date_filter == 'month':
                month_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                base_query += " AND date_scraped >= ?"
                params.append(month_ago)
            elif date_filter == 'latest_scrape':
                # Latest scrape only
                if latest_scrape_date:
                    base_query += " AND date_scraped = ?"
                    params.append(latest_scrape_date)
        
        # Apply region filter unless frontend requested all regions
        if region_param and not show_all_regions and 'region' in columns:
            base_query += " AND region = ?"
            params.append(region_param)
        
        # Enhanced ordering based on search context - check for column availability
        if has_active_search and sort_by != 'latest':
            # When actively searching, prioritize relevance but still consider recency
            if 'priority_score' in columns:
                base_query += " ORDER BY relevance_score DESC, date_scraped DESC, COALESCE(priority_score, 0) DESC"
            else:
                base_query += " ORDER BY relevance_score DESC, date_scraped DESC"
        else:
            # Default: latest jobs first for browsing
            order_parts = ["date_scraped DESC"]
            if 'priority_score' in columns:
                order_parts.append("COALESCE(priority_score, 0) DESC")
            if 'year' in columns:
                order_parts.append("year DESC")
            order_parts.append("title ASC")
            base_query += " ORDER BY " + ", ".join(order_parts)
        
        # Add pagination LIMIT and OFFSET
        base_query += " LIMIT ? OFFSET ?"
        params.extend([per_page, offset])
        
        cursor = conn.cursor()
        cursor.execute(base_query, params)
        rows = cursor.fetchall()
        
        # Convert to list of dictionaries with enhanced fields
        all_internships = []
        for row in rows:
            # Parse JSON fields safely
            try:
                types = json.loads(row['types']) if row['types'] else []
            except:
                types = []
            
            # Handle tags based on column availability
            if has_tags_column:
                try:
                    tags = json.loads(row['tags']) if row['tags'] else []
                except:
                    tags = []
            else:
                # Use types as fallback for tags
                tags = types
            
            try:
                role_categories = json.loads(row['role_categories']) if row['role_categories'] else []
            except:
                role_categories = []
            
            try:
                term_periods = json.loads(row['term_periods']) if row['term_periods'] else []
            except:
                term_periods = []
            
            # Check if this job is from latest scrape
            is_newly_scraped = row['date_scraped'] == latest_scrape_date
            
            internship_data = {
                'id': row['id'],
                'title': row['title'],
                'company_name': row['company_name'],
                'location': row['location'],
                'snippet': row['snippet'],
                'description': row['description'],
                'deadline': row['deadline'],
                'posted_date': row['posted_date'],
                'types': types,
                'tags': tags,
                'role_categories': role_categories,
                'term_periods': term_periods,
                'position_type': get_safe_column_value(row, 'position_type'),
                'link': row['application_link'],
                'url': row['source_url'],
                'scraped_at': row['date_scraped'] or 'Unknown',
                'is_newly_scraped': is_newly_scraped,  # NEW: Flag for UI highlighting
                'semester': get_safe_column_value(row, 'semester'),
                'year': get_safe_column_value(row, 'year'),
                'region': get_safe_column_value(row, 'region'),
                'country': get_safe_column_value(row, 'country'),
                'priority_score': get_safe_column_value(row, 'priority_score', 0) or 0,
                'relevance_score': row['relevance_score'] if has_active_search else 0  # NEW: Search relevance
            }
            all_internships.append(internship_data)
        
        # Get total count for pagination - rebuild query to match WHERE conditions exactly
        count_params = []
        count_query = "SELECT COUNT(*) as total FROM internships WHERE "
        
        if has_active_search:
            # For search, add the same WHERE conditions as the main query
            if has_tags_column:
                count_query += "(LOWER(title) LIKE LOWER(?) OR LOWER(company_name) LIKE LOWER(?) OR LOWER(snippet) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?) OR LOWER(tags) LIKE LOWER(?))"
            else:
                count_query += "(LOWER(title) LIKE LOWER(?) OR LOWER(company_name) LIKE LOWER(?) OR LOWER(snippet) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?) OR LOWER(types) LIKE LOWER(?))"
            search_param = f"%{search}%"
            count_params.extend([search_param] * 5)
        else:
            count_query += "1=1"
        
        # Add the same additional filters as main query
        if company:
            count_query += " AND LOWER(company_name) LIKE LOWER(?)"
            count_params.append(f"%{company}%")
        
        if location:
            count_query += " AND LOWER(location) LIKE LOWER(?)"
            count_params.append(f"%{location}%")
        
        # Add other filters that were in the main query
        if position_type_filter:
            count_query += " AND position_type = ?"
            count_params.append(position_type_filter)
        
        if tags_filter:
            if has_tags_column:
                count_query += " AND LOWER(tags) LIKE LOWER(?)"
            else:
                count_query += " AND LOWER(types) LIKE LOWER(?)"
            count_params.append(f"%{tags_filter}%")
        
        if year_filter and 'year' in columns:
            count_query += " AND year = ?"
            count_params.append(int(year_filter))
        
        if semester_filter and 'semester' in columns:
            count_query += " AND LOWER(semester) = LOWER(?)"
            count_params.append(semester_filter)
        
        # Enhanced date filtering for count query
        if date_filter:
            from datetime import datetime, timedelta
            if date_filter == '24hours':
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                count_query += " AND date_scraped >= ?"
                count_params.append(yesterday)
            elif date_filter == 'today':
                today = datetime.now().strftime('%Y-%m-%d')
                count_query += " AND date_scraped = ?"
                count_params.append(today)
            elif date_filter == 'week':
                week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
                count_query += " AND date_scraped >= ?"
                count_params.append(week_ago)
            elif date_filter == 'month':
                month_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                count_query += " AND date_scraped >= ?"
                count_params.append(month_ago)
            elif date_filter == 'latest_scrape':
                if latest_scrape_date:
                    count_query += " AND date_scraped = ?"
                    count_params.append(latest_scrape_date)
        
        # Apply region filter to count query
        if region_param and not show_all_regions and 'region' in columns:
            count_query += " AND region = ?"
            count_params.append(region_param)
        
        cursor.execute(count_query, count_params)
        count_result = cursor.fetchone()
        total_matching = count_result['total'] if count_result else 0
        
        # Calculate pagination info
        total_pages = (total_matching + per_page - 1) // per_page  # Ceiling division
        has_more = page < total_pages
        
        # Get additional metadata for frontend
        cursor.execute("SELECT COUNT(*) as total_in_latest_scrape FROM internships WHERE date_scraped = ?", [latest_scrape_date])
        latest_scrape_count = cursor.fetchone()['total_in_latest_scrape'] if latest_scrape_date else 0
        
        conn.close()
        
        end_time = time.time()
        print(f"✅ Successfully fetched {len(all_internships)} internships (page {page}/{total_pages}) in {end_time - start_time:.2f}s")
        
        return jsonify({
            'internships': all_internships,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_pages': total_pages,
                'total_matching': total_matching,
                'has_more': has_more,
                'showing_count': len(all_internships)
            },
            'metadata': {
                'latest_scrape_date': latest_scrape_date,
                'latest_scrape_count': latest_scrape_count,
                'has_active_search': has_active_search,
                'sort_by': sort_by,
                'has_enhanced_tags': has_tags_column
            },
            'total_count': len(all_internships),
            'total_available': total_matching,
            'is_authenticated': is_authenticated,
            'has_subscription': has_unlimited_access,
            'subscription_status': subscription_status.get('status') if subscription_status else None,
            'execution_time': round(end_time - start_time, 2)
        })
        
    except Exception as e:
        print(f"❌ Error fetching internships: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch internships'}), 500

@app.route('/api/internships/firestore')
def get_internships_firestore():
    """Alternative API endpoint to fetch internships from Firestore (for backup/comparison)"""
    import time
    start_time = time.time()
    
    try:
        if db is None:
            return jsonify({'error': 'Firestore database not initialized'}), 500

        # Verify authentication
        token = verify_token()
        is_authenticated = token is not None

        # All users now have unlimited access - no subscription checks needed
        subscription_status = None
        has_unlimited_access = True  # Everyone gets unlimited access
        limit = 10000  # High limit for all users in Firestore mode

        internships_ref = db.collection('internships')
        
        # EMERGENCY FIX: Ultra-simple query with very small limit
        print(f"Emergency mode: fetching only {min(limit, 100)} internships...")
        
        # Start with tiny limit to avoid timeouts
        emergency_limit = min(limit, 100)
        docs_to_process = list(internships_ref.limit(emergency_limit).stream())
        
        # Convert to list with proper data structure and handle missing fields
        all_internships = []
        for doc in docs_to_process:
            data = doc.to_dict()
            # Handle missing or invalid scraped_at by using a default date
            scraped_at = data.get('scraped_at')
            if scraped_at is None:
                # Use a default timestamp for jobs without scraped_at
                scraped_at = datetime(2020, 1, 1)  # Default date
            
            all_internships.append({
                'id': doc.id,
                'title': data.get('title', 'No Title'),
                'link': data.get('link', '#'),
                'company_name': data.get('company_name', 'Unknown Company'),
                'location': data.get('location', 'Unknown Location'),
                'snippet': data.get('snippet', 'No description available'),
                'deadline': data.get('deadline') or None,
                'source_url': data.get('source_url', '#'),
                'scraped_at': format_timestamp(scraped_at),
                'scraped_at_raw': scraped_at  # Keep raw for sorting
            })
        
        # Sort by scraped_at (newest first), handling both datetime objects and strings
        def sort_key(internship):
            raw_date = internship['scraped_at_raw']
            if hasattr(raw_date, 'timestamp'):
                return raw_date.timestamp()
            elif isinstance(raw_date, str):
                try:
                    return datetime.fromisoformat(raw_date.replace('Z', '+00:00')).timestamp()
                except:
                    return 0  # Default for unparseable dates
            else:
                return 0  # Default for None or other types
        
        # Sort the results
        all_internships.sort(key=sort_key, reverse=True)
        
        # Remove the raw timestamp before returning
        for internship in all_internships:
            del internship['scraped_at_raw']
        
        execution_time = time.time() - start_time
        print(f"Internships API took {execution_time:.2f} seconds")
        
        return jsonify({
            'internships': all_internships,
            'total_returned': len(all_internships),
            'limit_applied': limit,
            'user_authenticated': is_authenticated,
            'subscription_active': bool(has_unlimited_access),
            'execution_time_seconds': round(execution_time, 2)
        })

    except Exception as e:
        print(f"Error fetching internships: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/internships/advanced')
def get_internships_advanced():
    """Enhanced Advanced API endpoint with improved filtering and search"""
    import time
    start_time = time.time()
    
    try:
        # Get database connection
        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database not available'}), 500

        # Check if tags column exists for backward compatibility
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(internships)")
        columns = [column[1] for column in cursor.fetchall()]
        has_tags_column = 'tags' in columns
        
        print(f"🔍 Advanced search mode - tags column exists: {has_tags_column}")

        # Get query parameters
        search = request.args.get('search', '').strip()
        company = request.args.get('company', '').strip()
        location = request.args.get('location', '').strip()
        tags_param = request.args.get('tags', '').strip()  # Comma-separated tags
        role_category = request.args.get('role_category', '').strip()  # Specific role category
        parent_category = request.args.get('parent_category', '').strip()  # Parent category filter
        work_arrangement = request.args.get('work_arrangement', '').strip()  # remote, hybrid, onsite
        education_level = request.args.get('education_level', '').strip()  # undergraduate, graduate, phd
        year_filter = request.args.get('year', '').strip()
        semester_filter = request.args.get('semester', '').strip()
        region_param = request.args.get('region', '').strip()
        show_all_regions = request.args.get('show_all_regions', '').lower() == 'true'
        min_priority = request.args.get('min_priority', '0')  # Minimum priority score
        position_type = request.args.get('position_type', '').strip()  # internship, co_op, fellowship
        limit = request.args.get('limit', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        offset = (page - 1) * per_page
        
        print(f"🔍 Enhanced advanced search: tags={tags_param}, role_category={role_category}, parent_category={parent_category}")
        
        # Build base query with relevance scoring for search - adapt for tags column availability
        if search:
            if has_tags_column:
                base_query = """
                    SELECT id, title, company_name, location, snippet, deadline, posted_date, 
                           types, application_link, source_url, date_scraped, description, 
                           semester, year, region, country, tags, priority_score,
                           normalized_title, normalized_company, normalized_description,
                           (
                               CASE WHEN LOWER(title) LIKE LOWER(?) THEN 100 ELSE 0 END +
                               CASE WHEN LOWER(company_name) LIKE LOWER(?) THEN 75 ELSE 0 END +
                               CASE WHEN LOWER(normalized_title) LIKE LOWER(?) THEN 90 ELSE 0 END +
                               CASE WHEN LOWER(tags) LIKE LOWER(?) THEN 50 ELSE 0 END +
                               CASE WHEN LOWER(description) LIKE LOWER(?) THEN 25 ELSE 0 END +
                               CASE WHEN date_scraped >= date('now', '-7 days') THEN 15 ELSE 0 END
                           ) as relevance_score
                    FROM internships
                    WHERE (
                        LOWER(title) LIKE LOWER(?) OR 
                        LOWER(company_name) LIKE LOWER(?) OR 
                        LOWER(snippet) LIKE LOWER(?) OR 
                        LOWER(description) LIKE LOWER(?) OR
                        LOWER(normalized_title) LIKE LOWER(?) OR
                        LOWER(normalized_company) LIKE LOWER(?) OR
                        LOWER(normalized_description) LIKE LOWER(?) OR
                        LOWER(tags) LIKE LOWER(?)
                    )
                """
                search_param = f"%{search}%"
                params = [search_param] * 13  # 5 for relevance score + 8 for WHERE clause
            else:
                # Fallback query without tags column
                base_query = """
                    SELECT id, title, company_name, location, snippet, deadline, posted_date, 
                           types, application_link, source_url, date_scraped, description, 
                           semester, year, region, country, priority_score,
                           normalized_title, normalized_company, normalized_description,
                           (
                               CASE WHEN LOWER(title) LIKE LOWER(?) THEN 100 ELSE 0 END +
                               CASE WHEN LOWER(company_name) LIKE LOWER(?) THEN 75 ELSE 0 END +
                               CASE WHEN LOWER(normalized_title) LIKE LOWER(?) THEN 90 ELSE 0 END +
                               CASE WHEN LOWER(types) LIKE LOWER(?) THEN 50 ELSE 0 END +
                               CASE WHEN LOWER(description) LIKE LOWER(?) THEN 25 ELSE 0 END +
                               CASE WHEN date_scraped >= date('now', '-7 days') THEN 15 ELSE 0 END
                           ) as relevance_score
                    FROM internships
                    WHERE (
                        LOWER(title) LIKE LOWER(?) OR 
                        LOWER(company_name) LIKE LOWER(?) OR 
                        LOWER(snippet) LIKE LOWER(?) OR 
                        LOWER(description) LIKE LOWER(?) OR
                        LOWER(normalized_title) LIKE LOWER(?) OR
                        LOWER(normalized_company) LIKE LOWER(?) OR
                        LOWER(normalized_description) LIKE LOWER(?) OR
                        LOWER(types) LIKE LOWER(?)
                    )
                """
                search_param = f"%{search}%"
                params = [search_param] * 13  # 5 for relevance score + 8 for WHERE clause
        else:
            if has_tags_column:
                base_query = """
                    SELECT id, title, company_name, location, snippet, deadline, posted_date, 
                           types, application_link, source_url, date_scraped, description, 
                           semester, year, region, country, tags, priority_score,
                           normalized_title, normalized_company, normalized_description,
                           0 as relevance_score
                    FROM internships
                    WHERE 1=1
                """
            else:
                # Fallback query without tags column
                base_query = """
                    SELECT id, title, company_name, location, snippet, deadline, posted_date, 
                           types, application_link, source_url, date_scraped, description, 
                           semester, year, region, country, priority_score,
                           normalized_title, normalized_company, normalized_description,
                           0 as relevance_score
                    FROM internships
                    WHERE 1=1
                """
            params = []
        
        if company:
            base_query += " AND (LOWER(company_name) LIKE LOWER(?) OR LOWER(normalized_company) LIKE LOWER(?))"
            company_param = f"%{company}%"
            params.extend([company_param, company_param])
        
        if location:
            base_query += " AND LOWER(location) LIKE LOWER(?)"
            params.append(f"%{location}%")
        
        # Enhanced tag-based filtering with better precision
        if tags_param:
            tag_list = [tag.strip() for tag in tags_param.split(',') if tag.strip()]
            tag_conditions = []
            
            for tag in tag_list:
                # More precise tag matching - adapt for tags column availability
                if has_tags_column:
                    tag_conditions.append("""(
                        JSON_EXTRACT(tags, '$') LIKE ? OR 
                        LOWER(tags) LIKE LOWER(?) OR 
                        LOWER(types) LIKE LOWER(?)
                    )""")
                    tag_param = f"%{tag}%"
                    params.extend([f'%"{tag}"%', tag_param, tag_param])
                else:
                    # Use types column as fallback
                    tag_conditions.append("LOWER(types) LIKE LOWER(?)")
                    params.append(f"%{tag}%")
            
            if tag_conditions:
                base_query += f" AND ({' AND '.join(tag_conditions)})"
        
        # Parent category filtering with child category expansion
        if parent_category:
            category_mappings = {
                'engineering': ['software_engineering', 'data_science', 'mechanical_engineering', 
                               'electrical_engineering', 'civil_engineering', 'chemical_engineering', 'engineering_general'],
                'business': ['business_analyst', 'consulting', 'product_management', 'marketing', 
                            'operations', 'human_resources'],
                'finance': ['investment_banking', 'finance_general'],
                'technology': ['software_engineering', 'data_science', 'cybersecurity'],
                'research': ['research_development'],
                'design': ['design_ux']
            }
            
            if parent_category.lower() in category_mappings:
                child_categories = category_mappings[parent_category.lower()]
                category_conditions = []
                for child_cat in child_categories:
                    if has_tags_column:
                        category_conditions.append("LOWER(tags) LIKE LOWER(?)")
                    else:
                        category_conditions.append("LOWER(types) LIKE LOWER(?)")
                    params.append(f"%{child_cat}%")
                base_query += f" AND ({' OR '.join(category_conditions)})"
        
        # Specific role category filtering
        if role_category:
            if has_tags_column:
                base_query += " AND LOWER(tags) LIKE LOWER(?)"
            else:
                base_query += " AND LOWER(types) LIKE LOWER(?)"
            params.append(f"%{role_category}%")
        
        # Work arrangement filtering
        if work_arrangement:
            if has_tags_column:
                base_query += " AND LOWER(tags) LIKE LOWER(?)"
            else:
                base_query += " AND LOWER(types) LIKE LOWER(?)"
            params.append(f"%{work_arrangement}%")
        
        # Education level filtering
        if education_level:
            if has_tags_column:
                base_query += " AND LOWER(tags) LIKE LOWER(?)"
            else:
                base_query += " AND LOWER(types) LIKE LOWER(?)"
            params.append(f"%{education_level}%")
        
        # Position type filtering
        if position_type:
            base_query += " AND position_type = ?"
            params.append(position_type)
        
        # Role category filtering (for specific role types)
        if role_category:
            # Define comprehensive role category mappings
            role_mappings = {
                'engineering': [
                    'mechanical_engineering', 'electrical_engineering', 'computer_engineering', 
                    'civil_engineering', 'chemical_engineering', 'aerospace_engineering',
                    'industrial_engineering', 'biomedical_engineering', 'materials_engineering',
                    'environmental_engineering', 'engineering'
                ],
                'software_engineering': [
                    'software_engineering', 'software', 'programming', 'full stack', 'backend',
                    'frontend', 'web development', 'mobile development', 'devops'
                ],
                'data_science': [
                    'data_science', 'data_engineering', 'machine learning', 'artificial intelligence',
                    'analytics', 'data analyst', 'business intelligence'
                ],
                'finance': [
                    'finance', 'investment_banking', 'private_equity', 'consulting',
                    'financial analyst', 'accounting', 'treasury', 'risk management'
                ],
                'business': [
                    'operations', 'business', 'marketing', 'sales', 'product_management',
                    'business development', 'strategy', 'consulting'
                ],
                'research': [
                    'research_development', 'research', 'biotechnology', 'chemistry', 'physics',
                    'laboratory', 'academic research', 'scientific research'
                ],
                'design': [
                    'design', 'ux', 'ui', 'user experience', 'user interface', 'graphic design',
                    'product design', 'visual design'
                ],
                'cybersecurity': [
                    'cybersecurity', 'information security', 'security', 'penetration testing',
                    'network security', 'application security'
                ]
            }
            
            lower_category = role_category.lower()
            if lower_category in role_mappings:
                category_keywords = role_mappings[lower_category]
                category_conditions = []
                
                for keyword in category_keywords:
                    if has_tags_column:
                        category_conditions.append("(LOWER(tags) LIKE LOWER(?) OR LOWER(types) LIKE LOWER(?) OR LOWER(title) LIKE LOWER(?))")
                        keyword_param = f"%{keyword}%"
                        params.extend([keyword_param, keyword_param, keyword_param])
                    else:
                        category_conditions.append("(LOWER(types) LIKE LOWER(?) OR LOWER(title) LIKE LOWER(?))")
                        keyword_param = f"%{keyword}%"
                        params.extend([keyword_param, keyword_param])
                
                if category_conditions:
                    base_query += f" AND ({' OR '.join(category_conditions)})"
        
        # Time-based filtering
        if year_filter:
            base_query += " AND year = ?"
            params.append(int(year_filter))
        
        if semester_filter:
            base_query += " AND LOWER(semester) = LOWER(?)"
            params.append(semester_filter)
        
        # Region filtering
        if region_param and not show_all_regions:
            base_query += " AND region = ?"
            params.append(region_param)
        
        # Priority score filtering
        if min_priority and min_priority.isdigit():
            base_query += " AND COALESCE(priority_score, 0) >= ?"
            params.append(int(min_priority))
        
        # Time-based filtering
        if year_filter:
            base_query += " AND year = ?"
            params.append(int(year_filter))
        
        if semester_filter:
            base_query += " AND LOWER(semester) = LOWER(?)"
            params.append(semester_filter)
        
        # Region filtering
        if region_param and not show_all_regions:
            base_query += " AND region = ?"
            params.append(region_param)
        
        # Priority score filtering
        if min_priority and min_priority.isdigit():
            base_query += " AND COALESCE(priority_score, 0) >= ?"
            params.append(int(min_priority))
        
        # Enhanced ordering with relevance scoring
        if search:
            base_query += " ORDER BY relevance_score DESC, date_scraped DESC, COALESCE(priority_score, 0) DESC"
        else:
            base_query += " ORDER BY date_scraped DESC, COALESCE(priority_score, 0) DESC, year DESC"
        
        # Get total count for pagination (without LIMIT)
        count_query = base_query.replace("SELECT id, title,", "SELECT COUNT(*) as total FROM (SELECT id,")
        if search:
            count_query = re.sub(r'SELECT COUNT\(\*\) as total FROM \(SELECT id,.*? as relevance_score', 'SELECT COUNT(*)', count_query)
        count_query = re.sub(r'ORDER BY.*$', '', count_query).strip()
        if 'FROM (' in count_query:
            count_query += ')'
        
        cursor = conn.cursor()
        cursor.execute(count_query, params)
        total_matching = cursor.fetchone()[0] if 'total' in [col[0] for col in cursor.description] else cursor.fetchone()[0]
        
        # Apply pagination
        base_query += " LIMIT ? OFFSET ?"
        params.extend([per_page, offset])
        
        # Execute main query
        cursor.execute(base_query, params)
        rows = cursor.fetchall()
        
        # Convert to enhanced response format
        internships = []
        for row in rows:
            # Parse JSON fields safely
            types_list = []
            tags_list = []
            try:
                if row['types']:
                    types_list = json.loads(row['types']) if isinstance(row['types'], str) else row['types']
                # Handle tags based on column availability
                if has_tags_column and 'tags' in row.keys() and row['tags']:
                    tags_list = json.loads(row['tags']) if isinstance(row['tags'], str) else row['tags']
                else:
                    # Use types as fallback for tags
                    tags_list = types_list
            except:
                types_list = []
                tags_list = []
            
            internship_data = {
                'id': row['id'],
                'title': row['normalized_title'] or row['title'] or 'No Title',
                'original_title': row['title'],
                'link': row['application_link'] or '#',
                'company_name': row['normalized_company'] or row['company_name'] or 'Unknown Company',
                'original_company': row['company_name'],
                'location': row['location'] or 'Unknown Location',
                'snippet': row['snippet'] or 'No description available',
                'description': row['normalized_description'] or row['description'] or 'No description available',
                'original_description': row['description'],
                'deadline': row['deadline'] or None,
                'posted_date': row['posted_date'] or '',
                'types': types_list,
                'tags': tags_list,
                'all_categories': list(set(types_list + tags_list)),  # Combined unique categories
                'source_url': row['source_url'] or '#',
                'scraped_at': row['date_scraped'] or 'Unknown',
                'semester': row['semester'],
                'year': row['year'],
                'region': row['region'],
                'country': row['country'],
                'priority_score': row['priority_score'] or 0,
                'relevance_score': getattr(row, 'relevance_score', 0) if search else 0
            }
            internships.append(internship_data)
        
        # Get total available for stats
        cursor.execute("SELECT COUNT(*) as total FROM internships")
        total_available = cursor.fetchone()['total']
        
        conn.close()
        
        end_time = time.time()
        print(f"✅ Enhanced advanced search returned {len(internships)}/{total_matching} internships in {end_time - start_time:.2f}s")
        
        return jsonify({
            'success': True,
            'internships': internships,
            'total_results': len(internships),
            'total_matching': total_matching,
            'total_available': total_available,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_pages': (total_matching + per_page - 1) // per_page,
                'has_more': offset + len(internships) < total_matching
            },
            'search_params': {
                'search': search,
                'company': company,
                'location': location,
                'tags': tags_param,
                'role_category': role_category,
                'parent_category': parent_category,
                'work_arrangement': work_arrangement,
                'education_level': education_level,
                'position_type': position_type,
                'year': year_filter,
                'semester': semester_filter,
                'region': region_param,
                'min_priority': min_priority
            },
            'processing_time': round(end_time - start_time, 3)
        })
        
    except Exception as e:
        print(f"❌ Error in advanced search: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch internships'}), 500

@app.route('/api/internships/filter-options')
def get_filter_options():
    """Get comprehensive filter options with counts for enhanced filtering"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database not available'}), 500
        
        cursor = conn.cursor()
        
        # Check if tags column exists for backward compatibility
        cursor.execute("PRAGMA table_info(internships)")
        columns = [column[1] for column in cursor.fetchall()]
        has_tags_column = 'tags' in columns
        
        # Get all tags and count occurrences - adapt for tags column availability
        if has_tags_column:
            cursor.execute("""
                SELECT tags, COUNT(*) as count 
                FROM internships 
                WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'
            """)
        else:
            # Use types column as fallback
            cursor.execute("""
                SELECT types as tags, COUNT(*) as count 
                FROM internships 
                WHERE types IS NOT NULL AND types != '' AND types != '[]'
            """)
        
        tag_counts = {}
        category_counts = {
            'engineering': {},
            'business': {},
            'finance': {},
            'technology': {},
            'research': {},
            'design': {},
            'other': {}
        }
        
        # Category mappings for organization
        category_mappings = {
            'engineering': ['software_engineering', 'data_science', 'mechanical_engineering', 
                           'electrical_engineering', 'civil_engineering', 'chemical_engineering', 'engineering_general'],
            'business': ['business_analyst', 'consulting', 'product_management', 'marketing', 
                        'operations', 'human_resources'],
            'finance': ['investment_banking', 'finance_general'],
            'technology': ['software_engineering', 'data_science', 'cybersecurity'],
            'research': ['research_development'],
            'design': ['design_ux']
        }
        
        # Process tags
        for row in cursor.fetchall():
            try:
                tags = json.loads(row['tags']) if row['tags'] else []
                for tag in tags:
                    if tag and tag != 'other':
                        tag_counts[tag] = tag_counts.get(tag, 0) + row['count']
            except:
                continue
        
        # Organize tags into categories
        for category, tag_list in category_mappings.items():
            for tag in tag_list:
                if tag in tag_counts:
                    category_counts[category][tag] = tag_counts[tag]
        
        # Get position types
        cursor.execute("""
            SELECT position_type, COUNT(*) as count 
            FROM internships 
            WHERE position_type IS NOT NULL 
            GROUP BY position_type
        """)
        position_types = {row['position_type']: row['count'] for row in cursor.fetchall()}
        
        # Get regions
        cursor.execute("""
            SELECT region, COUNT(*) as count 
            FROM internships 
            WHERE region IS NOT NULL 
            GROUP BY region 
            ORDER BY count DESC
        """)
        regions = [{'name': row['region'], 'count': row['count']} for row in cursor.fetchall()]
        
        # Get companies (top 50)
        cursor.execute("""
            SELECT company_name, COUNT(*) as count 
            FROM internships 
            GROUP BY company_name 
            ORDER BY count DESC 
            LIMIT 50
        """)
        companies = [{'name': row['company_name'], 'count': row['count']} for row in cursor.fetchall()]
        
        # Get years
        cursor.execute("""
            SELECT year, COUNT(*) as count 
            FROM internships 
            WHERE year IS NOT NULL 
            GROUP BY year 
            ORDER BY year DESC
        """)
        years = [{'year': row['year'], 'count': row['count']} for row in cursor.fetchall()]
        
        # Work arrangements and education levels
        work_arrangements = []
        education_levels = []
        
        for arrangement in ['remote', 'hybrid', 'onsite']:
            count = tag_counts.get(arrangement, 0)
            if count > 0:
                work_arrangements.append({'name': arrangement, 'count': count})
        
        for level in ['undergraduate', 'graduate', 'phd']:
            count = tag_counts.get(level, 0)
            if count > 0:
                education_levels.append({'name': level, 'count': count})
        
        conn.close()
        
        return jsonify({
            'success': True,
            'categories': {
                category: [{'name': tag, 'display_name': tag.replace('_', ' ').title(), 'count': count} 
                          for tag, count in cat_counts.items()]
                for category, cat_counts in category_counts.items() if cat_counts
            },
            'position_types': [{'name': pos_type, 'count': count} for pos_type, count in position_types.items()],
            'regions': regions,
            'companies': companies,
            'years': years,
            'work_arrangements': work_arrangements,
            'education_levels': education_levels,
            'total_jobs': sum(tag_counts.values()) if tag_counts else 0,
            'stats': {
                'total_categories': len([tag for tag in tag_counts.keys() if tag != 'other']),
                'most_common_category': max(tag_counts.items(), key=lambda x: x[1]) if tag_counts else None
            }
        })
        
    except Exception as e:
        print(f"❌ Error getting filter options: {e}")
        return jsonify({'error': 'Failed to get filter options'}), 500

@app.route('/api/internships/categories')
def get_available_categories():
    """Get all available categories and tags from the database for filtering"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database not available'}), 500
        
        cursor = conn.cursor()
        
        # Check if tags column exists for backward compatibility
        cursor.execute("PRAGMA table_info(internships)")
        columns = [column[1] for column in cursor.fetchall()]
        has_tags_column = 'tags' in columns
        
        # Get all unique tags and types from the database - adapt for tags column availability
        if has_tags_column:
            cursor.execute("""
                SELECT DISTINCT types, tags 
                FROM internships 
                WHERE (types IS NOT NULL AND types != '') OR (tags IS NOT NULL AND tags != '')
            """)
        else:
            # Use types column only
            cursor.execute("""
                SELECT DISTINCT types, types as tags 
                FROM internships 
                WHERE types IS NOT NULL AND types != ''
            """)
        
        all_categories = set()
        role_categories = {
            'engineering': set(),
            'technology': set(),
            'business_finance': set(),
            'research_science': set(),
            'other': set()
        }
        
        temporal_tags = set()
        location_tags = set()
        
        # Engineering keywords for classification
        engineering_keywords = [
            'mechanical', 'electrical', 'civil', 'chemical', 'aerospace', 'industrial',
            'biomedical', 'materials', 'environmental', 'computer engineering', 'hardware'
        ]
        
        technology_keywords = [
            'software', 'programming', 'data', 'ai', 'machine learning', 'cybersecurity',
            'devops', 'product management', 'quality assurance', 'web', 'mobile'
        ]
        
        business_keywords = [
            'finance', 'investment', 'consulting', 'marketing', 'sales', 'operations',
            'business', 'strategy', 'private equity'
        ]
        
        research_keywords = [
            'research', 'biotechnology', 'chemistry', 'physics', 'laboratory', 'scientific'
        ]
        
        for row in cursor.fetchall():
            # Process types field
            if row['types']:
                try:
                    types_list = json.loads(row['types']) if isinstance(row['types'], str) else row['types']
                    for category in types_list:
                        if category and isinstance(category, str):
                            all_categories.add(category)
                            
                            # Classify into role categories
                            cat_lower = category.lower()
                            if any(keyword in cat_lower for keyword in engineering_keywords):
                                role_categories['engineering'].add(category)
                            elif any(keyword in cat_lower for keyword in technology_keywords):
                                role_categories['technology'].add(category)
                            elif any(keyword in cat_lower for keyword in business_keywords):
                                role_categories['business_finance'].add(category)
                            elif any(keyword in cat_lower for keyword in research_keywords):
                                role_categories['research_science'].add(category)
                            else:
                                role_categories['other'].add(category)
                except:
                    pass
            
            # Process tags field - only if the column exists
            if has_tags_column and 'tags' in row.keys() and row['tags']:
                try:
                    tags_list = json.loads(row['tags']) if isinstance(row['tags'], str) else row['tags']
                    for tag in tags_list:
                        if tag and isinstance(tag, str):
                            all_categories.add(tag)
                            
                            # Classify temporal and location tags
                            tag_lower = tag.lower()
                            if any(word in tag_lower for word in ['summer', 'fall', 'spring', 'winter', 'year', '2024', '2025', '2026']):
                                temporal_tags.add(tag)
                            elif any(word in tag_lower for word in ['usa', 'us', 'canada', 'europe', 'asia', 'remote']):
                                location_tags.add(tag)
                            else:
                                # Classify into role categories
                                if any(keyword in tag_lower for keyword in engineering_keywords):
                                    role_categories['engineering'].add(tag)
                                elif any(keyword in tag_lower for keyword in technology_keywords):
                                    role_categories['technology'].add(tag)
                                elif any(keyword in tag_lower for keyword in business_keywords):
                                    role_categories['business_finance'].add(tag)
                                elif any(keyword in tag_lower for keyword in research_keywords):
                                    role_categories['research_science'].add(tag)
                                else:
                                    role_categories['other'].add(tag)
                except:
                    pass
        
        # Get statistics
        cursor.execute("SELECT COUNT(*) as total FROM internships")
        total_count = cursor.fetchone()['total']
        
        # Get enhanced count - adapt for tags column availability
        if has_tags_column:
            cursor.execute("SELECT COUNT(*) as enhanced FROM internships WHERE tags IS NOT NULL AND tags != ''")
            enhanced_count = cursor.fetchone()['enhanced']
        else:
            # Use types column as fallback
            cursor.execute("SELECT COUNT(*) as enhanced FROM internships WHERE types IS NOT NULL AND types != ''")
            enhanced_count = cursor.fetchone()['enhanced']
        
        conn.close()
        
        # Convert sets to sorted lists for JSON serialization
        response_data = {
            'success': True,
            'all_categories': sorted(list(all_categories)),
            'role_categories': {
                'engineering': sorted(list(role_categories['engineering'])),
                'technology': sorted(list(role_categories['technology'])),
                'business_finance': sorted(list(role_categories['business_finance'])),
                'research_science': sorted(list(role_categories['research_science'])),
                'other': sorted(list(role_categories['other']))
            },
            'temporal_tags': sorted(list(temporal_tags)),
            'location_tags': sorted(list(location_tags)),
            'stats': {
                'total_internships': total_count,
                'enhanced_with_tags': enhanced_count,
                'enhancement_percentage': round((enhanced_count / total_count) * 100, 1) if total_count > 0 else 0,
                'total_unique_categories': len(all_categories)
            },
            'quick_filters': {
                'engineering': ['mechanical_engineering', 'electrical_engineering', 'software_engineering', 'civil_engineering'],
                'technology': ['software_engineering', 'data_science', 'cybersecurity', 'product_management'],
                'business': ['finance', 'consulting', 'marketing', 'investment_banking'],
                'research': ['research_development', 'biotechnology', 'chemistry', 'physics']
            }
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Error getting categories: {e}")
        return jsonify({'error': 'Failed to get categories'}), 500

# --- Subscription Routes (Disabled - All Features Now Free) ---
@app.route('/api/subscription/create', methods=['POST'])
def create_subscription():
    """Subscription creation is disabled - all features are now free"""
    return jsonify({'error': 'Subscription functionality has been disabled. All features are now free.'}), 400

@app.route('/api/subscription/status', methods=['GET'])
def get_subscription():
    """Returns free unlimited access for all users"""
    try:
        token = verify_token()
        if not token:
            # Return free unlimited access even for non-authenticated users
            return jsonify({'subscription': {
                'status': 'active',
                'type': 'free_unlimited',
                'price_id': 'free',
                'current_period_end': None,
                'is_early_adopter': False,
                'unlimited_access': True
            }})

        # Return unlimited access for all authenticated users
        status = {
            'status': 'active',
            'type': 'free_unlimited',
            'price_id': 'free',
            'current_period_end': None,
            'is_early_adopter': False,
            'unlimited_access': True
        }
        return jsonify({'subscription': status})

    except Exception as e:
        print(f"Error getting subscription status: {e}")
        return jsonify({'subscription': {
            'status': 'active',
            'type': 'free_unlimited',
            'unlimited_access': True
        }})

@app.route('/api/subscription/cancel', methods=['POST'])
def cancel_subscription():
    """No subscriptions to cancel - all features are free"""
    return jsonify({'success': True, 'message': 'No subscription to cancel. All features are free.'})

@app.route('/api/subscription/webhook', methods=['POST'])
def handle_webhook():
    """Webhook handling disabled - subscriptions are no longer used"""
    return jsonify({'success': True, 'message': 'Webhook handling disabled. Subscriptions are no longer used.'})

@app.route('/api/companies', methods=['GET'])
def get_companies():
    """Get list of companies from SQLite internships database"""
    import time
    start_time = time.time()
    
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database not available'}), 500

        cursor = conn.cursor()
        cursor.execute("""
            SELECT company_name, 
                   COUNT(*) as internship_count,
                   MAX(date_scraped) as last_updated
            FROM internships 
            WHERE company_name IS NOT NULL AND company_name != '' AND company_name != 'Unknown Company'
            GROUP BY company_name 
            ORDER BY internship_count DESC, company_name ASC
        """)
        
        rows = cursor.fetchall()
        companies_list = []
        
        for row in rows:
            companies_list.append({
                'name': row['company_name'],
                'internship_count': row['internship_count'],
                'last_updated': row['last_updated']
            })

        # Also get just the company names for compatibility
        company_names = [company['name'] for company in companies_list]
        
        conn.close()
        
        execution_time = time.time() - start_time
        print(f"Companies API took {execution_time:.2f} seconds")
        
        return jsonify({
            'companies': company_names,  # For compatibility with existing frontend
            'companies_detailed': companies_list,  # Detailed info with counts
            'total_count': len(companies_list),
            'execution_time_seconds': round(execution_time, 2),
            'source': 'SQLite internships database'
        })

    except Exception as e:
        print(f"Error fetching companies: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/create-checkout-session', methods=['POST'])
def create_checkout_session():
    """Checkout sessions are disabled - all features are now free"""
    return jsonify({'error': 'Payment functionality has been disabled. All features are now free.'}), 400

@app.route('/api/company-request', methods=['POST'])
def submit_company_request():
    """Submit a company request"""
    try:
        if db is None:
            return jsonify({'error': 'Database not initialized'}), 500

        data = request.get_json()
        if not data or 'company_name' not in data:
            return jsonify({'error': 'Missing company name'}), 400

        # Optional: Get user info if authenticated
        token = verify_token()
        user_id = token['uid'] if token else None

        # Store the company request (simplified)
        company_request = {
            'company_name': data.get('company_name'),
            'company_website': data.get('company_website', ''),
            'user_id': user_id,
            'submitted_at': firestore.SERVER_TIMESTAMP,
            'status': 'pending'
        }

        db.collection('company_requests').add(company_request)
        
        return jsonify({'success': True, 'message': 'Company request submitted successfully'})

    except Exception as e:
        print(f"Error submitting company request: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/category-counts')
def get_category_counts():
    """Get job counts by category from SQLite internships database"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database not available'}), 500

        cursor = conn.cursor()
        
        # Define category mappings - these should match job types/titles in the database
        category_patterns = {
            'technology': ['software', 'engineering', 'tech', 'developer', 'data science', 'data scientist', 'ai', 'machine learning', 'cybersecurity', 'it', 'programmer', 'coding', 'web', 'mobile', 'fullstack', 'frontend', 'backend'],
            'business': ['business', 'finance', 'consulting', 'investment', 'banking', 'strategy', 'analyst', 'operations', 'management', 'sales', 'marketing', 'accounting'],
            'research': ['research', 'science', 'laboratory', 'academic', 'analytics', 'statistics', 'phd', 'graduate'],
            'policy': ['policy', 'government', 'public', 'legal', 'law', 'politics', 'advocacy', 'nonprofit'],
            'creative': ['design', 'creative', 'ux', 'ui', 'graphic', 'marketing', 'content', 'media', 'advertising', 'brand'],
            'engineering': ['mechanical', 'civil', 'electrical', 'chemical', 'aerospace', 'automotive', 'manufacturing', 'hardware']
        }
        
        category_counts = {}
        
        for category, patterns in category_patterns.items():
            # Create LIKE conditions for each pattern
            like_conditions = []
            params = []
            
            for pattern in patterns:
                like_conditions.append("(LOWER(title) LIKE ? OR LOWER(types) LIKE ? OR LOWER(snippet) LIKE ?)")
                params.extend([f'%{pattern}%', f'%{pattern}%', f'%{pattern}%'])
            
            # Combine all conditions with OR
            where_clause = " OR ".join(like_conditions)
            
            query = f"""
                SELECT COUNT(*) as count 
                FROM internships 
                WHERE {where_clause}
            """
            
            cursor.execute(query, params)
            result = cursor.fetchone()
            category_counts[category] = result['count'] if result else 0
        
        conn.close()
        
        return jsonify({
            'category_counts': category_counts,
            'success': True
        })

    except Exception as e:
        print(f"Error fetching category counts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats')
def get_stats():
    """Get database statistics from SQLite internships database"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database not available'}), 500

        cursor = conn.cursor()
        
        # Get total count
        cursor.execute("SELECT COUNT(*) as total FROM internships")
        total_count = cursor.fetchone()['total']
        
        # Get unique companies count (all time)
        cursor.execute("""
            SELECT COUNT(DISTINCT company_name) as unique_companies 
            FROM internships 
            WHERE company_name IS NOT NULL AND company_name != '' AND company_name != 'Unknown Company'
        """)
        unique_companies = cursor.fetchone()['unique_companies']
        
        # Get companies with jobs scraped in the last 24 hours for "new today"
        cursor.execute("""
            SELECT COUNT(DISTINCT company_name) as companies_updated_today
            FROM internships 
            WHERE company_name IS NOT NULL AND company_name != '' AND company_name != 'Unknown Company'
            AND date_scraped >= date('now', '-1 day')
        """)
        companies_updated_today = cursor.fetchone()['companies_updated_today']
        
        # Get jobs scraped in the last 24 hours
        cursor.execute("""
            SELECT COUNT(*) as jobs_added_today
            FROM internships 
            WHERE date_scraped >= date('now', '-1 day')
        """)
        jobs_added_today = cursor.fetchone()['jobs_added_today']
        
        # Get unique locations count
        cursor.execute("""
            SELECT COUNT(DISTINCT location) as unique_locations 
            FROM internships 
            WHERE location IS NOT NULL AND location != '' AND location != 'Unknown Location'
        """)
        unique_locations = cursor.fetchone()['unique_locations']
        
        # Get records by date_scraped
        cursor.execute("""
            SELECT date_scraped, COUNT(*) as count 
            FROM internships 
            GROUP BY date_scraped 
            ORDER BY date_scraped DESC 
            LIMIT 10
        """)
        recent_scrapes = [{'date': row['date_scraped'], 'count': row['count']} for row in cursor.fetchall()]
        
        # Get top companies by internship count
        cursor.execute("""
            SELECT company_name, COUNT(*) as count 
            FROM internships 
            WHERE company_name IS NOT NULL AND company_name != '' AND company_name != 'Unknown Company'
            GROUP BY company_name 
            ORDER BY count DESC 
            LIMIT 10
        """)
        top_companies = [{'company': row['company_name'], 'count': row['count']} for row in cursor.fetchall()]
        
        # Get records with missing fields
        cursor.execute("""
            SELECT 
                COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) as missing_description,
                COUNT(CASE WHEN location IS NULL OR location = '' OR location = 'Unknown Location' THEN 1 END) as missing_location,
                COUNT(CASE WHEN deadline IS NULL OR deadline = '' THEN 1 END) as missing_deadline,
                COUNT(CASE WHEN posted_date IS NULL OR posted_date = '' THEN 1 END) as missing_posted_date
            FROM internships
        """)
        data_quality = cursor.fetchone()
        
        conn.close()
        
        return jsonify({
            'total_internships': total_count,
            'unique_companies': unique_companies,
            'companies_updated_today': companies_updated_today,
            'jobs_added_today': jobs_added_today,
            'unique_locations': unique_locations,
            'recent_scrapes': recent_scrapes,
            'top_companies': top_companies,
            'data_quality': {
                'missing_description': data_quality['missing_description'],
                'missing_location': data_quality['missing_location'],
                'missing_deadline': data_quality['missing_deadline'],
                'missing_posted_date': data_quality['missing_posted_date'],
                'total_records': total_count
            },
            'source': 'SQLite internships database'
        })

    except Exception as e:
        print(f"Error fetching stats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/test-checkout', methods=['POST'])
def test_checkout():
    """Test checkout is disabled - all features are now free"""
    return jsonify({'error': 'Payment functionality has been disabled. All features are now free.'}), 400

@app.route('/api/health')
def health_check():
    """Health check endpoint that verifies SQLite database connectivity"""
    try:
        # Check SQLite database connection
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM internships")
            count = cursor.fetchone()[0]
            conn.close()
            
            return jsonify({
                'status': 'healthy',
                'database': 'connected',
                'database_type': 'sqlite',
                'internships_count': count,
                'database_path': INTERNSHIPS_DB_PATH,
                'is_production': os.getenv('RENDER') == 'true',
                'render_service_id': os.getenv('RENDER_SERVICE_ID', 'Not set'),
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'status': 'unhealthy', 
                'database': 'disconnected',
                'database_path': INTERNSHIPS_DB_PATH,
                'error': 'Could not connect to SQLite database'
            }), 500
    except Exception as e:
        return jsonify({
            'status': 'unhealthy', 
            'database': 'error',
            'database_path': INTERNSHIPS_DB_PATH,
            'error': str(e)
        }), 500

# Removed manual deployment endpoint to simplify the app

@app.route('/api/debug/env')
def debug_env():
    """Debug endpoint to check environment variables"""
    return jsonify({
        'STRIPE_PRICE_ID_FOREVER': os.getenv('STRIPE_PRICE_ID_FOREVER'),
        'STRIPE_FOREVER_PRICE_ID': os.getenv('STRIPE_FOREVER_PRICE_ID'),
        'STRIPE_PRICE_ID_MONTHLY': os.getenv('STRIPE_PRICE_ID_MONTHLY'),
        'STRIPE_PRO_MONTHLY_PRICE_ID': os.getenv('STRIPE_PRO_MONTHLY_PRICE_ID'),
        'STRIPE_PRICE_ID': os.getenv('STRIPE_PRICE_ID'),
        'STRIPE_PUBLISHABLE_KEY': os.getenv('STRIPE_PUBLISHABLE_KEY', 'Not set')[:20] + '...' if os.getenv('STRIPE_PUBLISHABLE_KEY') else 'Not set',
        'STRIPE_SECRET_KEY': 'Set' if os.getenv('STRIPE_SECRET_KEY') else 'Not set'
    })

@app.route('/robots.txt')
def robots_txt():
    content = 'User-agent: *\nAllow: /\nSitemap: ' + request.url_root.rstrip('/') + '/sitemap.xml\n'
    return content, 200, {'Content-Type': 'text/plain'}

@app.route('/sitemap.xml')
def sitemap_xml():
    # Static URLs
    static_urls = [
        '/', '/filter', '/companies', '/request', '/settings', '/tracking'
    ]
    # Dynamic job URLs
    conn = get_db_connection()
    jobs = []
    if conn:
        try:
            jobs = conn.execute('SELECT job_id FROM internships').fetchall()
        except Exception as e:
            print(f"Error fetching jobs for sitemap: {e}")
        finally:
            conn.close()
    # Build XML
    urlset = ET.Element('urlset', xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for url in static_urls:
        loc = request.url_root.rstrip('/') + url
        url_el = ET.SubElement(urlset, 'url')
        ET.SubElement(url_el, 'loc').text = loc
    for job in jobs:
        loc = request.url_root.rstrip('/') + '/job/' + str(job['job_id'])
        url_el = ET.SubElement(urlset, 'url')
        ET.SubElement(url_el, 'loc').text = loc
    xml_str = ET.tostring(urlset, encoding='utf-8', method='xml')
    return xml_str, 200, {'Content-Type': 'application/xml'}

@app.route('/job/<job_id>')
def job_detail(job_id):
    conn = get_db_connection()
    job = None
    if conn:
        try:
            job = conn.execute('SELECT * FROM internships WHERE id = ?', (job_id,)).fetchone()
        except Exception as e:
            print(f"Error fetching job {job_id}: {e}")
        finally:
            conn.close()
    if not job:
        return render_template('404.html'), 404
    # Build JSON-LD structured data
    job_posting_jsonld = {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": job['title'],
        "description": job['description'] or job['snippet'] or '',
        "datePosted": job['posted_date'] or '',
        "validThrough": job['deadline'] or '',
        "employmentType": job['types'] or 'Internship',
        "hiringOrganization": {
            "@type": "Organization",
            "name": job['company_name'],
        },
        "jobLocation": {
            "@type": "Place",
            "address": job['location'] or ''
        },
        "identifier": {
            "@type": "PropertyValue",
            "name": job['company_name'],
            "value": job['id']
        },
        "url": request.url,
        "applicationUrl": job['application_link']
    }
    return render_template('job_detail.html', job=job, job_posting_jsonld=json.dumps(job_posting_jsonld, ensure_ascii=False), firebase_config=get_firebase_config()), 200

@app.route('/api/job/<job_id>')
def get_job_by_id(job_id):
    """API endpoint to fetch a single job by ID (no authentication required)"""
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'Database not available'}), 500
    
    try:
        job = conn.execute('SELECT * FROM internships WHERE id = ?', (job_id,)).fetchone()
        if job is None:
            return jsonify({'error': 'Job not found'}), 404
        
        # Convert row to dictionary
        job_dict = dict(job)
        
        return jsonify({
            'success': True,
            'job': job_dict
        })
    except Exception as e:
        print(f"❌ Error fetching job by ID: {e}")
        return jsonify({'error': 'Error fetching job'}), 500
    finally:
        conn.close()

@app.route('/api/applications/status', methods=['GET'])
def get_applications_status():
    """Get the user's application tracking status"""
    print("🔄 Application status endpoint called")
    
    if not db:
        print("❌ Firebase not configured")
        return jsonify({'error': 'Firebase not configured'}), 500
    
    token = verify_token()
    if not token:
        print("❌ Token verification failed")
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        user_id = token['uid']
        print(f"👤 Getting application status for user: {user_id}")
        
        # Get user's applications from Firestore
        user_doc = db.collection('users').document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            applications = user_data.get('applications', {})
            saved_jobs = user_data.get('saved_jobs', {})
            print(f"✅ Found user data: {len(applications)} applications, {len(saved_jobs)} saved jobs")
        else:
            applications = {}
            saved_jobs = {}
            print("ℹ️ No user document found, returning empty data")
        
        response_data = {
            'applications': applications,
            'saved_jobs': saved_jobs,
            'total_applications': len(applications),
            'total_saved': len(saved_jobs)
        }
        
        print(f"📤 Returning: {len(applications)} applications, {len(saved_jobs)} saved jobs")
        return jsonify(response_data)
    
    except Exception as e:
        print(f"❌ Error getting application status: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to get application status'}), 500

@app.route('/api/applications/mark', methods=['POST'])
def mark_application():
    """Mark a job as applied to or saved"""
    if not db:
        return jsonify({'error': 'Firebase not configured'}), 500
    
    token = verify_token()
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        if not data or 'job_id' not in data:
            return jsonify({'error': 'job_id is required'}), 400
        
        user_id = token['uid']
        job_id = str(data['job_id'])
        status = data.get('status', 'applied')  # 'applied', 'saved', 'interview', 'offer', 'rejected'
        
        # Get job details from the database
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        try:
            job = conn.execute('SELECT * FROM internships WHERE id = ?', (job_id,)).fetchone()
            if not job:
                return jsonify({'error': 'Job not found'}), 404
            
            # Prepare application/saved job data
            job_data = {
                'job_id': job_id,
                'job_title': job['title'],
                'company_name': job['company_name'],
                'location': job['location'],
                'added_at': datetime.now().isoformat(),
                'application_link': job.get('application_link', ''),
                'link': job.get('link', ''),
                'url': job.get('url', ''),
                'snippet': job.get('snippet', ''),
                'description': job.get('description', ''),
                'status': status
            }
            
            # Update user's data in Firestore
            user_ref = db.collection('users').document(user_id)
            
            if status == 'applied':
                job_data['applied_at'] = datetime.now().isoformat()
                user_ref.set({
                    f'applications.{job_id}': job_data
                }, merge=True)
            elif status == 'saved':
                job_data['saved_at'] = datetime.now().isoformat()
                user_ref.set({
                    f'saved_jobs.{job_id}': job_data
                }, merge=True)
            elif status in ['interview', 'offer', 'rejected']:
                job_data[f'{status}_at'] = datetime.now().isoformat()
                user_ref.set({
                    f'applications.{job_id}': job_data
                }, merge=True)
            
            return jsonify({
                'success': True,
                'message': f'Job {status} successfully',
                'job': job_data
            })
            
        finally:
            conn.close()
    
    except Exception as e:
        print(f"Error marking job: {e}")
        return jsonify({'error': f'Failed to mark job as {status}'}), 500

@app.route('/api/applications/save', methods=['POST'])
def save_job():
    """Save a job for later application"""
    print("🔄 Save job endpoint called")
    
    if not db:
        print("❌ Firebase not configured")
        return jsonify({'error': 'Firebase not configured'}), 500
    
    token = verify_token()
    if not token:
        print("❌ Token verification failed")
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        print(f"📝 Request data: {data}")
        
        if not data or 'job_id' not in data:
            print("❌ Missing job_id in request")
            return jsonify({'error': 'job_id is required'}), 400
        
        user_id = token['uid']
        job_id = str(data['job_id'])
        print(f"👤 User: {user_id}, Job: {job_id}")
        
        # Get job details from the database
        conn = get_db_connection()
        if not conn:
            print("❌ Database connection failed")
            return jsonify({'error': 'Database connection failed'}), 500
        
        try:
            job = conn.execute('SELECT * FROM internships WHERE id = ?', (job_id,)).fetchone()
            if not job:
                print(f"❌ Job {job_id} not found in database")
                return jsonify({'error': 'Job not found'}), 404
            
            print(f"✅ Found job: {job['title']} at {job['company_name']}")
            
            # Prepare saved job data
            saved_job_data = {
                'job_id': job_id,
                'job_title': job['title'],
                'company_name': job['company_name'],
                'location': job['location'],
                'saved_at': datetime.now().isoformat(),
                'application_link': job.get('application_link', ''),
                'link': job.get('link', ''),
                'url': job.get('url', ''),
                'snippet': job.get('snippet', ''),
                'description': job.get('description', ''),
                'deadline': job.get('deadline', ''),
                'status': 'saved'
            }
            
            # Update user's saved jobs in Firestore
            user_ref = db.collection('users').document(user_id)
            user_ref.set({
                f'saved_jobs.{job_id}': saved_job_data
            }, merge=True)
            
            print(f"✅ Job {job_id} saved successfully for user {user_id}")
            return jsonify({
                'success': True,
                'message': 'Job saved successfully',
                'job': saved_job_data
            })
            
        finally:
            conn.close()
    
    except Exception as e:
        print(f"❌ Error saving job: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to save job'}), 500

@app.route('/api/applications/unsave', methods=['POST'])
def unsave_job():
    """Remove a job from saved jobs"""
    print("🔄 Unsave job endpoint called")
    
    if not db:
        print("❌ Firebase not configured")
        return jsonify({'error': 'Firebase not configured'}), 500
    
    token = verify_token()
    if not token:
        print("❌ Token verification failed")
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        print(f"📝 Request data: {data}")
        
        if not data or 'job_id' not in data:
            print("❌ Missing job_id in request")
            return jsonify({'error': 'job_id is required'}), 400
        
        user_id = token['uid']
        job_id = str(data['job_id'])
        print(f"👤 User: {user_id}, Unsaving Job: {job_id}")
        
        # Remove saved job from user's Firestore document
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            f'saved_jobs.{job_id}': firestore.DELETE_FIELD
        })
        
        print(f"✅ Job {job_id} unsaved successfully for user {user_id}")
        return jsonify({
            'success': True,
            'message': 'Job removed from saved jobs'
        })
    
    except Exception as e:
        print(f"❌ Error removing saved job: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to remove saved job'}), 500

@app.route('/api/applications/track-click', methods=['POST'])
def track_job_click():
    """Track when a user clicks on a job application link"""
    if not db:
        return jsonify({'error': 'Firebase not configured'}), 500
    
    token = verify_token()
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        if not data or 'job_id' not in data:
            return jsonify({'error': 'job_id is required'}), 400
        
        user_id = token['uid']
        job_id = str(data['job_id'])
        
        # Get job details
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        try:
            job = conn.execute('SELECT * FROM internships WHERE id = ?', (job_id,)).fetchone()
            if not job:
                return jsonify({'error': 'Job not found'}), 404
            
            # Add to pending applications for later prompt
            pending_job = {
                'job_id': job_id,
                'job_title': job['title'],
                'company_name': job['company_name'],
                'location': job['location'],
                'clicked_at': datetime.now().isoformat(),
                'application_link': job.get('application_link', ''),
                'link': job.get('link', ''),
                'url': job.get('url', ''),
            }
            
            # Store in pending applications
            user_ref = db.collection('users').document(user_id)
            user_ref.set({
                f'pending_applications.{job_id}': pending_job
            }, merge=True)
            
            return jsonify({
                'success': True,
                'message': 'Job click tracked'
            })
            
        finally:
            conn.close()
    
    except Exception as e:
        print(f"Error tracking job click: {e}")
        return jsonify({'error': 'Failed to track job click'}), 500

@app.route('/api/applications/pending', methods=['GET'])
def get_pending_applications():
    """Get applications that are pending to be marked"""
    if not db:
        return jsonify({'error': 'Firebase not configured'}), 500
    
    token = verify_token()
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        user_id = token['uid']
        
        # Get user's pending applications from Firestore
        user_doc = db.collection('users').document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            pending_applications = user_data.get('pending_applications', {})
            # Convert to list format expected by frontend
            pending_jobs = list(pending_applications.values())
        else:
            pending_jobs = []
        
        return jsonify({
            'pending_jobs': pending_jobs,
            'count': len(pending_jobs)
        })
    
    except Exception as e:
        print(f"Error getting pending applications: {e}")
        return jsonify({'error': 'Failed to get pending applications'}), 500

@app.route('/api/applications/clear-pending', methods=['POST'])
def clear_pending_application():
    """Clear a specific pending application"""
    if not db:
        return jsonify({'error': 'Firebase not configured'}), 500
    
    token = verify_token()
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        if not data or 'job_id' not in data:
            return jsonify({'error': 'job_id is required'}), 400
        
        user_id = token['uid']
        job_id = str(data['job_id'])
        
        # Remove from pending applications
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            f'pending_applications.{job_id}': firestore.DELETE_FIELD
        })
        
        return jsonify({
            'success': True,
            'message': 'Pending application cleared'
        })
    
    except Exception as e:
        print(f"Error clearing pending application: {e}")
        return jsonify({'error': 'Failed to clear pending application'}), 500

# Setup smart filter routes
setup_smart_filter_routes(app, INTERNSHIPS_DB_PATH)

# --- Error Handlers ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500

def find_available_port(start_port=5002):
    """Find an available port starting from the given port number"""
    import socket
    
    for port in range(start_port, start_port + 100):  # Try 100 ports
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.bind(('', port))
                return port
        except OSError:
            continue
    
    # If no port found in range, fall back to any available port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(('', 0))
        return sock.getsockname()[1]

@app.route('/api/filters/smart')
def get_smart_filter_options():
    """Get smart filter options based on actual tags in database with counts"""
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database not available'}), 500
        
        cursor = conn.cursor()
        
        # Check if tags column exists
        cursor.execute("PRAGMA table_info(internships)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'tags' in columns:
            # Get all jobs with their tags
            cursor.execute("""
                SELECT tags, COUNT(*) as job_count
                FROM internships 
                WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'
                GROUP BY tags
            """)
        else:
            # Fallback for legacy database - use types instead
            cursor.execute("""
                SELECT types as tags, COUNT(*) as job_count
                FROM internships 
                WHERE types IS NOT NULL AND types != '' AND types != '[]'
                GROUP BY types
            """)
        
        # Organize tags by category
        filter_options = {
            'role_types': {},
            'time_periods': {},
            'work_arrangements': {},
            'company_sizes': {},
            'education_levels': {},
            'skills': {},
            'industries': {}
        }
        
        # Define tag categories for organization
        role_keywords = [
            'software_engineering', 'data_science', 'mechanical_engineering', 'electrical_engineering',
            'consulting', 'marketing', 'finance', 'business_analyst', 'product_management',
            'cybersecurity', 'civil_engineering', 'aerospace_engineering', 'research'
        ]
        
        time_keywords = ['summer', 'fall', 'spring', 'winter', 'full_year', 'short_term', 'medium_term', 'long_term']
        work_keywords = ['remote', 'hybrid', 'onsite']
        size_keywords = ['startup', 'mid_size', 'large_enterprise']
        education_keywords = ['undergraduate', 'graduate', 'phd', 'mba']
        
        total_tags_processed = 0
        
        # Process each tag group
        for row in cursor.fetchall():
            try:
                # Handle both new tags format and legacy types format
                raw_tags = row['tags'] if row['tags'] else []
                job_count = row['job_count']
                
                # Parse tags (could be JSON array or simple string)
                if isinstance(raw_tags, str):
                    try:
                        tags = json.loads(raw_tags) if raw_tags.startswith('[') else [raw_tags]
                    except json.JSONDecodeError:
                        tags = [raw_tags]
                else:
                    tags = raw_tags if isinstance(raw_tags, list) else [str(raw_tags)]
                
                for tag in tags:
                    if not tag or tag in ['other', 'unknown', 'null']:
                        continue
                        
                    tag_lower = str(tag).lower()
                    total_tags_processed += job_count
                    
                    # Categorize tag
                    if any(keyword in tag_lower for keyword in role_keywords) or 'engineering' in tag_lower:
                        filter_options['role_types'][tag] = filter_options['role_types'].get(tag, 0) + job_count
                    elif any(keyword in tag_lower for keyword in time_keywords) or any(year in str(tag) for year in ['2024', '2025', '2026']):
                        filter_options['time_periods'][tag] = filter_options['time_periods'].get(tag, 0) + job_count
                    elif any(keyword in tag_lower for keyword in work_keywords):
                        filter_options['work_arrangements'][tag] = filter_options['work_arrangements'].get(tag, 0) + job_count
                    elif any(keyword in tag_lower for keyword in size_keywords):
                        filter_options['company_sizes'][tag] = filter_options['company_sizes'].get(tag, 0) + job_count
                    elif any(keyword in tag_lower for keyword in education_keywords):
                        filter_options['education_levels'][tag] = filter_options['education_levels'].get(tag, 0) + job_count
                    elif len(str(tag)) > 2 and not str(tag).isdigit():  # Skills and other meaningful tags
                        filter_options['skills'][tag] = filter_options['skills'].get(tag, 0) + job_count
                        
            except (json.JSONDecodeError, TypeError, AttributeError):
                continue
        
        # Sort each category by count (descending) and limit to top options
        for category in filter_options:
            filter_options[category] = dict(
                sorted(filter_options[category].items(), key=lambda x: x[1], reverse=True)[:15]
            )
        
        # Get overall stats
        cursor.execute("SELECT COUNT(*) as total_jobs FROM internships")
        total_jobs = cursor.fetchone()['total_jobs']
        
        cursor.execute("SELECT COUNT(*) as tagged_jobs FROM internships WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'")
        tagged_jobs = cursor.fetchone()['tagged_jobs']
        
        return jsonify({
            'success': True,
            'filter_options': filter_options,
            'stats': {
                'total_jobs': total_jobs,
                'tagged_jobs': tagged_jobs,
                'coverage_percentage': round((tagged_jobs / total_jobs) * 100, 1) if total_jobs > 0 else 0
            }
        })
        
    except Exception as e:
        print(f"Error getting smart filter options: {e}")
        return jsonify({
            'error': 'Failed to get filter options',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    # Find an available port
    port = find_available_port(5002)
    print(f"🚀 Starting JobDrop server on port {port}...")
    
    # Run the Flask app directly
    app.run(host='0.0.0.0', port=port, debug=True)