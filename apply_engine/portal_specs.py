from __future__ import annotations


def selector_union(*selectors: str) -> str:
    return ", ".join(selector for selector in selectors if selector)


GREENHOUSE_SELECTORS = {
    "first_name": selector_union(
        'input[name="first_name"]',
        'input[id="first_name"]',
        'input[autocomplete="given-name"]',
    ),
    "last_name": selector_union(
        'input[name="last_name"]',
        'input[id="last_name"]',
        'input[autocomplete="family-name"]',
    ),
    "email": selector_union(
        'input[name="email"]',
        'input[id="email"]',
        'input[type="email"]',
    ),
    "phone": selector_union(
        'input[name="phone"]',
        'input[id="phone"]',
        'input[type="tel"]',
    ),
    "linkedin": selector_union(
        'input[name="linkedin_profile"]',
        'input[id="linkedin_profile"]',
        'input[name="urls[LinkedIn]"]',
    ),
    "website": selector_union(
        'input[name="website"]',
        'input[id="website"]',
        'input[name="urls[Portfolio]"]',
        'input[name="portfolio"]',
    ),
    "resume_upload": selector_union(
        'input[type="file"][name="resume"]',
        'input[type="file"][id="resume"]',
        'input[type="file"]',
    ),
    "work_authorization": selector_union(
        'select[name="work_authorization"]',
        'select[name="questions[work_authorization]"]',
        'input[name="work_authorization"]',
    ),
    "start_date": selector_union(
        'input[name="start_date"]',
        'input[name="available_start_date"]',
        'input[name="questions[start_date]"]',
    ),
    "location_preference": selector_union(
        'input[name="location_preference"]',
        'select[name="location_preference"]',
        'input[name="questions[preferred_location]"]',
    ),
    "salary_expectation": selector_union(
        'input[name="salary_expectation"]',
        'input[name="desired_salary"]',
        'input[name="questions[salary_expectation]"]',
    ),
    "authorized_yes": selector_union(
        'input[name="authorized_to_work"][value="yes"]',
        'input[name="work_authorized"][value="yes"]',
        'input[name="questions[authorized_to_work]"][value="yes"]',
    ),
    "authorized_no": selector_union(
        'input[name="authorized_to_work"][value="no"]',
        'input[name="work_authorized"][value="no"]',
        'input[name="questions[authorized_to_work]"][value="no"]',
    ),
    "sponsorship_yes": selector_union(
        'input[name="sponsorship_required"][value="yes"]',
        'input[name="require_visa"][value="yes"]',
        'input[name="questions[future_sponsorship_required]"][value="yes"]',
    ),
    "sponsorship_no": selector_union(
        'input[name="sponsorship_required"][value="no"]',
        'input[name="require_visa"][value="no"]',
        'input[name="questions[future_sponsorship_required]"][value="no"]',
    ),
    "submit": selector_union(
        'input[type="submit"]',
        'button[type="submit"]',
    ),
    "next": selector_union(
        'button[data-testid="next"]',
        'button[name="button_continue"]',
        'button:has-text("Next")',
        'button:has-text("Continue")',
    ),
}


LEVER_SELECTORS = {
    "name": selector_union(
        'input[name="name"]',
        'input[id="name"]',
        'input[autocomplete="name"]',
    ),
    "email": selector_union(
        'input[name="email"]',
        'input[id="email"]',
        'input[type="email"]',
    ),
    "phone": selector_union(
        'input[name="phone"]',
        'input[id="phone"]',
        'input[type="tel"]',
    ),
    "linkedin": selector_union(
        'input[name="linkedin"]',
        'input[name="linkedin_profile"]',
        'input[id="linkedin"]',
    ),
    "website": selector_union(
        'input[name="urls[Portfolio]"]',
        'input[name="website"]',
        'input[id="website"]',
        'input[name="portfolio"]',
    ),
    "resume_upload": selector_union(
        'input[type="file"][name="resume"]',
        'input[type="file"][id="resume"]',
        'input[type="file"]',
    ),
    "work_authorization": selector_union(
        'select[name="work_authorization"]',
        'select[name="eeo[work_authorization]"]',
        'input[name="work_authorization"]',
    ),
    "start_date": selector_union(
        'input[name="start_date"]',
        'input[name="available_start_date"]',
        'input[name="candidate[start_date]"]',
    ),
    "location_preference": selector_union(
        'input[name="location_preference"]',
        'select[name="location_preference"]',
        'input[name="candidate[location_preference]"]',
    ),
    "salary_expectation": selector_union(
        'input[name="salary_expectation"]',
        'input[name="desired_salary"]',
        'input[name="candidate[salary_expectation]"]',
    ),
    "authorized_yes": selector_union(
        'input[name="authorized_to_work"][value="yes"]',
        'input[name="eeo[authorized_to_work]"][value="yes"]',
    ),
    "authorized_no": selector_union(
        'input[name="authorized_to_work"][value="no"]',
        'input[name="eeo[authorized_to_work]"][value="no"]',
    ),
    "sponsorship_yes": selector_union(
        'input[name="sponsorship_required"][value="yes"]',
        'input[name="eeo[sponsorship_required]"][value="yes"]',
        'input[name="future_sponsorship_required"][value="yes"]',
    ),
    "sponsorship_no": selector_union(
        'input[name="sponsorship_required"][value="no"]',
        'input[name="eeo[sponsorship_required]"][value="no"]',
        'input[name="future_sponsorship_required"][value="no"]',
    ),
    "submit": selector_union(
        'button[data-qa="btn-submit"]',
        'button[id="btn-submit"]',
        'button.postings-btn.template-btn-submit',
        'button[type="submit"]',
        'input[type="submit"]',
    ),
    "next": selector_union(
        'button:has-text("Next")',
        'button:has-text("Continue")',
    ),
}


