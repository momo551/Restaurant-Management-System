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


class Phase6BUserRoleEscalationTests(TestCase):
    """
    Security regression tests for H-06 Role Escalation & Privilege Hardening.
    """

    def setUp(self):
        self.client = APIClient()

        # Restaurant A
        self.restaurant_a = Restaurant.objects.create(
            name="Restaurant Alpha",
            slug="rest-alpha",
            is_active=True
        )
        self.owner_a = User.objects.create_user(
            username="owner_alpha",
            password="password123",
            role=User.Role.OWNER,
            restaurant=self.restaurant_a
        )
        self.cashier_a = User.objects.create_user(
            username="cashier_alpha",
            password="password123",
            role=User.Role.CASHIER,
            restaurant=self.restaurant_a,
            base_salary=Decimal("3000.00"),
            monthly_target=Decimal("50000.00")
        )
        self.kitchen_a = User.objects.create_user(
            username="kitchen_alpha",
            password="password123",
            role=User.Role.KITCHEN,
            restaurant=self.restaurant_a
        )
        self.hr_a = User.objects.create_user(
            username="hr_alpha",
            password="password123",
            role=User.Role.HR,
            restaurant=self.restaurant_a
        )
        # Grant staff management permission to HR role
        ModulePermission.objects.create(
            restaurant=self.restaurant_a,
            role=User.Role.HR,
            module_key='staff',
            module_label='إدارة الموظفين',
            allowed=True
        )

        # Restaurant B
        self.restaurant_b = Restaurant.objects.create(
            name="Restaurant Beta",
            slug="rest-beta",
            is_active=True
        )
        self.owner_b = User.objects.create_user(
            username="owner_beta",
            password="password123",
            role=User.Role.OWNER,
            restaurant=self.restaurant_b
        )
        self.cashier_b = User.objects.create_user(
            username="cashier_beta",
            password="password123",
            role=User.Role.CASHIER,
            restaurant=self.restaurant_b
        )

        # Superuser
        self.superuser = User.objects.create_superuser(
            username="global_admin",
            password="superpassword123",
            email="admin@system.local"
        )

    def test_01_normal_user_cannot_change_own_role(self):
        """Test 1: Cashier cannot escalate their own role to owner."""
        self.client.force_authenticate(user=self.cashier_a)
        response = self.client.patch(
            f'/api/users/{self.cashier_a.id}/',
            {'role': User.Role.OWNER},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.cashier_a.refresh_from_db()
        self.assertEqual(self.cashier_a.role, User.Role.CASHIER)

    def test_02_normal_user_cannot_change_own_is_staff(self):
        """Test 2: Cashier cannot grant themselves is_staff flag."""
        self.client.force_authenticate(user=self.cashier_a)
        response = self.client.patch(
            f'/api/users/{self.cashier_a.id}/',
            {'is_staff': True},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.cashier_a.refresh_from_db()
        self.assertFalse(self.cashier_a.is_staff)

    def test_03_normal_user_cannot_change_own_is_superuser(self):
        """Test 3: Cashier cannot grant themselves is_superuser flag."""
        self.client.force_authenticate(user=self.cashier_a)
        response = self.client.patch(
            f'/api/users/{self.cashier_a.id}/',
            {'is_superuser': True},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.cashier_a.refresh_from_db()
        self.assertFalse(self.cashier_a.is_superuser)

    def test_04_normal_user_cannot_change_own_restaurant(self):
        """Test 4: Cashier cannot move their account to Restaurant B."""
        self.client.force_authenticate(user=self.cashier_a)
        response = self.client.patch(
            f'/api/users/{self.cashier_a.id}/',
            {'restaurant': self.restaurant_b.id},
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])
        self.cashier_a.refresh_from_db()
        self.assertEqual(self.cashier_a.restaurant_id, self.restaurant_a.id)

    def test_05_normal_user_cannot_modify_another_user_role(self):
        """Test 5: Cashier cannot modify kitchen staff's role."""
        self.client.force_authenticate(user=self.cashier_a)
        response = self.client.patch(
            f'/api/users/{self.kitchen_a.id}/',
            {'role': User.Role.OWNER},
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST])
        self.kitchen_a.refresh_from_db()
        self.assertEqual(self.kitchen_a.role, User.Role.KITCHEN)

    def test_06_normal_user_cannot_modify_another_user_restaurant(self):
        """Test 6: Cashier cannot change another user's restaurant."""
        self.client.force_authenticate(user=self.cashier_a)
        response = self.client.patch(
            f'/api/users/{self.kitchen_a.id}/',
            {'restaurant': self.restaurant_b.id},
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST])
        self.kitchen_a.refresh_from_db()
        self.assertEqual(self.kitchen_a.restaurant_id, self.restaurant_a.id)

    def test_07_cross_tenant_user_modification_blocked(self):
        """Test 7: User from Restaurant A cannot access/modify user from Restaurant B."""
        self.client.force_authenticate(user=self.owner_a)
        response = self.client.patch(
            f'/api/users/{self.cashier_b.id}/',
            {'first_name': 'Hacked'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.cashier_b.refresh_from_db()
        self.assertNotEqual(self.cashier_b.first_name, 'Hacked')

    def test_08_crafted_multivariable_privilege_escalation_blocked(self):
        """Test 8: Crafted mass-assignment payload with multiple privilege fields is rejected."""
        self.client.force_authenticate(user=self.cashier_a)
        payload = {
            "role": "owner",
            "is_staff": True,
            "is_superuser": True,
            "restaurant": self.restaurant_b.id,
            "base_salary": Decimal("999999.00"),
            "monthly_target": Decimal("0.00"),
            "total_commissions": Decimal("999999.00")
        }
        response = self.client.patch(
            f'/api/users/{self.cashier_a.id}/',
            payload,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.cashier_a.refresh_from_db()
        self.assertEqual(self.cashier_a.role, User.Role.CASHIER)
        self.assertFalse(self.cashier_a.is_staff)
        self.assertFalse(self.cashier_a.is_superuser)
        self.assertEqual(self.cashier_a.restaurant_id, self.restaurant_a.id)
        self.assertEqual(self.cashier_a.base_salary, Decimal("3000.00"))

    def test_09_authorized_owner_can_manage_staff(self):
        """Test 9: Owner of Restaurant A can legitimately update staff details in their restaurant."""
        self.client.force_authenticate(user=self.owner_a)
        response = self.client.patch(
            f'/api/users/{self.cashier_a.id}/',
            {
                'first_name': 'UpdatedCashier',
                'base_salary': '4500.00',
                'role': User.Role.HALL_CAPTAIN
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cashier_a.refresh_from_db()
        self.assertEqual(self.cashier_a.first_name, 'UpdatedCashier')
        self.assertEqual(self.cashier_a.base_salary, Decimal('4500.00'))
        self.assertEqual(self.cashier_a.role, User.Role.HALL_CAPTAIN)

    def test_10_superuser_privileges_remain_intact(self):
        """Test 10: Superuser can manage any user across all restaurants."""
        self.client.force_authenticate(user=self.superuser)
        response = self.client.patch(
            f'/api/users/{self.cashier_b.id}/',
            {'first_name': 'SuperAdminUpdated'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cashier_b.refresh_from_db()
        self.assertEqual(self.cashier_b.first_name, 'SuperAdminUpdated')

    def test_11_hr_cannot_promote_to_owner(self):
        """Test 11: HR user with staff access can manage staff but CANNOT promote to Owner."""
        self.client.force_authenticate(user=self.hr_a)
        response = self.client.patch(
            f'/api/users/{self.cashier_a.id}/',
            {'role': User.Role.OWNER},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.cashier_a.refresh_from_db()
        self.assertNotEqual(self.cashier_a.role, User.Role.OWNER)

    def test_12_hr_cannot_modify_owner_account(self):
        """Test 12: HR user cannot modify the Owner's account."""
        self.client.force_authenticate(user=self.hr_a)
        response = self.client.patch(
            f'/api/users/{self.owner_a.id}/',
            {'first_name': 'HRHackedOwner'},
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST])
        self.owner_a.refresh_from_db()
        self.assertNotEqual(self.owner_a.first_name, 'HRHackedOwner')

    def test_13_user_can_update_own_safe_profile_fields(self):
        """Test 13: Normal user can legitimately update their first_name, last_name, and phone."""
        self.client.force_authenticate(user=self.cashier_a)
        response = self.client.patch(
            f'/api/users/{self.cashier_a.id}/',
            {
                'first_name': 'MyNewFirstName',
                'last_name': 'MyNewLastName',
                'phone': '0123456789'
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cashier_a.refresh_from_db()
        self.assertEqual(self.cashier_a.first_name, 'MyNewFirstName')
        self.assertEqual(self.cashier_a.last_name, 'MyNewLastName')
        self.assertEqual(self.cashier_a.phone, '0123456789')


# Phase 11A security tests are in tests_phase11a.py to avoid test isolation issues

