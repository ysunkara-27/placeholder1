// Shared job actions functionality
let currentUser = null;
let userSavedJobs = {};
let userApplications = {};
let isFirebaseAvailable = false;

// Initialize job actions when DOM is loaded
function initializeJobActions() {
    console.log('🔄 Initializing job actions...');
    
    // Check if Firebase is available
    isFirebaseAvailable = typeof firebase !== 'undefined' && firebase.auth;
    
    if (isFirebaseAvailable && !window.jobActionsAuthSetup) {
        window.jobActionsAuthSetup = true;
        firebase.auth().onAuthStateChanged((user) => {
            currentUser = user;
            if (user) {
                loadUserApplicationStatus();
            } else {
                // Load from localStorage when no Firebase user
                loadFromLocalStorage();
                updateNavbarCounters();
            }
        });
    } else {
        // Fallback: Load from localStorage when Firebase isn't available
        console.log('🔄 Firebase not available, using localStorage fallback');
        loadFromLocalStorage();
        updateNavbarCounters();
        updateJobButtonStates();
    }
}

// Load saved jobs and applications from localStorage
function loadFromLocalStorage() {
    try {
        const savedJobs = localStorage.getItem('jobdrop_saved_jobs');
        const applications = localStorage.getItem('jobdrop_applications');
        
        userSavedJobs = savedJobs ? JSON.parse(savedJobs) : {};
        userApplications = applications ? JSON.parse(applications) : {};
        
        console.log('✅ Loaded from localStorage:', Object.keys(userSavedJobs).length, 'saved jobs,', Object.keys(userApplications).length, 'applications');
    } catch (error) {
        console.error('❌ Error loading from localStorage:', error);
        userSavedJobs = {};
        userApplications = {};
    }
}

// Save to localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('jobdrop_saved_jobs', JSON.stringify(userSavedJobs));
        localStorage.setItem('jobdrop_applications', JSON.stringify(userApplications));
        console.log('✅ Saved to localStorage');
    } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
    }
}

// Load user's application status
async function loadUserApplicationStatus() {
    if (!currentUser) {
        console.log('❌ No current user, loading from localStorage instead');
        loadFromLocalStorage();
        return;
    }
    
    try {
        console.log('🔄 Loading user application status...');
        const token = await currentUser.getIdToken();
        
        const response = await fetch('/api/applications/status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            userApplications = data.applications || {};
            userSavedJobs = data.saved_jobs || {};
            console.log('✅ User status loaded:', Object.keys(userApplications).length, 'applications,', Object.keys(userSavedJobs).length, 'saved jobs');
            
            // Update UI for all job cards on the page
            updateJobButtonStates();
            updateNavbarCounters();
        } else {
            console.error('❌ Failed to load application status:', response.status);
            // Fallback to localStorage
            loadFromLocalStorage();
        }
    } catch (error) {
        console.error('❌ Error loading user application status:', error);
        // Fallback to localStorage
        loadFromLocalStorage();
    }
}

// Update button states for all job cards on the page
function updateJobButtonStates() {
    // Update save buttons
    document.querySelectorAll('.save-job-btn').forEach(btn => {
        const jobId = btn.getAttribute('data-job-id');
        if (jobId && userSavedJobs[jobId]) {
            btn.classList.add('saved');
            const saveText = btn.querySelector('.save-text');
            const icon = btn.querySelector('i');
            if (saveText) saveText.textContent = 'Saved';
            if (icon) {
                icon.className = 'fas fa-bookmark';
                icon.style.color = '#0066cc';
            }
        }
    });
    
    // Update apply buttons if they exist
    document.querySelectorAll('.apply-job-btn').forEach(btn => {
        const jobId = btn.getAttribute('data-job-id');
        if (jobId && userApplications[jobId]) {
            btn.classList.add('applied');
            btn.textContent = 'Applied';
            btn.disabled = true;
        }
    });
}

