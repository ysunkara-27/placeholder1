import os
from datetime import datetime
from firebase_admin import firestore

class SubscriptionManager:
    """
    Simplified subscription manager that provides unlimited access to all users.
    All subscription-related functionality has been removed.
    """
    
    def __init__(self, db: firestore.Client):
        self.db = db
        self.users_ref = db.collection('users')

    def check_and_grant_early_adopter_status(self, user_id: str, user_email: str = None) -> dict:
        """
        Returns that all users have unlimited access - no early adopter limits.
        """
        return {
            'is_early_adopter': False,
            'already_granted': False,
            'unlimited_access': True
        }

    def get_early_adopter_count(self) -> int:
        """Returns 0 as early adopter functionality has been removed."""
        return 0

    def is_early_adopter(self, user_id: str) -> bool:
        """Returns False as early adopter functionality has been removed."""
        return False

    def create_subscription(self, user_id: str, price_id: str) -> dict:
        """
        Returns an error as subscription creation has been disabled.
        """
        raise Exception("Subscription functionality has been disabled. All features are now free.")

    def get_subscription_status(self, user_id: str) -> dict:
        """
        Returns unlimited access status for all users.
        """
        return {
            'status': 'active',
            'type': 'free_unlimited',
            'price_id': 'free',
            'current_period_end': None,
            'is_early_adopter': False,
            'unlimited_access': True
        }

    def cancel_subscription(self, user_id: str) -> bool:
        """
        Returns True as there are no subscriptions to cancel.
        """
        return True

    def handle_webhook_event(self, event: dict) -> bool:
        """
        Returns True as webhook handling is no longer needed.
        """
        return True 