GREENHOUSE_CUSTOM_SELECTORS = {
    "school": {
        "fill_selector": selector_union(
            'input[name="school"]',
            'input[name="education[school]"]',
            'input[name="questions[school]"]',
            'input[id="school-name--0"]',
            'input[id^="school-name--"]',
            'input[id*="school-name--"]',
            'input[id^="school--"]',
            'input[id*="school--"]',
        ),
    },
    "degree": {
        "fill_selector": selector_union(
            'input[name="degree"]',
            'input[name="education[degree]"]',
            'input[name="questions[degree]"]',
            'input[id^="degree--"]',
            'input[id*="degree--"]',
        ),
    },
    "discipline": {
        "fill_selector": selector_union(
            'input[name="discipline"]',
            'input[name="education[discipline]"]',
            'input[name="questions[discipline]"]',
            'input[id^="discipline--"]',
            'input[id*="discipline--"]',
        ),
    },
    "start_month": {
        "fill_selector": selector_union(
            'input[name="start_month"]',
            'input[name="education[start_month]"]',
            'input[name="questions[start_month]"]',
            'input[id="start-month--0"]',
            'input[id^="start-month--"]',
            'input[id*="start-month--"]',
        ),
    },
    "start_year": {
        "fill_selector": selector_union(
            'input[name="start_year"]',
            'input[name="education[start_year]"]',
            'input[name="questions[start_year]"]',
            'input[id="start-year--0"]',
            'input[id^="start-year--"]',
            'input[id*="start-year--"]',
        ),
    },
    "end_month": {
        "fill_selector": selector_union(
            'input[name="end_month"]',
            'input[name="education[end_month]"]',
            'input[name="questions[end_month]"]',
            'input[id="end-month--0"]',
            'input[id^="end-month--"]',
            'input[id*="end-month--"]',
        ),
    },
    "end_year": {
        "fill_selector": selector_union(
            'input[name="end_year"]',
            'input[name="education[end_year]"]',
            'input[name="questions[end_year]"]',
            'input[id="end-year--0"]',
            'input[id^="end-year--"]',
            'input[id*="end-year--"]',
        ),
    },
    "graduation_date": {
        "fill_selector": selector_union(
            'input[name="graduation_date"]',
            'input[name="education[graduation_date]"]',
            'input[name="questions[graduation_date]"]',
        ),
    },
    "gpa": {
        "fill_selector": selector_union(
            'input[name="gpa"]',
            'input[name="education[gpa]"]',
            'input[name="questions[gpa]"]',
        ),
    },
    "relocation": {
        "yes_selector": selector_union(
            'input[name="willing_to_relocate"][value="yes"]',
            'input[name="questions[willing_to_relocate]"][value="yes"]',
        ),
        "no_selector": selector_union(
            'input[name="willing_to_relocate"][value="no"]',
            'input[name="questions[willing_to_relocate]"][value="no"]',
        ),
    },
    "heard_about_us": {
        "select_selector": selector_union(
            'select[name="heard_about_us"]',
            'select[name="questions[heard_about_us]"]',
        ),
        "fill_selector": selector_union(
            'input[name="heard_about_us"]',
            'input[name="questions[heard_about_us]"]',
        ),
    },
    "onsite_preference": {
        "select_selector": selector_union(
            'select[name="onsite_preference"]',
            'select[name="questions[onsite_preference]"]',
            'select[name="work_mode_preference"]',
        ),
        "fill_selector": selector_union(
            'input[name="onsite_preference"]',
            'input[name="questions[onsite_preference]"]',
            'input[name="work_mode_preference"]',
        ),
    },
    "weekly_availability_hours": {
        "fill_selector": selector_union(
            'input[name="weekly_availability_hours"]',
            'input[name="questions[weekly_availability_hours]"]',
            'input[name="hours_per_week"]',
        ),
    },
    "graduation_window": {
        "fill_selector": selector_union(
            'input[name="graduation_window"]',
            'input[name="questions[graduation_window]"]',
            'input[name="class_year"]',
        ),
    },
    "commute_preference": {
        "fill_selector": selector_union(
            'input[name="commute_preference"]',
            'input[name="questions[commute_preference]"]',
            'input[name="commute_radius"]',
        ),
    },
    "gender": {
        "select_selector": selector_union(
            'select[name="gender"]',
            'select[name="questions[gender]"]',
            'select[name*="gender"]',
        ),
    },
    "race_ethnicity": {
        "select_selector": selector_union(
            'select[name="race_ethnicity"]',
            'select[name="questions[race_ethnicity]"]',
            'select[name*="race"]',
            'select[name*="ethnicity"]',
        ),
    },
    "veteran_status": {
        "select_selector": selector_union(
            'select[name="veteran_status"]',
            'select[name="questions[veteran_status]"]',
            'select[name*="veteran"]',
        ),
    },
    "disability_status": {
        "select_selector": selector_union(
            'select[name="disability_status"]',
            'select[name="questions[disability_status]"]',
            'select[name*="disability"]',
        ),
    },
}