// Toggle save job functionality
async function toggleSaveJob(jobId) {
    console.log(`🔖 Toggle save for job: ${jobId}`);
    
    const saveBtn = document.querySelector(`button[data-job-id="${jobId}"]`);
    if (!saveBtn) {
        console.error(`❌ Save button not found for job ${jobId}`);
        return;
    }
    
    const saveText = saveBtn.querySelector('.save-text');
    const icon = saveBtn.querySelector('i');
    
    const isSaved = saveBtn.classList.contains('saved');
    console.log(`📌 Job ${jobId} current state: ${isSaved ? 'saved' : 'not saved'}`);
    
    // Disable button during request
    saveBtn.disabled = true;
    
    try {
        // If Firebase is available and user is authenticated, use server-side storage
        if (isFirebaseAvailable && currentUser) {
            console.log('🔑 Getting user token...');
            const token = await currentUser.getIdToken();
            console.log('✅ Token obtained successfully');
            
            if (isSaved) {
                // Unsave the job via API
                console.log(`🗑️ Unsaving job ${jobId} via API...`);
                const response = await fetch('/api/applications/unsave', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ job_id: jobId })
                });
                
                console.log(`📡 Unsave response status: ${response.status}`);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('📨 Unsave response:', data);
                    
                    saveBtn.classList.remove('saved');
                    if (saveText) saveText.textContent = 'Save';
                    if (icon) {
                        icon.className = 'fas fa-bookmark';
                        icon.style.color = '';
                    }
                    delete userSavedJobs[jobId];
                    updateNavbarCounters();
                    console.log('✅ Job unsaved successfully');
                } else {
                    const errorData = await response.text();
                    console.error('❌ Failed to unsave job:', response.status, errorData);
                    alert(`Failed to unsave job (${response.status}). Please try again.`);
                }
            } else {
                // Save the job via API
                console.log(`💾 Saving job ${jobId} via API...`);
                const response = await fetch('/api/applications/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ job_id: jobId })
                });
                
                console.log(`📡 Save response status: ${response.status}`);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('📨 Save response:', data);
                    
                    saveBtn.classList.add('saved');
                    if (saveText) saveText.textContent = 'Saved';
                    if (icon) {
                        icon.className = 'fas fa-bookmark';
                        icon.style.color = '#0066cc';
                    }
                    userSavedJobs[jobId] = data.job;
                    updateNavbarCounters();
                    console.log('✅ Job saved successfully:', data.job);
                } else {
                    const errorData = await response.text();
                    console.error('❌ Failed to save job:', response.status, errorData);
                    alert(`Failed to save job (${response.status}). Please try again.`);
                }
            }
        } else {
            // Fallback: Use localStorage when Firebase isn't available or user not authenticated
            console.log('🔄 Using localStorage fallback for save functionality');
            
            // Show a subtle notification the first time
            if (!localStorage.getItem('jobdrop_local_mode_shown')) {
                console.log('ℹ️ Using local storage for saving jobs (no account required)');
                localStorage.setItem('jobdrop_local_mode_shown', 'true');
            }
            
            if (isSaved) {
                // Unsave the job locally
                console.log(`🗑️ Unsaving job ${jobId} locally...`);
                
                saveBtn.classList.remove('saved');
                if (saveText) saveText.textContent = 'Save';
                if (icon) {
                    icon.className = 'fas fa-bookmark';
                    icon.style.color = '';
                }
                delete userSavedJobs[jobId];
                saveToLocalStorage();
                updateNavbarCounters();
                console.log('✅ Job unsaved locally');
            } else {
                // Save the job locally
                console.log(`💾 Saving job ${jobId} locally...`);
                
                // Get job details from the page or make a simple API call
                const jobData = await getJobData(jobId);
                
                saveBtn.classList.add('saved');
                if (saveText) saveText.textContent = 'Saved';
                if (icon) {
                    icon.className = 'fas fa-bookmark';
                    icon.style.color = '#0066cc';
                }
                userSavedJobs[jobId] = jobData;
                saveToLocalStorage();
                updateNavbarCounters();
                console.log('✅ Job saved locally:', jobData);
            }
        }
    } catch (error) {
        console.error('❌ Error toggling job save:', error);
        console.error('❌ Error details:', error.message, error.stack);
        alert('Failed to save job. Please check your connection and try again.');
    } finally {
        // Re-enable button
        saveBtn.disabled = false;
    }
}

// Get job data for local storage
async function getJobData(jobId) {
    try {
        // Try to get job data from the new API endpoint
        const response = await fetch(`/api/job/${jobId}`);
        if (response.ok) {
            const data = await response.json();
            const job = data.job;
            if (job) {
                return {
                    job_id: jobId,
                    job_title: job.title,
                    company_name: job.company_name,
                    location: job.location,
                    saved_at: new Date().toISOString(),
                    application_link: job.application_link || job.link || job.url || '',
                    snippet: job.snippet || '',
                    description: job.description || '',
                    deadline: job.deadline || '',
                    status: 'saved'
                };
            }
        }
    } catch (error) {
        console.error('❌ Error fetching job data:', error);
    }
    
    // Fallback: Use basic data from the DOM
    const jobCard = document.querySelector(`[data-job-id="${jobId}"]`)?.closest('.job-card');
    if (jobCard) {
        const title = jobCard.querySelector('.job-title')?.textContent || 'Unknown Job';
        const company = jobCard.querySelector('.job-company')?.textContent || 'Unknown Company';
        const location = jobCard.querySelector('.job-location')?.textContent || 'Unknown Location';
        
        return {
            job_id: jobId,
            job_title: title,
            company_name: company,
            location: location,
            saved_at: new Date().toISOString(),
            application_link: '',
            snippet: '',
            description: '',
            deadline: '',
            status: 'saved'
        };
    }
    
    // Last resort fallback
    return {
        job_id: jobId,
        job_title: 'Saved Job',
        company_name: 'Unknown Company',
        location: 'Unknown Location',
        saved_at: new Date().toISOString(),
        application_link: '',
        snippet: '',
        description: '',
        deadline: '',
        status: 'saved'
    };
}

