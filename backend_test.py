#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Telegram Bot Manager
Tests all authentication, CRUD operations, and analytics endpoints
"""

import requests
import sys
import json
import tempfile
import os
from datetime import datetime
from io import StringIO
import pandas as pd

class TelegramBotManagerTester:
    def __init__(self, base_url="https://outreach-analytics-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data
        self.test_user = {
            "email": "test@example.com",
            "password": "test123456",
            "name": "Test User"
        }

    def log_result(self, test_name, success, details="", error_msg=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {error_msg}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "error": error_msg
        })

    def make_request(self, method, endpoint, data=None, files=None, params=None):
        """Make HTTP request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if files:
            headers.pop('Content-Type', None)  # Let requests set it for multipart
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                if files:
                    response = requests.post(url, headers={k: v for k, v in headers.items() if k != 'Content-Type'}, files=files, data=data)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return None

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        response = self.make_request('GET', '')
        if response and response.status_code == 200:
            self.log_result("Root endpoint", True, f"Status: {response.status_code}")
        else:
            self.log_result("Root endpoint", False, error_msg=f"Status: {response.status_code if response else 'No response'}")
        
        # Test health endpoint
        response = self.make_request('GET', 'health')
        if response and response.status_code == 200:
            self.log_result("Health endpoint", True, f"Status: {response.status_code}")
        else:
            self.log_result("Health endpoint", False, error_msg=f"Status: {response.status_code if response else 'No response'}")

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        response = self.make_request('POST', 'auth/register', self.test_user)
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                self.log_result("User registration", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_result("User registration", False, error_msg="Missing token or user in response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            if response:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_result("User registration", False, error_msg=error_msg)
        return False

    def test_user_login(self):
        """Test user login"""
        print("\n🔍 Testing User Login...")
        
        login_data = {
            "email": self.test_user["email"],
            "password": self.test_user["password"]
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data:
                self.token = data['access_token']
                self.log_result("User login", True, "Login successful")
                return True
            else:
                self.log_result("User login", False, error_msg="Missing token in response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            if response:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    error_msg += f", Detail: {error_detail}"
                except:
                    pass
            self.log_result("User login", False, error_msg=error_msg)
        return False

    def test_get_user_profile(self):
        """Test getting user profile"""
        print("\n🔍 Testing User Profile...")
        
        response = self.make_request('GET', 'auth/me')
        if response and response.status_code == 200:
            data = response.json()
            if 'email' in data and data['email'] == self.test_user['email']:
                self.log_result("Get user profile", True, f"Email: {data['email']}")
                return True
            else:
                self.log_result("Get user profile", False, error_msg="Invalid user data")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_result("Get user profile", False, error_msg=error_msg)
        return False

    def test_accounts_crud(self):
        """Test Telegram accounts CRUD operations"""
        print("\n🔍 Testing Accounts CRUD...")
        
        # Test get accounts (empty initially)
        response = self.make_request('GET', 'accounts')
        if response and response.status_code == 200:
            self.log_result("Get accounts (empty)", True, f"Count: {len(response.json())}")
        else:
            self.log_result("Get accounts (empty)", False, error_msg=f"Status: {response.status_code if response else 'No response'}")
        
        # Test create account
        account_data = {
            "phone": "+79991234567",
            "name": "Test Account",
            "api_id": "12345",
            "api_hash": "test_hash"
        }
        
        response = self.make_request('POST', 'accounts', account_data)
        account_id = None
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and 'phone' in data:
                account_id = data['id']
                self.log_result("Create account", True, f"Account ID: {account_id}")
            else:
                self.log_result("Create account", False, error_msg="Missing account data")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_result("Create account", False, error_msg=error_msg)
        
        # Test get accounts (should have 1 now)
        response = self.make_request('GET', 'accounts')
        if response and response.status_code == 200:
            accounts = response.json()
            if len(accounts) >= 1:
                self.log_result("Get accounts (with data)", True, f"Count: {len(accounts)}")
            else:
                self.log_result("Get accounts (with data)", False, error_msg="No accounts found")
        else:
            self.log_result("Get accounts (with data)", False, error_msg=f"Status: {response.status_code if response else 'No response'}")
        
        # Test update account status
        if account_id:
            response = self.make_request('PUT', f'accounts/{account_id}/status', params={'status': 'active'})
            if response and response.status_code == 200:
                self.log_result("Update account status", True, "Status updated to active")
            else:
                self.log_result("Update account status", False, error_msg=f"Status: {response.status_code if response else 'No response'}")
        
        return account_id

    def test_accounts_import(self):
        """Test accounts import functionality"""
        print("\n🔍 Testing Accounts Import...")
        
        # Create test CSV data
        csv_data = """phone,name,api_id,api_hash
+79991111111,Account 1,11111,hash1
+79992222222,Account 2,22222,hash2"""
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_data)
            temp_file = f.name
        
        try:
            with open(temp_file, 'rb') as f:
                files = {'file': ('accounts.csv', f, 'text/csv')}
                response = self.make_request('POST', 'accounts/import', files=files)
            
            if response and response.status_code == 200:
                data = response.json()
                if 'imported' in data:
                    self.log_result("Import accounts", True, f"Imported: {data['imported']}")
                else:
                    self.log_result("Import accounts", False, error_msg="Missing import count")
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_result("Import accounts", False, error_msg=error_msg)
        
        finally:
            os.unlink(temp_file)

    def test_contacts_crud(self):
        """Test contacts CRUD operations"""
        print("\n🔍 Testing Contacts CRUD...")
        
        # Test get contacts (empty initially)
        response = self.make_request('GET', 'contacts')
        if response and response.status_code == 200:
            self.log_result("Get contacts (empty)", True, f"Count: {len(response.json())}")
        else:
            self.log_result("Get contacts (empty)", False, error_msg=f"Status: {response.status_code if response else 'No response'}")
        
        # Test create contact
        contact_data = {
            "phone": "+79995555555",
            "name": "Test Contact",
            "tags": ["VIP", "Client"]
        }
        
        response = self.make_request('POST', 'contacts', contact_data)
        contact_id = None
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and 'phone' in data:
                contact_id = data['id']
                self.log_result("Create contact", True, f"Contact ID: {contact_id}")
            else:
                self.log_result("Create contact", False, error_msg="Missing contact data")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_result("Create contact", False, error_msg=error_msg)
        
        # Test get contacts (should have 1 now)
        response = self.make_request('GET', 'contacts')
        if response and response.status_code == 200:
            contacts = response.json()
            if len(contacts) >= 1:
                self.log_result("Get contacts (with data)", True, f"Count: {len(contacts)}")
            else:
                self.log_result("Get contacts (with data)", False, error_msg="No contacts found")
        else:
            self.log_result("Get contacts (with data)", False, error_msg=f"Status: {response.status_code if response else 'No response'}")
        
        return contact_id

    def test_contacts_import(self):
        """Test contacts import functionality"""
        print("\n🔍 Testing Contacts Import...")
        
        # Create test CSV data
        csv_data = """phone,name
+79996666666,Contact 1
+79997777777,Contact 2"""
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_data)
            temp_file = f.name
        
        try:
            with open(temp_file, 'rb') as f:
                files = {'file': ('contacts.csv', f, 'text/csv')}
                data = {'tag': 'Imported'}
                response = self.make_request('POST', 'contacts/import', data=data, files=files)
            
            if response and response.status_code == 200:
                data = response.json()
                if 'imported' in data:
                    self.log_result("Import contacts", True, f"Imported: {data['imported']}")
                else:
                    self.log_result("Import contacts", False, error_msg="Missing import count")
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_result("Import contacts", False, error_msg=error_msg)
        
        finally:
            os.unlink(temp_file)

    def test_campaigns_crud(self):
        """Test campaigns CRUD operations"""
        print("\n🔍 Testing Campaigns CRUD...")
        
        # First get accounts to use in campaign
        accounts_response = self.make_request('GET', 'accounts')
        account_ids = []
        if accounts_response and accounts_response.status_code == 200:
            accounts = accounts_response.json()
            account_ids = [acc['id'] for acc in accounts if acc.get('status') == 'active']
        
        if not account_ids:
            self.log_result("Campaigns CRUD", False, error_msg="No active accounts available for campaign")
            return None
        
        # Test get campaigns (empty initially)
        response = self.make_request('GET', 'campaigns')
        if response and response.status_code == 200:
            self.log_result("Get campaigns (empty)", True, f"Count: {len(response.json())}")
        else:
            self.log_result("Get campaigns (empty)", False, error_msg=f"Status: {response.status_code if response else 'No response'}")
        
        # Test create campaign
        campaign_data = {
            "name": "Test Campaign",
            "message_template": "Hello! This is a test message.",
            "account_ids": account_ids[:1],  # Use first active account
            "delay_min": 30,
            "delay_max": 60
        }
        
        response = self.make_request('POST', 'campaigns', campaign_data)
        campaign_id = None
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and 'name' in data:
                campaign_id = data['id']
                self.log_result("Create campaign", True, f"Campaign ID: {campaign_id}")
            else:
                self.log_result("Create campaign", False, error_msg="Missing campaign data")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_result("Create campaign", False, error_msg=error_msg)
        
        # Test get campaigns (should have 1 now)
        response = self.make_request('GET', 'campaigns')
        if response and response.status_code == 200:
            campaigns = response.json()
            if len(campaigns) >= 1:
                self.log_result("Get campaigns (with data)", True, f"Count: {len(campaigns)}")
            else:
                self.log_result("Get campaigns (with data)", False, error_msg="No campaigns found")
        else:
            self.log_result("Get campaigns (with data)", False, error_msg=f"Status: {response.status_code if response else 'No response'}")
        
        return campaign_id

    def test_campaign_start(self, campaign_id):
        """Test starting a campaign"""
        if not campaign_id:
            self.log_result("Start campaign", False, error_msg="No campaign ID provided")
            return
        
        print("\n🔍 Testing Campaign Start...")
        
        response = self.make_request('PUT', f'campaigns/{campaign_id}/start')
        if response and response.status_code == 200:
            data = response.json()
            if 'sent' in data or 'delivered' in data:
                self.log_result("Start campaign", True, f"Campaign started, sent: {data.get('sent', 0)}")
            else:
                self.log_result("Start campaign", True, "Campaign started")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_result("Start campaign", False, error_msg=error_msg)

    def test_analytics(self):
        """Test analytics endpoint"""
        print("\n🔍 Testing Analytics...")
        
        response = self.make_request('GET', 'analytics')
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ['total_accounts', 'total_contacts', 'total_campaigns', 'delivery_rate', 'response_rate']
            if all(field in data for field in required_fields):
                self.log_result("Get analytics", True, f"Analytics data complete")
            else:
                missing = [f for f in required_fields if f not in data]
                self.log_result("Get analytics", False, error_msg=f"Missing fields: {missing}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_result("Get analytics", False, error_msg=error_msg)

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Telegram Bot Manager API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Health checks
        self.test_health_check()
        
        # Authentication tests
        if not self.test_user_registration():
            # If registration fails (user might exist), try login
            self.test_user_login()
        
        if not self.token:
            print("❌ Cannot proceed without authentication token")
            return self.generate_report()
        
        # Profile test
        self.test_get_user_profile()
        
        # Accounts tests
        account_id = self.test_accounts_crud()
        self.test_accounts_import()
        
        # Contacts tests
        contact_id = self.test_contacts_crud()
        self.test_contacts_import()
        
        # Campaigns tests
        campaign_id = self.test_campaigns_crud()
        self.test_campaign_start(campaign_id)
        
        # Analytics test
        self.test_analytics()
        
        return self.generate_report()

    def generate_report(self):
        """Generate test report"""
        print(f"\n📊 Test Results Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0%")
        
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        
        return {
            'total_tests': self.tests_run,
            'passed_tests': self.tests_passed,
            'failed_tests': self.tests_run - self.tests_passed,
            'success_rate': (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            'test_results': self.test_results
        }

def main():
    """Main test execution"""
    tester = TelegramBotManagerTester()
    results = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if results['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())