GREENHOUSE_HINT_ALIASES = {
    "work_authorization": [
        "authorized for employment in the united states",
        "eligible to work in the united states",
        "itar",
        "u.s. person",
        "eligible to work with itar",
        "export control",
        "lawful permanent resident",
        "protected individual",
    ],
    "sponsorship_required": [
        "require immigration sponsorship",
        "need visa sponsorship in the future",
    ],
    "heard_about_us": [
        "how did you hear about this opportunity",
        "applicant source",
    ],
    "onsite_preference": [
        "preferred work arrangement",
        "work setup preference",
        "office cadence preference",
    ],
    "weekly_availability_hours": [
        "how many hours can you work each week",
        "hours available per week",
    ],
    "gender": [
        "voluntary self identification of gender",
    ],
    "race_ethnicity": [
        "voluntary self identification of race ethnicity",
    ],
    "veteran_status": [
        "voluntary self identification of veteran status",
    ],
    "disability_status": [
        "voluntary self identification of disability",
    ],
}


WORKDAY_SELECTORS = {
    # Personal info — Workday uses data-automation-id as the primary stable hook.
    # Each field is a label+input pair inside a section panel.
    "first_name": selector_union(
        '[data-automation-id="legalNameSection_firstName"] input',
        '[data-automation-id="firstName"] input',
        'input[data-automation-id="firstName"]',
        'input[name="firstName"]',
    ),
    "last_name": selector_union(
        '[data-automation-id="legalNameSection_lastName"] input',
        '[data-automation-id="lastName"] input',
        'input[data-automation-id="lastName"]',
        'input[name="lastName"]',
    ),
    "email": selector_union(
        '[data-automation-id="email"] input',
        'input[data-automation-id="email"]',
        'input[type="email"]',
    ),
    "phone": selector_union(
        '[data-automation-id="phone-number"] input',
        '[data-automation-id="phoneNumber"] input',
        'input[data-automation-id="phone-number"]',
        'input[type="tel"]',
    ),
    "address_line1": selector_union(
        '[data-automation-id="addressLine1"] input',
        'input[data-automation-id="addressLine1"]',
    ),
    "city": selector_union(
        '[data-automation-id="city"] input',
        'input[data-automation-id="city"]',
    ),
    "state": selector_union(
        '[data-automation-id="state"] [data-automation-id="combobox"]',
        'select[data-automation-id="state"]',
    ),
    "zip": selector_union(
        '[data-automation-id="postalCode"] input',
        'input[data-automation-id="postalCode"]',
    ),
    # Resume upload — Workday hides its file input; it reveals on button click.
    # We target the hidden input directly.
    "resume_upload": selector_union(
        '[data-automation-id="file-upload-input-ref"]',
        'input[data-automation-id="fileInput"]',
        'input[type="file"]',
    ),
    # Work authorization dropdown — varies by country config.
    "work_authorization": selector_union(
        '[data-automation-id="countryDropdown"] [data-automation-id="combobox"]',
        '[data-automation-id="workAuthorizationStatus"] [data-automation-id="combobox"]',
        'select[data-automation-id="workAuthorizationStatus"]',
    ),
    # Sponsorship / visa questions (yes/no radio pattern).
    "sponsorship_yes": selector_union(
        '[data-automation-id="visaSponsorship"] [data-automation-id="Yes"]',
        'input[data-automation-id="sponsorshipRequired"][value="Yes"]',
        '[data-automation-id="requireVisa"][data-automation-id="Yes"]',
    ),
    "sponsorship_no": selector_union(
        '[data-automation-id="visaSponsorship"] [data-automation-id="No"]',
        'input[data-automation-id="sponsorshipRequired"][value="No"]',
        '[data-automation-id="requireVisa"][data-automation-id="No"]',
    ),
    # Navigation — Workday uses a single bottom-nav button that changes label per step.
    "next": selector_union(
        '[data-automation-id="bottom-navigation-next-btn"]',
        'button[data-automation-id="bottom-navigation-next-btn"]',
        'button[data-automation-id*="nextButton"]',
    ),
    "submit": selector_union(
        '[data-automation-id="bottom-navigation-next-btn"]',
        'button[data-automation-id="bottom-navigation-next-btn"]',
    ),
    # Confirmation signals
    "confirmation_heading": selector_union(
        '[data-automation-id="thankYouMessage"]',
        '[data-automation-id="confirmationHeading"]',
    ),
}

