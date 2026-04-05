import os
import sqlite3
import time
import json
import hashlib
import re
from datetime import datetime
from urllib.parse import urlparse, urljoin

import google.generativeai as genai
from dotenv import load_dotenv
from rich.console import Console
from bs4 import BeautifulSoup

# Selenium Imports
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# --- 1. CONFIGURATION ---
DB_NAME = "internships.db"
COMPANIES_FILE = "companies.txt"
load_dotenv()

# Scraping Behavior
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 InsightIntern/2.5'
POLITENESS_DELAY = 2
MAX_PAGES_PER_SITE = 10
DRIVER_RECREATION_INTERVAL = 20  # Recreate driver every N sites to prevent session issues

# Selenium Configuration
# **IMPROVEMENT**: Increased timeout for slow-loading sites
SELENIUM_PAGE_LOAD_TIMEOUT = 90

# Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LLM_MODEL_NAME = 'gemini-1.5-flash-latest'
LLM_MAX_HTML_INPUT_LENGTH = 500000

# Internship Type Categories
INTERNSHIP_TYPE_CATEGORIES = [
    "Software Engineering", "Data Science", "Data Analyst", "Product Management",
    "UX/UI Design", "Marketing", "Sales", "Business Development", "Consulting",
    "Investment Banking", "Finance", "Policy", "Research", "Operations",
    "Human Resources", "Legal", "Hardware Engineering", "Mechanical Engineering",
    "Project Management", "Business Analyst", "Other"
]

