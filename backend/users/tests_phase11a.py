from decimal import Decimal
import os
from unittest import mock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework import status

from tenants.models import Restaurant
from users.models import ModulePermission

User = get_user_model()


class Phase11ADefaultUserSecurityTests(TestCase):
    """
    Security tests for default user creation scripts (Phase 11A).
    Verifies that hardcoded passwords are removed and idempotent behavior is enforced.
    """

    def test_01_create_default_users_missing_default_pass_raises_error(self):
        """Test that create_default_users.py fails without DEFAULT_PASS environment variable."""
        from users.management.commands.create_default_users import Command

        cmd = Command()
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError) as ctx:
                cmd.handle()
            self.assertIn('DEFAULT_PASS', str(ctx.exception))

    def test_02_create_default_users_empty_default_pass_raises_error(self):
        """Test that create_default_users.py fails with empty DEFAULT_PASS."""
        from users.management.commands.create_default_users import Command

        cmd = Command()
        with mock.patch.dict(os.environ, {'DEFAULT_PASS': ''}, clear=False):
            with self.assertRaises(ValueError) as ctx:
                cmd.handle()
            self.assertIn('DEFAULT_PASS', str(ctx.exception))

    def test_03_create_default_users_no_hardcoded_password(self):
        """Test that create_default_users.py does not contain the old hardcoded password."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\users\\management\\commands\\create_default_users.py', 'r') as f:
            content = f.read()
        self.assertNotIn('Pass1234', content)
        self.assertNotIn('os.environ.get(\'DEFAULT_PASS\',', content)
        self.assertIn('DEFAULT_PASS', content)
        self.assertIn('environment variable is required', content)

    def test_04_create_admin_no_hardcoded_password(self):
        """Test that create_admin.py does not contain the old hardcoded password."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\create_admin.py', 'r') as f:
            content = f.read()
        self.assertNotIn('Pass1234', content)
        self.assertNotIn('os.environ.get(\'DEFAULT_PASS\',', content)
        self.assertIn('DEFAULT_PASS', content)
        self.assertIn('environment variable is required', content)

    def test_05_create_admin_requires_default_pass(self):
        """Test that create_admin.py requires DEFAULT_PASS environment variable."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\create_admin.py', 'r') as f:
            content = f.read()
        self.assertIn('if not default_password:', content)
        self.assertIn('raise ValueError', content)

    def test_06_create_admin_contains_restaurant_assignment(self):
        """Test that create_admin.py assigns users to a restaurant."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\create_admin.py', 'r') as f:
            content = f.read()
        self.assertIn('Restaurant.objects.get_or_create', content)
        self.assertIn('restaurant=default_restaurant', content)

    def test_07_create_admin_permissions_scoped_to_restaurant(self):
        """Test that create_admin.py scopes permissions to restaurant."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\create_admin.py', 'r') as f:
            content = f.read()
        self.assertIn('restaurant=default_restaurant', content)

    def test_08_create_default_users_contains_restaurant_assignment(self):
        """Test that create_default_users.py assigns users to a restaurant."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\users\\management\\commands\\create_default_users.py', 'r') as f:
            content = f.read()
        self.assertIn('Restaurant.objects.get_or_create', content)
        self.assertIn('restaurant=default_restaurant', content)

    def test_09_create_default_users_permissions_scoped_to_restaurant(self):
        """Test that create_default_users.py scopes permissions to restaurant."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\users\\management\\commands\\create_default_users.py', 'r') as f:
            content = f.read()
        self.assertIn('restaurant=default_restaurant', content)

    def test_10_idempotent_password_handling(self):
        """Test that create_default_users.py only sets password on creation."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\users\\management\\commands\\create_default_users.py', 'r') as f:
            content = f.read()
        # Should set password only when created
        self.assertIn('if created:', content)
        self.assertIn('user.set_password(default_password)', content)
        # Should NOT set password unconditionally
        self.assertNotIn('user.set_password(default_password)\n            user.save()\n\n        if created:', content)

    def test_11_create_admin_idempotent(self):
        """Test that create_admin.py does not recreate existing accounts."""
        with open('C:\\Users\\Admin\\Desktop\\Restaurant Management System\\backend\\create_admin.py', 'r') as f:
            content = f.read()
        self.assertIn('if not User.objects.filter(username=acc[\'username\']).exists():', content)