WORKDAY_CUSTOM_SELECTORS = {
    "school": {
        "fill_selector": selector_union(
            '[data-automation-id="school"] input',
            '[data-automation-id="schoolName"] input',
            'input[data-automation-id="school"]',
            '[data-automation-id*="school"] input',
            '[data-automation-id*="university"] input',
            '[data-automation-id*="institution"] input',
        ),
    },
    "degree": {
        "fill_selector": selector_union(
            '[data-automation-id="degree"] input',
            '[data-automation-id="degreeReceived"] input',
            '[data-automation-id*="degree"] input',
            '[data-automation-id*="levelOfEducation"] input',
            '[data-automation-id*="educationLevel"] input',
        ),
        "select_selector": selector_union(
            '[data-automation-id="degree"] [data-automation-id="combobox"]',
            'select[data-automation-id="degree"]',
            '[data-automation-id*="degree"] [data-automation-id="combobox"]',
            '[data-automation-id*="levelOfEducation"] [data-automation-id="combobox"]',
            '[data-automation-id*="educationLevel"] [data-automation-id="combobox"]',
        ),
    },
    "discipline": {
        "fill_selector": selector_union(
            '[data-automation-id="discipline"] input',
            '[data-automation-id="fieldOfStudy"] input',
            'input[data-automation-id="discipline"]',
            '[data-automation-id*="fieldOfStudy"] input',
            '[data-automation-id*="major"] input',
            '[data-automation-id*="discipline"] input',
            '[data-automation-id*="concentration"] input',
        ),
        "select_selector": selector_union(
            '[data-automation-id="discipline"] [data-automation-id="combobox"]',
            '[data-automation-id="fieldOfStudy"] [data-automation-id="combobox"]',
            '[data-automation-id*="fieldOfStudy"] [data-automation-id="combobox"]',
            '[data-automation-id*="major"] [data-automation-id="combobox"]',
            '[data-automation-id*="discipline"] [data-automation-id="combobox"]',
        ),
    },
    "graduation_date": {
        "fill_selector": selector_union(
            '[data-automation-id="dateReceived"] input',
            '[data-automation-id="graduationDate"] input',
            '[data-automation-id*="graduationDate"] input',
            '[data-automation-id*="endDate"] input',
            '[data-automation-id*="expectedGraduation"] input',
        ),
    },
    "gpa": {
        "fill_selector": selector_union(
            '[data-automation-id="gpa"] input',
            'input[data-automation-id="gpa"]',
            '[data-automation-id*="gpa"] input',
            '[data-automation-id*="gradePointAverage"] input',
        ),
    },
    "start_month": {
        "fill_selector": selector_union(
            '[data-automation-id="startMonth"] input',
            '[data-automation-id*="startMonth"] input',
        ),
        "select_selector": selector_union(
            '[data-automation-id="startMonth"] [data-automation-id="combobox"]',
            '[data-automation-id*="startMonth"] [data-automation-id="combobox"]',
        ),
    },
    "start_year": {
        "fill_selector": selector_union(
            '[data-automation-id="startYear"] input',
            '[data-automation-id*="startYear"] input',
        ),
    },
    "end_month": {
        "fill_selector": selector_union(
            '[data-automation-id="endMonth"] input',
            '[data-automation-id*="endMonth"] input',
        ),
        "select_selector": selector_union(
            '[data-automation-id="endMonth"] [data-automation-id="combobox"]',
            '[data-automation-id*="endMonth"] [data-automation-id="combobox"]',
        ),
    },
    "end_year": {
        "fill_selector": selector_union(
            '[data-automation-id="endYear"] input',
            '[data-automation-id*="endYear"] input',
        ),
    },
    "relocation": {
        "yes_selector": selector_union(
            '[data-automation-id="relocation"] [data-automation-id="Yes"]',
            'input[data-automation-id="relocation"][value="Yes"]',
            'input[name="relocation"][value="Yes"]',
        ),
        "no_selector": selector_union(
            '[data-automation-id="relocation"] [data-automation-id="No"]',
            'input[data-automation-id="relocation"][value="No"]',
            'input[name="relocation"][value="No"]',
        ),
    },
    "onsite_preference": {
        "select_selector": selector_union(
            '[data-automation-id="workStyle"] [data-automation-id="combobox"]',
            '[data-automation-id="workArrangement"] [data-automation-id="combobox"]',
        ),
        "fill_selector": selector_union(
            '[data-automation-id="workStyle"] input',
        ),
    },
    "weekly_availability_hours": {
        "fill_selector": selector_union(
            '[data-automation-id="hoursPerWeek"] input',
            '[data-automation-id="weeklyAvailability"] input',
            'input[data-automation-id="hoursPerWeek"]',
            'input[name="hoursPerWeek"]',
        ),
    },
    "graduation_window": {
        "fill_selector": selector_union(
            '[data-automation-id="classYear"] input',
            '[data-automation-id="graduationWindow"] input',
            'input[data-automation-id="classYear"]',
            'input[name="classYear"]',
        ),
    },
    "commute_preference": {
        "fill_selector": selector_union(
            '[data-automation-id="commutePreference"] input',
            '[data-automation-id="commuteRadius"] input',
            'input[data-automation-id="commutePreference"]',
            'input[name="commutePreference"]',
        ),
    },
    "heard_about_us": {
        "select_selector": selector_union(
            '[data-automation-id="howDidYouHearAboutUs"] [data-automation-id="combobox"]',
            '[data-automation-id="source"] [data-automation-id="combobox"]',
        ),
        "fill_selector": selector_union(
            '[data-automation-id="howDidYouHearAboutUs"] input',
        ),
    },
    "gender": {
        "select_selector": selector_union(
            '[data-automation-id="gender"] [data-automation-id="combobox"]',
            'select[data-automation-id="gender"]',
            'select[name="gender"]',
            '[data-automation-id*="gender"] [data-automation-id="combobox"]',
        ),
    },
    "race_ethnicity": {
        "select_selector": selector_union(
            '[data-automation-id="ethnicity"] [data-automation-id="combobox"]',
            '[data-automation-id="raceEthnicity"] [data-automation-id="combobox"]',
            'select[name="race_ethnicity"]',
            'select[name="ethnicity"]',
            '[data-automation-id*="ethnicity"] [data-automation-id="combobox"]',
            '[data-automation-id*="race"] [data-automation-id="combobox"]',
        ),
    },
    "veteran_status": {
        "select_selector": selector_union(
            '[data-automation-id="veteranStatus"] [data-automation-id="combobox"]',
            'select[data-automation-id="veteranStatus"]',
            'select[name="veteran_status"]',
            '[data-automation-id*="veteran"] [data-automation-id="combobox"]',
        ),
    },
    "disability_status": {
        "select_selector": selector_union(
            '[data-automation-id="disabilityStatus"] [data-automation-id="combobox"]',
            'select[data-automation-id="disabilityStatus"]',
            'select[name="disability_status"]',
            '[data-automation-id*="disability"] [data-automation-id="combobox"]',
            '[data-automation-id*="disabilityStatus"] [data-automation-id="combobox"]',
        ),
    },
}

