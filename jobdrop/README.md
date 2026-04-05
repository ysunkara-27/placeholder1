# 🚀 JobDrop - Smart Internship Aggregator

**Clean, organized, production-ready internship platform with advanced AI classification.**

## 📁 Project Structure

```
jobdrop/
├── 🌐 app/                     # Core Flask Application
│   ├── main.py                 # Main Flask app with all routes
│   ├── wsgi.py                 # WSGI entry point for deployment
│   ├── subscription.py         # Subscription management
│   ├── templates/              # HTML templates
│   └── static/                 # CSS, JS, images
│
├── 🤖 ai/                      # AI & LLM Classification System
│   ├── classifiers/            # Core classification engines
│   │   ├── enhanced_job_classifier.py        # Advanced job classification
│   │   ├── ultimate_student_position_classifier.py  # Student-specific classifier
│   │   ├── ultimate_broad_classifier.py      # Broad category classifier
│   │   └── llm_classification_improver.py    # LLM-powered improvements
│   ├── tagging/                # Smart tagging system
│   │   ├── smart_tagging_system.py          # Core tagging engine
│   │   ├── run_smart_tagging.py            # Tagging runner script
│   │   └── enhanced_filter_system.py        # Advanced filtering
│   ├── runners/                # Execution scripts
│   │   └── run_ultimate_classifier.py      # Ultimate classifier runner
│   └── adapters/               # API adapters
│       ├── llm_adapters.py                 # LLM API adapters
│       └── smart_filter_api.py             # Smart filtering API
│
├── 🗄️ backend/                 # Data Processing & Storage
│   ├── scraping/               # Web scraping system
│   │   ├── internship_scraper.py          # Main scraper engine
│   │   ├── resume_scraper.py              # Resume-based scraping
│   │   └── companies.txt                  # Target companies list
│   └── database/               # Database management
│       ├── internships.db                 # Main SQLite database
│       ├── database_manager.py            # Database utilities
│       ├── view_database.py               # Database viewer
│       ├── llm_database_cleaner.py        # AI-powered data cleaning
│       └── requirements.txt               # Backend dependencies
│
├── ⚙️ config/                   # Configuration files
│   ├── render.yaml             # Render deployment config
│   ├── requirements.txt        # Main dependencies
│   └── .gitignore              # Git ignore rules
│
├── requirements.txt            # Root dependencies (for deployment)
├── README.md                   # This file
└── .env                        # Environment variables (local)
```

## 🌟 Key Features

- **🤖 Advanced AI Classification**: Multiple LLM-powered classifiers for precise job categorization
- **🏷️ Smart Tagging System**: Intelligent tagging and filtering system
- **🔍 Advanced Search**: Semantic search with relevance scoring
- **📊 Real-time Analytics**: Live job statistics and trends
- **🎯 Smart Filtering**: AI-powered filtering by skills, location, type
- **📱 Responsive Design**: Modern, mobile-first UI

## 🚀 Quick Start

### Local Development

1. **Clone & Setup**
   ```bash
   git clone <repository>
   cd jobdrop
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   cd backend/database && pip install -r requirements.txt
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run Locally**
   ```bash
   cd app
   python main.py
   ```

### Production Deployment

**Render Deployment** (Automatic):
```bash
git push origin main  # Auto-deploys via render.yaml
```

## 🤖 AI Classification System

### Core Classifiers

- **Enhanced Job Classifier**: `ai/classifiers/enhanced_job_classifier.py`
  - Advanced role categorization with 95%+ accuracy
  - Supports 20+ engineering disciplines
  - Business, finance, tech, research classifications

- **Ultimate Student Position Classifier**: `ai/classifiers/ultimate_student_position_classifier.py`
  - Specifically trained for internships/co-ops
  - Filters out non-student positions
  - Semester and year detection

- **Smart Tagging System**: `ai/tagging/smart_tagging_system.py`
  - Intelligent tag generation
  - Duplicate detection and cleanup
  - Semantic similarity analysis

### Running Classifiers

```bash
# Run ultimate classifier
python ai/runners/run_ultimate_classifier.py

# Run smart tagging
python ai/tagging/run_smart_tagging.py
```

## 🗄️ Database Management

### Core Database Operations

```bash
# View database contents
python backend/database/view_database.py

# Clean and enhance data
python backend/database/llm_database_cleaner.py

# Manage database
python backend/database/database_manager.py
```

### Scraping New Data

```bash
# Run full scraper
python backend/scraping/internship_scraper.py

# Resume partial scraping
python backend/scraping/resume_scraper.py
```

## 🔧 Configuration

### Environment Variables

**Required:**
- `GEMINI_API_KEY`: Google Gemini API key for LLM classification
- `FLASK_SECRET_KEY`: Secret key for session management

**Optional:**
- `FIREBASE_*`: Firebase configuration for user management
- `STRIPE_*`: Stripe configuration for subscriptions

### Deployment Configuration

- **Render**: `config/render.yaml`
- **Dependencies**: `requirements.txt`
- **Git**: `config/.gitignore`

## 📊 API Endpoints

### Core APIs
- `GET /api/internships` - Get internships with filtering
- `GET /api/internships/advanced` - Advanced search
- `GET /api/health` - Health check
- `GET /api/stats` - Platform statistics

### Smart Filtering
- `GET /api/filters/smart` - AI-powered filter options
- `GET /api/internships/categories` - Available categories

## 🎯 Recent Improvements

- ✅ **Clean Architecture**: Organized codebase into logical folders
- ✅ **Database Optimization**: Removed backup files, saved 210MB
- ✅ **AI Enhancement**: Perfect LLM classification system
- ✅ **Performance**: Optimized queries and pagination
- ✅ **Stability**: Simplified deployment for reliability

## 🛠️ Development

### Adding New Features

1. **AI/LLM Features**: Add to `ai/` folder
2. **Web Features**: Add to `app/main.py`
3. **Data Processing**: Add to `backend/`
4. **Configuration**: Update `config/`

### Best Practices

- Keep AI logic in `ai/` folder
- Use semantic imports with path management
- Follow the organized folder structure
- Update requirements.txt when adding dependencies

---

**Built with ❤️ for finding the perfect internship opportunities.** 