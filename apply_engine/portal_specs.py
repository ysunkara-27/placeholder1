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
        ),
    },
    "degree": {
        "fill_selector": selector_union(
            'input[name="degree"]',
            'input[name="education[degree]"]',
            'input[name="questions[degree]"]',
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
}