WORKDAY_HINT_ALIASES: dict[str, list[str]] = {
    "work_authorization": [
        "are you legally authorized to work",
        "employment eligibility status",
        "authorized to work",
        "legally authorized",
        "eligible to work",
        "work in the united states",
        "employment authorization",
        "itar",
        "u.s. person",
        "export control",
    ],
    "sponsorship_required": [
        "will you now or in the future require employment based visa sponsorship",
        "require employer sponsorship",
        "require visa sponsorship",
        "sponsorship now",
        "sponsorship in the future",
        "work visa",
    ],
    "school": ["university", "college", "institution", "school name", "where did you attend"],
    "degree": ["degree", "level of education", "highest level", "degree type", "educational level"],
    "discipline": ["field of study", "major", "concentration", "area of study", "program of study"],
    "graduation_date": ["graduation", "expected graduation", "degree date", "completion date"],
    "gpa": ["grade point", "gpa", "cumulative gpa"],
    "start_date": ["start date", "available to start", "earliest start", "when can you start"],
    "weekly_availability_hours": [
        "hours available each week",
        "weekly hours available",
        "hours per week",
        "weekly hours",
        "hours available",
        "work per week",
    ],
    "onsite_preference": [
        "work arrangement preference",
        "work style preference",
        "onsite",
        "on-site",
        "hybrid",
        "remote or onsite",
        "work arrangement",
    ],
    "relocation": ["willing to relocate", "open to relocation", "relocation"],
    "salary_expectation": ["salary", "compensation", "pay expectation", "desired salary"],
    "heard_about_us": ["how did you hear", "how did you find", "referral source"],
    "graduation_window": [
        "anticipated graduation year",
        "expected class year",
    ],
    "commute_preference": [
        "maximum commute distance",
        "commute",
        "willing to commute",
    ],
    "gender": [
        "gender identity voluntary disclosure",
        "gender",
        "gender identity",
    ],
    "race_ethnicity": [
        "race ethnicity voluntary disclosure",
        "race",
        "ethnicity",
        "racial",
        "ethnic",
    ],
    "veteran_status": [
        "protected veteran voluntary disclosure",
        "veteran",
        "military service",
        "protected veteran",
    ],
    "disability_status": [
        "disability voluntary disclosure",
        "disability",
        "disabled",
        "accommodation",
    ],
}