# Enhanced comprehensive tagging system
COMPREHENSIVE_ROLE_CATEGORIES = {
    # Engineering Disciplines
    'engineering': {
        'mechanical_engineering': [
            'Mechanical Engineering', 'Mechanical Engineer', 'ME Intern', 'Mechanical Design',
            'CAD Design', 'SolidWorks', 'AutoCAD', 'Mechanical Systems', 'HVAC', 'Thermodynamics',
            'Fluid Mechanics', 'Manufacturing Engineering', 'Product Design', 'Mechanical Testing',
            'Stress Analysis', 'Finite Element Analysis', 'FEA', 'Process Engineering',
            'Equipment Design', 'Robotics Engineering', 'Automation Engineering'
        ],
        'electrical_engineering': [
            'Electrical Engineering', 'Electrical Engineer', 'EE Intern', 'Electronics',
            'Circuit Design', 'Power Systems', 'Control Systems', 'Signal Processing',
            'Embedded Systems', 'FPGA', 'PCB Design', 'Analog Design', 'Digital Design',
            'Power Electronics', 'RF Engineering', 'Telecommunications', 'Instrumentation'
        ],
        'computer_engineering': [
            'Computer Engineering', 'Computer Engineer', 'Hardware Engineering', 'VLSI',
            'Chip Design', 'Microprocessor', 'Computer Architecture', 'Digital Systems',
            'Hardware Software Integration', 'Embedded Programming'
        ],
        'civil_engineering': [
            'Civil Engineering', 'Civil Engineer', 'Structural Engineering', 'Construction',
            'Infrastructure', 'Transportation Engineering', 'Environmental Engineering',
            'Geotechnical Engineering', 'Water Resources', 'Construction Management',
            'Urban Planning', 'Surveying', 'Concrete', 'Steel Structures'
        ],
        'chemical_engineering': [
            'Chemical Engineering', 'Chemical Engineer', 'Process Engineering', 'Chemical Process',
            'Reactor Design', 'Separation Processes', 'Mass Transfer', 'Heat Transfer',
            'Process Control', 'Chemical Plant', 'Petrochemical', 'Pharmaceutical Engineering',
            'Bioprocess Engineering', 'Materials Processing'
        ],
        'aerospace_engineering': [
            'Aerospace Engineering', 'Aerospace Engineer', 'Aeronautical Engineering',
            'Astronautical Engineering', 'Aircraft Design', 'Spacecraft', 'Propulsion',
            'Aerodynamics', 'Flight Systems', 'Avionics', 'Satellite', 'Rocket',
            'Defense Engineering', 'Space Systems'
        ],
        'biomedical_engineering': [
            'Biomedical Engineering', 'Biomedical Engineer', 'Medical Device', 'Biomechanics',
            'Biotechnology', 'Medical Equipment', 'Prosthetics', 'Bioinformatics',
            'Clinical Engineering', 'Regulatory Affairs', 'FDA', 'Medical Technology'
        ],
        'industrial_engineering': [
            'Industrial Engineering', 'Industrial Engineer', 'Operations Research',
            'Supply Chain', 'Logistics', 'Quality Engineering', 'Six Sigma', 'Lean Manufacturing',
            'Process Optimization', 'Systems Engineering', 'Production Engineering',
            'Manufacturing Systems', 'Operations Management'
        ]
    },
    
    # Technology Roles
    'technology': {
        'software_engineering': [
            'Software Engineering', 'Software Engineer', 'Software Development', 'Programming',
            'Full Stack', 'Backend', 'Frontend', 'Web Development', 'Mobile Development',
            'Application Development', 'Software Design', 'Coding', 'Java', 'Python',
            'JavaScript', 'C++', 'React', 'Angular', 'Node.js', 'API Development'
        ],
        'data_science': [
            'Data Science', 'Data Scientist', 'Machine Learning', 'AI', 'Artificial Intelligence',
            'Deep Learning', 'Neural Networks', 'Data Analysis', 'Statistics', 'Analytics',
            'Big Data', 'Data Mining', 'Predictive Modeling', 'R', 'Python', 'SQL',
            'Tableau', 'Power BI', 'TensorFlow', 'PyTorch'
        ],
        'data_engineering': [
            'Data Engineering', 'Data Engineer', 'ETL', 'Data Pipeline', 'Data Architecture',
            'Data Infrastructure', 'Database', 'Data Warehouse', 'Apache Spark', 'Hadoop',
            'Kafka', 'Airflow', 'Cloud Data', 'Data Integration'
        ],
        'cybersecurity': [
            'Cybersecurity', 'Information Security', 'Security Engineer', 'Cyber Security',
            'Penetration Testing', 'Security Analysis', 'Risk Assessment', 'Compliance',
            'Network Security', 'Application Security', 'Security Operations', 'SOC',
            'Incident Response', 'Threat Intelligence', 'Vulnerability Assessment'
        ],
        'devops': [
            'DevOps', 'Site Reliability Engineer', 'SRE', 'Cloud Engineering', 'Infrastructure',
            'CI/CD', 'Kubernetes', 'Docker', 'AWS', 'Azure', 'GCP', 'Terraform',
            'Ansible', 'Jenkins', 'Monitoring', 'Automation'
        ],
        'product_management': [
            'Product Management', 'Product Manager', 'Product Owner', 'Product Strategy',
            'Product Development', 'Product Design', 'User Experience', 'UX', 'UI',
            'Product Marketing', 'Requirements', 'Roadmap', 'Agile', 'Scrum'
        ]
    },
    
    # Business & Finance
    'business_finance': {
        'investment_banking': [
            'Investment Banking', 'Investment Bank', 'IB', 'M&A', 'Mergers and Acquisitions',
            'Capital Markets', 'Equity Research', 'Fixed Income', 'Trading', 'Sales & Trading',
            'Corporate Finance', 'Financial Modeling', 'Valuation', 'DCF', 'LBO'
        ],
        'consulting': [
            'Consulting', 'Management Consulting', 'Strategy Consulting', 'Business Consulting',
            'Operations Consulting', 'Technology Consulting', 'Financial Consulting',
            'Process Improvement', 'Business Strategy', 'Change Management'
        ],
        'finance': [
            'Finance', 'Financial Analysis', 'Financial Analyst', 'Corporate Finance',
            'FP&A', 'Financial Planning', 'Accounting', 'Auditing', 'Tax', 'Treasury',
            'Risk Management', 'Credit Analysis', 'Budget', 'Forecasting'
        ],
        'marketing': [
            'Marketing', 'Digital Marketing', 'Content Marketing', 'Social Media Marketing',
            'Brand Management', 'Product Marketing', 'Marketing Analytics', 'SEO', 'SEM',
            'Email Marketing', 'Marketing Strategy', 'Growth Marketing', 'Performance Marketing'
        ],
        'sales': [
            'Sales', 'Business Development', 'Sales Development', 'Account Management',
            'Customer Success', 'Sales Operations', 'Revenue Operations', 'Channel Sales',
            'Inside Sales', 'Outside Sales', 'Sales Engineering'
        ]
    },
    
    # Research & Science
    'research_science': {
        'research_development': [
            'Research', 'R&D', 'Research and Development', 'Research Scientist', 'Research Engineer',
            'Laboratory Research', 'Clinical Research', 'Academic Research', 'Scientific Research',
            'Innovation', 'Product Research', 'Technology Research'
        ],
        'biotechnology': [
            'Biotechnology', 'Biotech', 'Bioinformatics', 'Computational Biology', 'Genomics',
            'Proteomics', 'Cell Biology', 'Molecular Biology', 'Microbiology', 'Biochemistry',
            'Pharmaceutical', 'Drug Discovery', 'Clinical Trials'
        ]
    }
}