// Mark job as applied
async function markAsApplied(jobId) {
    const applyBtn = document.querySelector(`button[data-job-id="${jobId}"].apply-job-btn`);
    if (!applyBtn) {
        console.error(`❌ Apply button not found for job ${jobId}`);
        return;
    }
    
    // If Firebase is available and user is authenticated, use server-side storage
    if (isFirebaseAvailable && currentUser) {
        // Original Firebase implementation
        console.log('🔄 Marking as applied via API...');
    } else {
        // Fallback: Use localStorage when Firebase isn't available
        console.log('🔄 Using localStorage fallback for marking as applied');
        
        // Get job data
        const jobData = await getJobData(jobId);
        
        // Mark as applied locally
        userApplications[jobId] = {
            ...jobData,
            applied_at: new Date().toISOString(),
            status: 'applied'
        };
        
        // Update button state
        applyBtn.classList.add('applied');
        applyBtn.textContent = 'Applied';
        applyBtn.disabled = true;
        
        // Save to localStorage
        saveToLocalStorage();
        updateNavbarCounters();
        
        console.log('✅ Job marked as applied locally');
        return;
    }
    
    try {
        console.log(`🔄 Marking job ${jobId} as applied...`);
        const token = await currentUser.getIdToken();
        console.log('✅ Token obtained for marking as applied');
        
        const response = await fetch('/api/applications/mark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                job_id: jobId,
                status: 'applied'
            })
        });
        
        console.log(`📡 Mark applied response: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📨 Mark applied response:', data);
            
            // Update local state
            userApplications[jobId] = data.job;
            updateNavbarCounters();
            
            // Update UI
            const applyBtn = document.querySelector(`button[data-job-id="${jobId}"].apply-job-btn`);
            if (applyBtn) {
                applyBtn.classList.add('applied');
                applyBtn.textContent = 'Applied';
                applyBtn.disabled = true;
            }
            
            console.log('✅ Job successfully marked as applied');
            alert('Job marked as applied! You can track it in your applications.');
        } else {
            const errorData = await response.text();
            console.error('❌ Failed to mark as applied:', response.status, errorData);
            alert('Failed to mark job as applied. Please try again.');
        }
    } catch (error) {
        console.error('❌ Error marking as applied:', error);
        console.error('❌ Error details:', error.message, error.stack);
        alert('Failed to mark job as applied. Please check your connection and try again.');
    }
}

// Track job click and store for later prompt
async function trackJobClick(jobId) {
    console.log('🔗 Job clicked:', jobId);
    
    if (!currentUser) {
        console.log('❌ User not signed in, skipping tracking');
        return;
    }
    
    try {
        const token = await currentUser.getIdToken();
        await fetch('/api/applications/track-click', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ job_id: jobId })
        });
        console.log('✅ Job click tracked successfully');
    } catch (error) {
        console.error('❌ Error tracking job click:', error);
    }
}

// Share job functionality
function shareJob(jobId) {
    const jobUrl = `${window.location.origin}/job/${jobId}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Check out this job opportunity',
            url: jobUrl
        }).catch(console.error);
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(jobUrl).then(() => {
            alert('Job link copied to clipboard!');
        }).catch(() => {
            // Final fallback: show the URL
            prompt('Copy this job link:', jobUrl);
        });
    }
}

// Update navbar counters
function updateNavbarCounters() {
    const savedCount = Object.keys(userSavedJobs).length;
    const appliedCount = Object.keys(userApplications).length;
    
    // Update tracking link with counters
    const trackingLinks = document.querySelectorAll('a[href="/tracking"]');
    trackingLinks.forEach(link => {
        const totalCount = savedCount + appliedCount;
        if (totalCount > 0) {
            link.innerHTML = `Tracking <span class="nav-counter">${totalCount}</span>`;
        } else {
            link.innerHTML = 'Tracking';
        }
    });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeJobActions);
} else {
    initializeJobActions();
} 