ASHBY_SELECTORS = {
    "apply_button": selector_union(
        "[data-testid='apply-button']",
        "button:has-text('Apply')",
        "a:has-text('Apply')",
    ),
    "full_name": selector_union(
        "input[name='_systemfield_name']",
        "input[placeholder*='Name']",
        "input[placeholder*='name']",
    ),
    "first_name": selector_union(
        "input[placeholder*='First']",
        "input[placeholder*='first']",
    ),
    "last_name": selector_union(
        "input[placeholder*='Last']",
        "input[placeholder*='last']",
    ),
    "email": selector_union(
        "input[name='_systemfield_email']",
        "input[type='email']",
    ),
    "phone": selector_union(
        "input[name='_systemfield_phone']",
        "input[type='tel']",
    ),
    "location": selector_union(
        "input[name='_systemfield_location']",
        "input[placeholder*='Location']",
        "input[placeholder*='location']",
    ),
    "linkedin": selector_union(
        "input[name*='linkedin']",
        "input[placeholder*='LinkedIn']",
        "input[placeholder*='linkedin']",
    ),
    "website": selector_union(
        "input[name*='website']",
        "input[placeholder*='website']",
        "input[placeholder*='Website']",
        "input[placeholder*='portfolio']",
    ),
    "github": selector_union(
        "input[name*='github']",
        "input[placeholder*='GitHub']",
        "input[placeholder*='github']",
    ),
    "resume_upload": selector_union(
        "input[type='file'][name*='resume']",
        "input[type='file'][data-testid*='resume']",
        "input[type='file']",
    ),
    "submit": selector_union(
        "button[type='submit']",
        "button:has-text('Submit Application')",
        "button:has-text('Submit')",
    ),
    "next": selector_union(
        "button:has-text('Next')",
        "button:has-text('Continue')",
    ),
}


LEVER_CUSTOM_SELECTORS = {
    "school": {
        "fill_selector": selector_union(
            'input[name="school"]',
            'input[name="candidate[school]"]',
            'input[name="education[school]"]',
        ),
    },
    "degree": {
        "fill_selector": selector_union(
            'input[name="degree"]',
            'input[name="candidate[degree]"]',
            'input[name="education[degree]"]',
        ),
    },
    "discipline": {
        "fill_selector": selector_union(
            'input[name="discipline"]',
            'input[name="candidate[discipline]"]',
            'input[name="education[discipline]"]',
        ),
    },
    "graduation_date": {
        "fill_selector": selector_union(
            'input[name="graduation_date"]',
            'input[name="candidate[graduation_date]"]',
            'input[name="education[graduation_date]"]',
        ),
    },
    "gpa": {
        "fill_selector": selector_union(
            'input[name="gpa"]',
            'input[name="candidate[gpa]"]',
            'input[name="education[gpa]"]',
        ),
    },
    "relocation": {
        "yes_selector": selector_union(
            'input[name="willing_to_relocate"][value="yes"]',
            'input[name="candidate[willing_to_relocate]"][value="yes"]',
        ),
        "no_selector": selector_union(
            'input[name="willing_to_relocate"][value="no"]',
            'input[name="candidate[willing_to_relocate]"][value="no"]',
        ),
    },
    "heard_about_us": {
        "select_selector": selector_union(
            'select[name="heard_about_us"]',
            'select[name="candidate[heard_about_us]"]',
        ),
        "fill_selector": selector_union(
            'input[name="heard_about_us"]',
            'input[name="candidate[heard_about_us]"]',
        ),
    },
    "onsite_preference": {
        "select_selector": selector_union(
            'select[name="onsite_preference"]',
            'select[name="candidate[onsite_preference]"]',
            'select[name="work_mode_preference"]',
        ),
        "fill_selector": selector_union(
            'input[name="onsite_preference"]',
            'input[name="candidate[onsite_preference]"]',
            'input[name="work_mode_preference"]',
        ),
    },
    "weekly_availability_hours": {
        "fill_selector": selector_union(
            'input[name="weekly_availability_hours"]',
            'input[name="candidate[weekly_availability_hours]"]',
            'input[name="hours_per_week"]',
        ),
    },
    "graduation_window": {
        "fill_selector": selector_union(
            'input[name="graduation_window"]',
            'input[name="candidate[graduation_window]"]',
            'input[name="class_year"]',
        ),
    },
    "commute_preference": {
        "fill_selector": selector_union(
            'input[name="commute_preference"]',
            'input[name="candidate[commute_preference]"]',
            'input[name="commute_radius"]',
        ),
    },
    "gender": {
        "select_selector": selector_union(
            'select[name="gender"]',
            'select[name="candidate[gender]"]',
            'select[name*="gender"]',
        ),
    },
    "race_ethnicity": {
        "select_selector": selector_union(
            'select[name="race_ethnicity"]',
            'select[name="candidate[race_ethnicity]"]',
            'select[name*="race"]',
            'select[name*="ethnicity"]',
        ),
    },
    "veteran_status": {
        "select_selector": selector_union(
            'select[name="veteran_status"]',
            'select[name="candidate[veteran_status]"]',
            'select[name*="veteran"]',
        ),
    },
    "disability_status": {
        "select_selector": selector_union(
            'select[name="disability_status"]',
            'select[name="candidate[disability_status]"]',
            'select[name*="disability"]',
        ),
    },
}