def categorize_internship_comprehensive(title, description=""):
    """
    Comprehensive categorization of internships using enhanced tagging system
    Returns both standard categories and new detailed tags
    """
    text = f"{title} {description}".lower()
    
    # Standard categories for backward compatibility
    standard_categories = []
    for category in INTERNSHIP_TYPE_CATEGORIES:
        if category.lower() in text:
            standard_categories.append(category)
    
    # Enhanced comprehensive categorization
    comprehensive_tags = []
    
    for domain, domain_categories in COMPREHENSIVE_ROLE_CATEGORIES.items():
        for category_key, keywords in domain_categories.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    if category_key not in comprehensive_tags:
                        comprehensive_tags.append(category_key)
                    break
    
    # Add domain-level tags
    domain_tags = []
    if any(tag in comprehensive_tags for tag in COMPREHENSIVE_ROLE_CATEGORIES.get('engineering', {})):
        domain_tags.append('engineering')
    if any(tag in comprehensive_tags for tag in COMPREHENSIVE_ROLE_CATEGORIES.get('technology', {})):
        domain_tags.append('technology')
    if any(tag in comprehensive_tags for tag in COMPREHENSIVE_ROLE_CATEGORIES.get('business_finance', {})):
        domain_tags.append('business_finance')
    if any(tag in comprehensive_tags for tag in COMPREHENSIVE_ROLE_CATEGORIES.get('research_science', {})):
        domain_tags.append('research_science')
    
    # Combine all tags (remove duplicates)
    all_tags = list(set(standard_categories + comprehensive_tags + domain_tags))
    
    return {
        'standard_types': standard_categories,
        'comprehensive_tags': comprehensive_tags,
        'domain_tags': domain_tags,
        'all_tags': all_tags
    }

# Geographic Region Mapping
REGION_MAPPING = {
    # North America
    'USA': 'North America', 'United States': 'North America', 'US': 'North America',
    'California': 'North America', 'New York': 'North America', 'Texas': 'North America',
    'Florida': 'North America', 'Illinois': 'North America', 'Washington': 'North America',
    'Massachusetts': 'North America', 'Pennsylvania': 'North America', 'Georgia': 'North America',
    'North Carolina': 'North America', 'Virginia': 'North America', 'Ohio': 'North America',
    'Canada': 'North America', 'Toronto': 'North America', 'Vancouver': 'North America',
    'Montreal': 'North America', 'Ottawa': 'North America',
    
    # Latin America
    'Mexico': 'Latin America', 'Brazil': 'Latin America', 'Argentina': 'Latin America',
    'Chile': 'Latin America', 'Colombia': 'Latin America', 'Peru': 'Latin America',
    'Costa Rica': 'Latin America', 'Panama': 'Latin America', 'Uruguay': 'Latin America',
    
    # Europe
    'United Kingdom': 'Europe', 'UK': 'Europe', 'England': 'Europe', 'London': 'Europe',
    'Germany': 'Europe', 'Berlin': 'Europe', 'Munich': 'Europe', 'Frankfurt': 'Europe',
    'France': 'Europe', 'Paris': 'Europe', 'Netherlands': 'Europe', 'Amsterdam': 'Europe',
    'Switzerland': 'Europe', 'Zurich': 'Europe', 'Spain': 'Europe', 'Madrid': 'Europe',
    'Italy': 'Europe', 'Sweden': 'Europe', 'Stockholm': 'Europe', 'Norway': 'Europe',
    'Denmark': 'Europe', 'Finland': 'Europe', 'Ireland': 'Europe', 'Dublin': 'Europe',
    
    # Asia-Pacific
    'China': 'Asia-Pacific', 'Japan': 'Asia-Pacific', 'Tokyo': 'Asia-Pacific',
    'Singapore': 'Asia-Pacific', 'South Korea': 'Asia-Pacific', 'Seoul': 'Asia-Pacific',
    'India': 'Asia-Pacific', 'Bangalore': 'Asia-Pacific', 'Mumbai': 'Asia-Pacific',
    'Australia': 'Asia-Pacific', 'Sydney': 'Asia-Pacific', 'Melbourne': 'Asia-Pacific',
    'New Zealand': 'Asia-Pacific', 'Hong Kong': 'Asia-Pacific', 'Taiwan': 'Asia-Pacific',
    'Thailand': 'Asia-Pacific', 'Malaysia': 'Asia-Pacific', 'Philippines': 'Asia-Pacific',
    
    # Middle East & Africa
    'Israel': 'Middle East & Africa', 'Tel Aviv': 'Middle East & Africa',
    'UAE': 'Middle East & Africa', 'Dubai': 'Middle East & Africa', 'Abu Dhabi': 'Middle East & Africa',
    'South Africa': 'Middle East & Africa', 'Egypt': 'Middle East & Africa',
    'Kenya': 'Middle East & Africa', 'Nigeria': 'Middle East & Africa'
}

