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
        ),
    },
    "degree": {
        "fill_selector": selector_union(
            '[data-automation-id="degree"] input',
            '[data-automation-id="degreeReceived"] input',
        ),
        "select_selector": selector_union(
            '[data-automation-id="degree"] [data-automation-id="combobox"]',
            'select[data-automation-id="degree"]',
        ),
    },
    "discipline": {
        "fill_selector": selector_union(
            '[data-automation-id="discipline"] input',
            '[data-automation-id="fieldOfStudy"] input',
            'input[data-automation-id="discipline"]',
        ),
        "select_selector": selector_union(
            '[data-automation-id="discipline"] [data-automation-id="combobox"]',
            '[data-automation-id="fieldOfStudy"] [data-automation-id="combobox"]',
        ),
    },
    "graduation_date": {
        "fill_selector": selector_union(
            '[data-automation-id="dateReceived"] input',
            '[data-automation-id="graduationDate"] input',
        ),
    },
    "gpa": {
        "fill_selector": selector_union(
            '[data-automation-id="gpa"] input',
            'input[data-automation-id="gpa"]',
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
        ),
    },
    "race_ethnicity": {
        "select_selector": selector_union(
            '[data-automation-id="ethnicity"] [data-automation-id="combobox"]',
            '[data-automation-id="raceEthnicity"] [data-automation-id="combobox"]',
            'select[name="race_ethnicity"]',
            'select[name="ethnicity"]',
        ),
    },
    "veteran_status": {
        "select_selector": selector_union(
            '[data-automation-id="veteranStatus"] [data-automation-id="combobox"]',
            'select[data-automation-id="veteranStatus"]',
            'select[name="veteran_status"]',
        ),
    },
    "disability_status": {
        "select_selector": selector_union(
            '[data-automation-id="disabilityStatus"] [data-automation-id="combobox"]',
            'select[data-automation-id="disabilityStatus"]',
            'select[name="disability_status"]',
        ),
    },
}

WORKDAY_HINT_ALIASES = {
    "work_authorization": [
        "are you legally authorized to work",
        "employment eligibility status",
    ],
    "sponsorship_required": [
        "will you now or in the future require employment based visa sponsorship",
        "require employer sponsorship",
    ],
    "onsite_preference": [
        "work arrangement preference",
        "work style preference",
    ],
    "weekly_availability_hours": [
        "hours available each week",
        "weekly hours available",
    ],
    "graduation_window": [
        "anticipated graduation year",
        "expected class year",
    ],
    "commute_preference": [
        "maximum commute distance",
    ],
    "gender": [
        "gender identity voluntary disclosure",
    ],
    "race_ethnicity": [
        "race ethnicity voluntary disclosure",
    ],
    "veteran_status": [
        "protected veteran voluntary disclosure",
    ],
    "disability_status": [
        "disability voluntary disclosure",
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