LEVER_HINT_ALIASES = {
    "work_authorization": [
        "authorized for employment in the country of hire",
        "legally eligible for employment",
    ],
    "sponsorship_required": [
        "require visa sponsorship now or in the future",
        "need immigration sponsorship",
    ],
    "heard_about_us": [
        "how did you hear about this job",
        "candidate source",
    ],
    "onsite_preference": [
        "preferred work environment",
        "work arrangement preference",
        "office cadence preference",
    ],
    "weekly_availability_hours": [
        "how many hours per week can you work",
        "weekly availability in hours",
    ],
    "gender": [
        "gender voluntary self identification",
    ],
    "race_ethnicity": [
        "race ethnicity voluntary self identification",
    ],
    "veteran_status": [
        "protected veteran classification",
    ],
    "disability_status": [
        "voluntary disability self identification",
    ],
}


# ─── Ashby ────────────────────────────────────────────────────────────────────

ASHBY_HINT_ALIASES: dict[str, list[str]] = {
    "work_authorization": [
        "authorized to work",
        "legally authorized",
        "eligible to work",
        "work in the united states",
        "employment authorization",
        "sponsorship",
    ],
    "sponsorship_required": [
        "require sponsorship",
        "visa sponsorship",
        "need sponsorship",
        "sponsor your visa",
    ],
    "school": ["university", "college", "institution", "school", "where did you study", "alma mater"],
    "degree": ["degree", "level of education", "degree type", "highest degree"],
    "discipline": ["field of study", "major", "concentration", "area of study"],
    "graduation_date": ["graduation", "expected graduation", "when did you graduate"],
    "gpa": ["gpa", "grade point", "cumulative gpa"],
    "start_date": ["start date", "available to start", "when can you start", "earliest start"],
    "weekly_availability_hours": ["hours per week", "weekly hours", "hours available"],
    "onsite_preference": ["onsite", "hybrid", "remote", "work arrangement", "work location preference"],
    "relocation": ["relocate", "relocation", "willing to move"],
    "salary_expectation": ["salary", "compensation", "pay expectation", "desired pay"],
    "heard_about_us": ["how did you hear", "how did you find", "referral"],
    "gender": ["gender", "gender identity"],
    "race_ethnicity": ["race", "ethnicity", "racial", "ethnic background"],
    "veteran_status": ["veteran", "military", "protected veteran"],
    "disability_status": ["disability", "disabled", "accommodation"],
    "linkedin": ["linkedin", "linkedin url", "linkedin profile"],
    "website": ["website", "portfolio", "personal website"],
    "github": ["github", "github url", "github profile"],
}

ASHBY_CUSTOM_SELECTORS: dict[str, str] = {
    # Contact
    "first_name": "[data-testid='firstName-input'], input[name='firstName'], input[placeholder*='First']",
    "last_name": "[data-testid='lastName-input'], input[name='lastName'], input[placeholder*='Last']",
    "full_name": "[data-testid='name-input'], input[name='name'], input[placeholder*='Full name'], input[placeholder*='Name']",
    "email": "[data-testid='email-input'], input[type='email'], input[name='email']",
    "phone": "[data-testid='phone-input'], input[type='tel'], input[name='phone']",
    "linkedin_url": "[data-testid='linkedin-input'], input[name='linkedin'], input[placeholder*='linkedin.com']",
    "website_url": "[data-testid='website-input'], input[name='website'], input[placeholder*='portfolio'], input[placeholder*='website']",
    "github_url": "[data-testid='github-input'], input[name='github'], input[placeholder*='github.com']",
    "location": "[data-testid='location-input'], input[name='location'], input[placeholder*='City']",
    # Resume
    "resume": "input[type='file'][name*='resume'], input[type='file'][accept*='pdf']",
    # Work auth (radio/select)
    "authorized_yes": "input[type='radio'][value*='yes'][name*='authorized'], input[type='radio'][value*='true'][name*='authorized']",
    "authorized_no": "input[type='radio'][value*='no'][name*='authorized'], input[type='radio'][value*='false'][name*='authorized']",
    "sponsorship_yes": "input[type='radio'][value*='yes'][name*='sponsor'], input[type='radio'][value*='true'][name*='sponsor']",
    "sponsorship_no": "input[type='radio'][value*='no'][name*='sponsor'], input[type='radio'][value*='false'][name*='sponsor']",
    # Education
    "school": "input[name*='school'], input[name*='university'], input[placeholder*='School'], input[placeholder*='University']",
    "degree": "select[name*='degree'], input[name*='degree'], input[placeholder*='Degree']",
    "discipline": "input[name*='major'], input[name*='field'], input[placeholder*='Major'], input[placeholder*='Field of study']",
    "graduation_date": "input[name*='graduation'], input[placeholder*='Graduation'], input[placeholder*='Expected graduation']",
    "gpa": "input[name*='gpa'], input[placeholder*='GPA']",
}


# ─── iCIMS ────────────────────────────────────────────────────────────────────