console = Console()

# --- 2. STANDARDIZATION FUNCTIONS ---
def parse_time_period(text):
    """
    Extracts standardized semester and year from text.
    Returns: (semester, year) tuple
    """
    if not text:
        return None, None
    
    text_lower = text.lower()
    
    # Extract year (2024, 2025, 2026, etc.)
    year_match = re.search(r'\b(202[4-9]|203[0-9])\b', text)
    year = int(year_match.group(1)) if year_match else None
    
    # Extract semester
    semester = None
    if any(term in text_lower for term in ['summer', 'sum']):
        semester = 'Summer'
    elif any(term in text_lower for term in ['fall', 'autumn', 'aut']):
        semester = 'Fall'
    elif any(term in text_lower for term in ['spring', 'spr']):
        semester = 'Spring'
    elif any(term in text_lower for term in ['winter', 'win']):
        semester = 'Winter'
    
    return semester, year

def map_location_to_region(location):
    """
    Maps a location string to a standardized geographic region.
    Returns: (region, country) tuple
    """
    if not location:
        return None, None
    
    # Handle case where location might be a list
    if isinstance(location, list):
        if not location:
            return None, None
        location = location[0] if location[0] else (location[1] if len(location) > 1 else "")
    
    # Ensure location is a string
    if not isinstance(location, str):
        location = str(location) if location else ""
    
    location_clean = location.strip()
    
    # Check for exact matches first
    for key, region in REGION_MAPPING.items():
        if key.lower() in location_clean.lower():
            # Determine country based on region
            if region == 'North America':
                if any(term in location_clean.lower() for term in ['canada', 'toronto', 'vancouver', 'montreal', 'ottawa']):
                    country = 'Canada'
                else:
                    country = 'USA'
            elif region == 'Europe':
                if 'uk' in location_clean.lower() or 'united kingdom' in location_clean.lower() or 'england' in location_clean.lower() or 'london' in location_clean.lower():
                    country = 'United Kingdom'
                elif any(term in location_clean.lower() for term in ['germany', 'berlin', 'munich', 'frankfurt']):
                    country = 'Germany'
                elif any(term in location_clean.lower() for term in ['france', 'paris']):
                    country = 'France'
                elif any(term in location_clean.lower() for term in ['netherlands', 'amsterdam']):
                    country = 'Netherlands'
                elif any(term in location_clean.lower() for term in ['switzerland', 'zurich']):
                    country = 'Switzerland'
                else:
                    country = key  # Use the mapping key as country
            else:
                country = key  # For other regions, use the key as country
            
            return region, country
    
    # Default for unmapped locations
    if any(term in location_clean.lower() for term in ['remote', 'virtual', 'work from home', 'wfh']):
        return 'Remote', 'Remote'
    
    return 'Other', 'Other'

# --- 3. DATABASE AND SETUP ---
def setup_database():
    """Initializes the SQLite database with enhanced schema."""
    console.print("[yellow]Setting up database...[/yellow]")
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Check if the table exists and get its schema
    cursor.execute("PRAGMA table_info(internships)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    # Create table with enhanced schema if it doesn't exist
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
    );
    """)
    
    # Add new columns if they don't exist (for existing databases)
    new_columns = [
        ('semester', 'TEXT'),
        ('year', 'INTEGER'),
        ('region', 'TEXT'),
        ('country', 'TEXT'),
        ('tags', 'TEXT'),  # JSON array of comprehensive tags
        ('priority_score', 'INTEGER'),  # Priority score for ranking
        ('normalized_title', 'TEXT'),  # Cleaned title
        ('normalized_company', 'TEXT'),  # Standardized company name
        ('normalized_description', 'TEXT')  # Clean, concise description
    ]
    
    for column_name, column_type in new_columns:
        if column_name not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE internships ADD COLUMN {column_name} {column_type}")
                console.print(f"[green]Added new column: {column_name}[/green]")
            except sqlite3.OperationalError:
                pass  # Column already exists
    
    conn.commit()
    conn.close()
    console.print("[green]Database setup complete with enhanced schema.[/green]")

def get_existing_links(conn):
    """Queries the database and returns a set of all existing application links for quick lookups."""
    cursor = conn.cursor()
    cursor.execute("SELECT application_link FROM internships")
    links = {row[0] for row in cursor.fetchall()}
    return links

def save_internship(internship_data, conn):
    """Saves a single internship posting to the database using a provided connection."""
    try:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO internships (id, title, company_name, location, snippet, deadline, posted_date, types, application_link, source_url, date_scraped, description, semester, year, region, country, tags, priority_score, normalized_title, normalized_company, normalized_description)
        VALUES (:id, :title, :company_name, :location, :snippet, :deadline, :posted_date, :types, :application_link, :source_url, :date_scraped, :description, :semester, :year, :region, :country, :tags, :priority_score, :normalized_title, :normalized_company, :normalized_description)
        """, internship_data)
        conn.commit()
        console.print(f"[green]SUCCESS:[/green] Saved new internship: [bold]{internship_data['title']}[/bold] with {len(json.loads(internship_data.get('tags', '[]')))} tags")
    except sqlite3.IntegrityError:
        console.print(f"[cyan]INFO:[/cyan] Internship '{internship_data['title']}' already exists. Skipping.")
    except Exception as e:
        console.print(f"[red]DATABASE ERROR:[/red] Could not save internship '{internship_data.get('title', 'N/A')}'. Reason: {e}")


def configure_gemini():
    """Configures and returns the Gemini model instance."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not found in .env file. Please add it.")
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        model = genai.GenerativeModel(LLM_MODEL_NAME, safety_settings=safety_settings)
        console.print(f"[green]Gemini API configured successfully with model {LLM_MODEL_NAME}.[/green]")
        return model
    except Exception as e:
        console.print(f"[red]CRITICAL: Error configuring Gemini API: {e}[/red]")
        return None

def setup_selenium_driver():
    """Sets up and returns a headless Selenium WebDriver instance."""
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--log-level=3")
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    chrome_options.add_argument(f'user-agent={USER_AGENT}')
    
    # **IMPROVEMENT**: Use 'eager' page load strategy to avoid waiting for non-essential resources.
    chrome_options.page_load_strategy = 'eager'

    try:
        service = Service()
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_page_load_timeout(SELENIUM_PAGE_LOAD_TIMEOUT)
        console.print(f"[green]Selenium WebDriver initialized successfully (Page Load Strategy: Eager, Timeout: {SELENIUM_PAGE_LOAD_TIMEOUT}s).[/green]")
        return driver
    except Exception as e:
        console.print(f"[red]CRITICAL: Could not initialize Selenium WebDriver. Make sure chromedriver is in your PATH.[/red]")
        console.print(f"Error: {e}")
        return None


# --- 4. CORE LOGIC: FETCHING AND LLM-POWERED MODULES ---
def get_full_page_html(driver, url):
    """Navigates to a URL with Selenium, clicks cookie banners, and returns the full page HTML."""
    console.print(f"Fetching [blue]{url}[/blue] with Selenium...")
    try:
        driver.get(url)
        # With 'eager' strategy, we mainly wait for the body tag.
        WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        
        console.print("Page structure loaded. Waiting a moment for dynamic content to render...")
        time.sleep(5) # Give JS time to execute after DOM is ready

        common_texts = ["Accept all", "Accept", "Allow all", "Allow Cookies", "I agree"]
        for text in common_texts:
            try:
                xpath = f"//button[contains(normalize-space(), '{text}') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text.lower()}')]"
                button = driver.find_element(By.XPATH, xpath)
                if button.is_displayed() and button.is_enabled():
                    console.print(f"Clicking cookie button with text: '{text}'")
                    driver.execute_script("arguments[0].click();", button)
                    time.sleep(2)
                    break
            except Exception:
                continue
        return driver.page_source, driver.current_url
    except TimeoutException:
        console.print(f"[red]ERROR: Page load timed out for {url}. The site may be too slow or blocking requests.[/red]")
        return None, url
    except Exception as e:
        error_msg = str(e)
        if "invalid session id" in error_msg.lower() or "session deleted" in error_msg.lower():
            console.print(f"[red]ERROR: WebDriver session invalid for {url}. Driver needs to be recreated.[/red]")
            raise Exception("DRIVER_SESSION_INVALID")
        console.print(f"[red]ERROR: An unexpected error occurred while fetching {url}: {e}[/red]")
        return None, url

def recreate_driver_if_needed(driver):
    """Safely recreates the WebDriver if the current one is invalid."""
    try:
        if driver:
            driver.quit()
    except Exception:
        pass  # Ignore errors when quitting a broken driver
    
    console.print("[yellow]Recreating WebDriver due to session issues...[/yellow]")
    return setup_selenium_driver()

def extract_internships_with_llm(html_content, base_url, llm_model):
    """Uses LLM to parse HTML and extract structured internship data."""
    if not html_content: return []

    soup = BeautifulSoup(html_content, 'html.parser')
    for tag in soup(['script', 'style', 'svg', 'header', 'footer', 'nav', 'aside', 'form']):
        tag.decompose()
    
    main_content = soup.find('main') or soup.body
    cleaned_html = main_content.prettify() if main_content else ""

    if len(cleaned_html) > LLM_MAX_HTML_INPUT_LENGTH:
        console.print(f"[yellow]WARN: HTML content truncated to {LLM_MAX_HTML_INPUT_LENGTH} characters for LLM analysis.[/yellow]")
        cleaned_html = cleaned_html[:LLM_MAX_HTML_INPUT_LENGTH]

    if not cleaned_html.strip():
        console.print("[yellow]WARN: No meaningful HTML content to send to LLM.[/yellow]")
        return []

    prompt = f"""
    Analyze the following HTML from the URL {base_url}. Extract ONLY internship positions (e.g., Intern, Internship, Co-op, Student Program). Exclude any full-time or experienced roles.

    For each internship, extract these fields:
    1. "title": The full, specific job title.
    2. "link": The direct and full absolute URL to the job posting. Resolve any relative links using the base URL: {base_url}.
    3. "company_name": The name of the company. Infer from the URL or page content.
    4. "location": The job location(s). Be as specific as possible (city, state/country).
    5. "posted_date": The date the job was posted. Normalize to a YYYY-MM-DD string if possible. If not found, leave as an empty string.
    6. "deadline": The application deadline, if available.
    7. "snippet": A brief 1-2 sentence description of the role.
    8. "types": A list of relevant internship types from this predefined list: [{INTERNSHIP_TYPE_CATEGORIES_STR}]. Return an empty list [] if none from the list apply.
    9. "enhanced_tags": Additionally, provide detailed categorization tags that best describe this role (e.g., "software_engineering", "mechanical_engineering", "data_science", "investment_banking", "research_development", etc.). Be specific about the domain and function.
    10. "time_period": Extract the time period when the internship takes place. Look for terms like "Summer 2025", "Fall 2025", "Spring 2026", etc. in the title, description, or other text. If found, return exactly as written. If not found, leave as an empty string.

    You MUST return the data as a valid JSON list of objects. For example: [{{ "title": "Software Intern", "link": "...", "time_period": "Summer 2025", ... }}]. If no internships are found, return an empty list [].
    HTML:
    ---
    {cleaned_html}
    ---
    """
    try:
        console.print(f"Sending HTML from [blue]{base_url}[/blue] to Gemini for internship extraction...")
        # Try the new response_mime_type parameter first, fallback if not supported
        try:
            response = llm_model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
        except TypeError:
            # Fallback for older versions that don't support response_mime_type
            console.print("[yellow]WARN: response_mime_type not supported, using fallback[/yellow]")
            response = llm_model.generate_content(prompt)
        
        if not response.text.strip():
            console.print("[yellow]WARN: LLM returned an empty response.[/yellow]")
            return []

        raw_data = json.loads(response.text)
        
        if isinstance(raw_data, dict):
            for key, value in raw_data.items():
                if isinstance(value, list):
                    results = value
                    console.print(f"INFO: LLM returned a dictionary. Extracted list from key '[bold]{key}[/bold]'.")
                    break
            else:
                console.print("[yellow]WARN: LLM returned a dictionary, but no list of items was found inside it.[/yellow]")
                return []
        elif isinstance(raw_data, list):
            results = raw_data
        else:
            console.print("[yellow]WARN: LLM did not return a list or a dictionary containing a list.[/yellow]")
            return []

        for item in results:
            if 'link' in item and item['link']:
                item['link'] = urljoin(base_url, item['link'])
        
        console.print(f"[green]LLM extracted {len(results)} potential internship(s).[/green]")
        return results
    except json.JSONDecodeError:
        console.print(f"[red]ERROR: Failed to decode JSON from LLM response. Raw text: {response.text[:300]}...[/red]")
        return []
    except Exception as e:
        console.print(f"[red]ERROR: LLM processing failed for {base_url}. Reason: {e}[/red]")
        return []

def find_next_page_with_llm(html_content, current_url, llm_model):
    """Uses LLM to identify the URL for the next page of listings."""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    nav_area = soup.find('nav') or soup.find(lambda tag: 'pagination' in tag.get('class', [])) or soup.body
    if not nav_area: return None
    
    links_context = "\n".join([f"Link Text: '{a.get_text(strip=True)}', Href: '{a.get('href')}'" for a in nav_area.find_all('a', href=True, limit=150)])
    if not links_context: return None

    prompt = f"""
    Given the current URL '{current_url}' and the following link snippets, what is the FULL absolute URL for the 'Next Page' of the list?
    Look for links with text like 'Next', '>', '»', or the next sequential page number.
    If you find a relative link, resolve it using the base URL: {current_url}.
    Respond with ONLY the full URL. If no 'Next Page' link can be confidently identified, respond with the single word 'null'.

    Link Snippets:
    ---
    {links_context}
    ---
    """
    try:
        console.print("Asking LLM to find the next page link...")
        response = llm_model.generate_content(prompt)
        next_url = response.text.strip().replace('"', '')

        if next_url.lower() == 'null' or "http" not in next_url:
            console.print("LLM did not identify a next page link.")
            return None
        
        absolute_next_url = urljoin(current_url, next_url)
        if absolute_next_url == current_url:
            console.print("LLM returned the same URL. Ignoring.")
            return None
        
        console.print(f"[green]LLM identified next page: {absolute_next_url}[/green]")
        return absolute_next_url
    except Exception as e:
        console.print(f"[red]ERROR: LLM pagination check failed. Reason: {e}[/red]")
        return None


# --- 5. MAIN ORCHESTRATOR ---
def main():
    overall_start_time = time.time()
    setup_database()
    llm_model = configure_gemini()
    driver = setup_selenium_driver()

    if not llm_model or not driver:
        console.print("[red]CRITICAL: LLM or Selenium Driver failed to initialize. Aborting.[/red]")
        if driver: driver.quit()
        return

    try:
        with open(COMPANIES_FILE, "r") as f:
            target_urls = [line.strip() for line in f if line.strip() and line.startswith("http")]
    except FileNotFoundError:
        console.print(f"[red]ERROR: The `{COMPANIES_FILE}` file was not found. Please create it.[/red]")
        driver.quit()
        return

    console.print(f"Found {len(target_urls)} URLs to process from [cyan]{COMPANIES_FILE}[/cyan].")

    db_connection = sqlite3.connect(DB_NAME)
    site_count = 0
    
    for site_url in target_urls:
        site_count += 1
        
        # Periodically recreate driver to prevent session accumulation issues
        if site_count % DRIVER_RECREATION_INTERVAL == 0:
            console.print(f"[yellow]Proactively recreating WebDriver after {site_count} sites to prevent session issues...[/yellow]")
            driver = recreate_driver_if_needed(driver)
            if not driver:
                console.print("[red]Failed to recreate WebDriver. Aborting remaining sites.[/red]")
                break
        console.rule(f"[bold blue]Processing Site: {site_url}[/bold blue]")
        urls_to_visit = [site_url]
        visited_urls = set()
        all_postings_for_site = []
        page_count = 0
        seen_links_for_site = set()

        while urls_to_visit and page_count < MAX_PAGES_PER_SITE:
            current_url = urls_to_visit.pop(0)
            if current_url in visited_urls:
                continue
            
            console.print(f"--- Scraping Page {page_count + 1} of {MAX_PAGES_PER_SITE}: {current_url} ---")
            visited_urls.add(current_url)
            page_count += 1
            
            try:
                html, final_url = get_full_page_html(driver, current_url)
            except Exception as e:
                if "DRIVER_SESSION_INVALID" in str(e):
                    console.print("[yellow]Recreating WebDriver due to invalid session...[/yellow]")
                    driver = recreate_driver_if_needed(driver)
                    if not driver:
                        console.print("[red]Failed to recreate WebDriver. Skipping this site.[/red]")
                        break
                    # Retry the current URL with new driver
                    try:
                        html, final_url = get_full_page_html(driver, current_url)
                    except Exception:
                        console.print(f"[red]Failed to fetch {current_url} even with new driver. Skipping.[/red]")
                        continue
                else:
                    continue
            
            if not html:
                continue

            postings_on_page = extract_internships_with_llm(html, final_url, llm_model)
            
            new_postings_found_this_page = 0
            for post in postings_on_page:
                link = post.get('link')
                if link and link not in seen_links_for_site:
                    all_postings_for_site.append(post)
                    seen_links_for_site.add(link)
                    new_postings_found_this_page += 1
            
            if new_postings_found_this_page > 0:
                console.print(f"Added {new_postings_found_this_page} new, unique internships to the site queue.")

            next_page = find_next_page_with_llm(html, final_url, llm_model)
            if next_page and next_page not in visited_urls:
                urls_to_visit.append(next_page)
            
            time.sleep(POLITENESS_DELAY)

        console.print(f"Finished scraping {site_url}. Found {len(all_postings_for_site)} total unique postings. Filtering against database...")
        
        existing_links = get_existing_links(db_connection)
        new_internships_to_process = []
        for post in all_postings_for_site:
            if post.get('link') and post.get('link') not in existing_links:
                new_internships_to_process.append(post)

        if not new_internships_to_process:
            console.print("[green]No new internships found for this site. All discovered jobs are already in the database.[/green]")
            continue
        
        console.print(f"Found [bold yellow]{len(new_internships_to_process)}[/bold yellow] brand new internships to process and save.")

        for post in new_internships_to_process:
            if not isinstance(post, dict) or not post.get('title') or not post.get('link'):
                continue
            
            unique_id_str = f"{post.get('title')}|{post.get('link')}"
            post_id = hashlib.md5(unique_id_str.encode()).hexdigest()
            
            description_text = "Description not available."
            try:
                desc_html, _ = get_full_page_html(driver, post['link'])
                if desc_html:
                    soup = BeautifulSoup(desc_html, 'html.parser')
                    body = soup.find('main') or soup.body
                    if body:
                        description_text = ' '.join(body.get_text(separator=' ').split())
            except Exception as e:
                if "DRIVER_SESSION_INVALID" in str(e):
                    console.print(f"[yellow]WebDriver session invalid while fetching description for {post.get('title')}. Recreating driver...[/yellow]")
                    driver = recreate_driver_if_needed(driver)
                    if driver:
                        try:
                            desc_html, _ = get_full_page_html(driver, post['link'])
                            if desc_html:
                                soup = BeautifulSoup(desc_html, 'html.parser')
                                body = soup.find('main') or soup.body
                                if body:
                                    description_text = ' '.join(body.get_text(separator=' ').split())
                        except Exception:
                            console.print(f"[yellow]WARN: Could not fetch description for {post.get('title')} even with new driver.[/yellow]")
                    else:
                        console.print(f"[red]Failed to recreate driver for description fetch of {post.get('title')}[/red]")
                else:
                    console.print(f"[yellow]WARN: Could not fetch description for {post.get('title')}. Error: {e}[/yellow]")

            region, country = map_location_to_region(post.get('location', ''))
            # Try to parse time period from the extracted time_period first, then fallback to title
            time_text = post.get('time_period', '') or post.get('title', '') or post.get('posted_date', '')
            semester, year = parse_time_period(time_text)

            # Enhanced comprehensive categorization
            title = post.get('title', '')
            description = description_text if description_text != "Description not available." else ""
            comprehensive_analysis = categorize_internship_comprehensive(title, description)
            
            # Combine LLM-generated enhanced_tags with comprehensive analysis
            llm_enhanced_tags = post.get('enhanced_tags', [])
            if isinstance(llm_enhanced_tags, str):
                llm_enhanced_tags = [llm_enhanced_tags]
            
            # Create comprehensive tags array
            all_comprehensive_tags = list(set(
                comprehensive_analysis.get('all_tags', []) + 
                llm_enhanced_tags + 
                [f"{semester} {year}".strip(), region, f"Year {year}"] + 
                [tag for tag in [semester, str(year)] if tag]
            ))
            
            # Remove empty strings and None values
            all_comprehensive_tags = [tag for tag in all_comprehensive_tags if tag and str(tag).strip()]
            
            # Calculate priority score (US positions get higher scores)
            us_keywords = ['united states', 'usa', 'us', 'america', 'california', 'new york', 'texas', 'florida']
            is_us = any(keyword in post.get('location', '').lower() for keyword in us_keywords)
            base_priority = 80 if is_us else 50
            
            # Boost for technical roles
            tech_boost = 0
            if any(tag in comprehensive_analysis.get('comprehensive_tags', []) for tag in ['software_engineering', 'data_science', 'engineering']):
                tech_boost = 10
            
            priority_score = base_priority + tech_boost + len(all_comprehensive_tags)

            data_to_save = {
                'id': post_id,
                'title': post.get('title'),
                'company_name': post.get('company_name', urlparse(site_url).netloc.split('.')[0]),
                'location': post.get('location', 'N/A'),
                'snippet': post.get('snippet', ''),
                'deadline': post.get('deadline', ''),
                'posted_date': post.get('posted_date', ''),
                'types': json.dumps(post.get('types', [])),
                'application_link': post.get('link'),
                'source_url': site_url,
                'date_scraped': datetime.now().strftime("%Y-%m-%d"),
                'description': description_text,
                'semester': semester,
                'year': year,
                'region': region,
                'country': country,
                'tags': json.dumps(all_comprehensive_tags),
                'priority_score': priority_score,
                'normalized_title': title,
                'normalized_company': post.get('company_name', urlparse(site_url).netloc.split('.')[0]),
                'normalized_description': post.get('snippet', '')[:500] if post.get('snippet') else ''
            }
            save_internship(data_to_save, db_connection)
            time.sleep(1)

    db_connection.close()
    driver.quit()
    console.rule(f"[bold green]Scraping session complete. Total time: {time.time() - overall_start_time:.2f} seconds[/bold green]")

if __name__ == "__main__":
    main()