ICIMS_HINT_ALIASES: dict[str, list[str]] = {
    "work_authorization": [
        "authorized to work",
        "legally authorized",
        "eligible to work",
        "employment authorization",
        "right to work",
        "itar",
        "u.s. person",
        "export control",
        "work in the united states",
        "work in the us",
    ],
    "sponsorship_required": [
        "require sponsorship",
        "visa sponsorship",
        "require a visa",
        "employer sponsorship",
        "need sponsorship",
        "future sponsorship",
    ],
    "school": ["university", "college", "institution", "school", "where did you attend", "alma mater"],
    "degree": ["degree", "level of education", "degree type", "highest degree", "educational attainment", "degree earned"],
    "discipline": ["field of study", "major", "concentration", "area of study", "program", "course of study"],
    "graduation_date": ["graduation", "expected graduation", "degree date", "completion date", "graduated"],
    "gpa": ["gpa", "grade point average", "cumulative gpa", "academic gpa"],
    "start_date": ["start date", "available to start", "earliest start", "when can you start", "when are you available"],
    "weekly_availability_hours": ["hours per week", "weekly hours", "hours available", "how many hours"],
    "onsite_preference": ["onsite", "on-site", "hybrid", "remote", "work arrangement", "work location"],
    "relocation": ["willing to relocate", "open to relocation", "able to relocate"],
    "salary_expectation": ["salary", "compensation", "pay expectation", "desired salary", "expected salary"],
    "heard_about_us": ["how did you hear", "how did you find", "referral source", "how did you learn"],
    "gender": ["gender", "gender identity", "sex"],
    "race_ethnicity": ["race", "ethnicity", "racial", "ethnic"],
    "veteran_status": ["veteran", "military service", "protected veteran", "military status"],
    "disability_status": ["disability", "disabled", "physical or mental impairment"],
    "linkedin": ["linkedin", "linkedin profile", "linkedin url"],
    "website": ["website", "portfolio", "personal website", "personal url"],
    "github": ["github", "github profile", "github url"],
    "cover_letter": ["cover letter", "cover letter text", "letter of interest"],
}

ICIMS_SELECTORS: dict[str, str] = {
    # iCIMS Classic selectors (id-based)
    "first_name": "#iCIMS_MainColumn input[id*='firstname'], #iCIMS_MainColumn input[id*='FirstName'], input[name='applicant.field.required.Name.first'], input[name*='firstName']",
    "last_name": "#iCIMS_MainColumn input[id*='lastname'], #iCIMS_MainColumn input[id*='LastName'], input[name='applicant.field.required.Name.last'], input[name*='lastName']",
    "email": "#iCIMS_MainColumn input[type='email'], input[name*='email'], input[id*='email']",
    "phone": "#iCIMS_MainColumn input[id*='phone'], input[name*='phone'], input[type='tel']",
    "linkedin_url": "input[name*='linkedin'], input[id*='linkedin'], input[placeholder*='linkedin.com']",
    "website_url": "input[name*='website'], input[name*='portfolio'], input[placeholder*='website']",
    "resume_upload": "input[type='file'][name*='resume'], input[type='file'][id*='resume'], input[type='file'][accept*='pdf'], #iCIMS_MainColumn input[type='file']",
    "cover_letter": "textarea[name*='coverLetter'], textarea[id*='cover'], textarea[placeholder*='cover letter']",
    # Work auth (iCIMS uses radio buttons or dropdowns)
    "authorized_yes": "input[type='radio'][value*='Yes'][name*='authorized'], input[type='radio'][value*='yes'][name*='authorized'], input[type='radio'][value='1'][name*='authorized']",
    "authorized_no": "input[type='radio'][value*='No'][name*='authorized'], input[type='radio'][value*='no'][name*='authorized'], input[type='radio'][value='0'][name*='authorized']",
    "sponsorship_yes": "input[type='radio'][value*='Yes'][name*='sponsor'], input[type='radio'][value*='yes'][name*='sponsor']",
    "sponsorship_no": "input[type='radio'][value*='No'][name*='sponsor'], input[type='radio'][value*='no'][name*='sponsor']",
    # Education
    "school": "input[name*='school'], input[name*='university'], input[id*='school'], input[placeholder*='School']",
    "degree": "select[name*='degree'], input[name*='degree'], select[id*='degree']",
    "discipline": "input[name*='major'], input[name*='field'], input[name*='discipline']",
    "graduation_date": "input[name*='graduation'], input[id*='graduation']",
    "gpa": "input[name*='gpa'], input[id*='gpa']",
    # Modern iCIMS (React-based Talent Cloud)
    "first_name_modern": "input[data-field-id='firstName'], input[aria-label*='First Name'], input[placeholder*='First Name']",
    "last_name_modern": "input[data-field-id='lastName'], input[aria-label*='Last Name'], input[placeholder*='Last Name']",
    "email_modern": "input[data-field-id='email'], input[aria-label*='Email']",
    "phone_modern": "input[data-field-id='phone'], input[aria-label*='Phone']",
}
