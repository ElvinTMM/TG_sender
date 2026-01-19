"""
Telegram Bot Manager API Tests
Tests for: auth, accounts (with price categories), campaigns (with account_categories), templates, analytics
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://outreach-hub-30.preview.emergentagent.com').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "Test123!"
TEST_NAME = "Test User"


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    @pytest.fixture(scope="class")
    def registered_user(self):
        """Register a test user and return credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        return {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    def test_register_user(self):
        """Test user registration"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "New Test User"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == unique_email
        assert data["user"]["name"] == "New Test User"
        assert "id" in data["user"]
    
    def test_register_duplicate_email(self, registered_user):
        """Test registration with duplicate email fails"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": registered_user["email"],
            "password": "Test123!",
            "name": "Duplicate User"
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()
    
    def test_login_success(self, registered_user):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == registered_user["email"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
    
    def test_get_me(self, registered_user):
        """Test get current user endpoint"""
        headers = {"Authorization": f"Bearer {registered_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == registered_user["email"]
        assert data["name"] == TEST_NAME


class TestAccountsEndpoints:
    """Telegram accounts CRUD tests with price categories"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for authenticated requests"""
        unique_email = f"test_accounts_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "Accounts Test User"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_account_low_category(self, auth_headers):
        """Test creating account with low price category (<300$)"""
        response = requests.post(f"{BASE_URL}/api/accounts", headers=auth_headers, json={
            "phone": "+79991234567",
            "name": "Low Value Account",
            "value_usdt": 100
        })
        assert response.status_code == 200
        data = response.json()
        assert data["phone"] == "+79991234567"
        assert data["name"] == "Low Value Account"
        assert data["value_usdt"] == 100
        assert data["price_category"] == "low"
        assert "id" in data
    
    def test_create_account_medium_category(self, auth_headers):
        """Test creating account with medium price category (300-500$)"""
        response = requests.post(f"{BASE_URL}/api/accounts", headers=auth_headers, json={
            "phone": "+79991234568",
            "name": "Medium Value Account",
            "value_usdt": 350
        })
        assert response.status_code == 200
        data = response.json()
        assert data["value_usdt"] == 350
        assert data["price_category"] == "medium"
    
    def test_create_account_high_category(self, auth_headers):
        """Test creating account with high price category (500$+)"""
        response = requests.post(f"{BASE_URL}/api/accounts", headers=auth_headers, json={
            "phone": "+79991234569",
            "name": "High Value Account",
            "value_usdt": 750
        })
        assert response.status_code == 200
        data = response.json()
        assert data["value_usdt"] == 750
        assert data["price_category"] == "high"
    
    def test_get_accounts_list(self, auth_headers):
        """Test getting all accounts"""
        response = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # We created 3 accounts above
    
    def test_get_accounts_by_category(self, auth_headers):
        """Test filtering accounts by price category"""
        # Test low category filter
        response = requests.get(f"{BASE_URL}/api/accounts?price_category=low", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for account in data:
            assert account["price_category"] == "low"
        
        # Test medium category filter
        response = requests.get(f"{BASE_URL}/api/accounts?price_category=medium", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for account in data:
            assert account["price_category"] == "medium"
        
        # Test high category filter
        response = requests.get(f"{BASE_URL}/api/accounts?price_category=high", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for account in data:
            assert account["price_category"] == "high"
    
    def test_get_accounts_stats(self, auth_headers):
        """Test getting account statistics by category"""
        response = requests.get(f"{BASE_URL}/api/accounts/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "low" in data
        assert "medium" in data
        assert "high" in data
        assert data["total"] >= 3
        assert data["low"] >= 1
        assert data["medium"] >= 1
        assert data["high"] >= 1
    
    def test_update_account_status(self, auth_headers):
        """Test updating account status"""
        # First create an account
        create_response = requests.post(f"{BASE_URL}/api/accounts", headers=auth_headers, json={
            "phone": "+79991234570",
            "name": "Status Test Account",
            "value_usdt": 200
        })
        account_id = create_response.json()["id"]
        
        # Update status to active
        response = requests.put(f"{BASE_URL}/api/accounts/{account_id}/status?status=active", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify status changed
        get_response = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        accounts = get_response.json()
        account = next((a for a in accounts if a["id"] == account_id), None)
        assert account is not None
        assert account["status"] == "active"
    
    def test_delete_account(self, auth_headers):
        """Test deleting an account"""
        # First create an account
        create_response = requests.post(f"{BASE_URL}/api/accounts", headers=auth_headers, json={
            "phone": "+79991234571",
            "name": "Delete Test Account",
            "value_usdt": 50
        })
        account_id = create_response.json()["id"]
        
        # Delete the account
        response = requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify account is deleted
        get_response = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        accounts = get_response.json()
        account = next((a for a in accounts if a["id"] == account_id), None)
        assert account is None


class TestTemplatesEndpoints:
    """Message templates CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for authenticated requests"""
        unique_email = f"test_templates_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "Templates Test User"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_template(self, auth_headers):
        """Test creating a message template"""
        response = requests.post(f"{BASE_URL}/api/templates", headers=auth_headers, json={
            "name": "Welcome Template",
            "content": "{time}, {name}! Добро пожаловать!",
            "description": "Приветственное сообщение"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Welcome Template"
        assert data["content"] == "{time}, {name}! Добро пожаловать!"
        assert data["description"] == "Приветственное сообщение"
        assert "id" in data
        assert "created_at" in data
    
    def test_get_templates_list(self, auth_headers):
        """Test getting all templates"""
        # Create another template first
        requests.post(f"{BASE_URL}/api/templates", headers=auth_headers, json={
            "name": "Promo Template",
            "content": "Специальное предложение для вас!",
            "description": "Промо сообщение"
        })
        
        response = requests.get(f"{BASE_URL}/api/templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2
    
    def test_update_template(self, auth_headers):
        """Test updating a template"""
        # Create a template
        create_response = requests.post(f"{BASE_URL}/api/templates", headers=auth_headers, json={
            "name": "Update Test Template",
            "content": "Original content",
            "description": "Original description"
        })
        template_id = create_response.json()["id"]
        
        # Update the template
        response = requests.put(f"{BASE_URL}/api/templates/{template_id}", headers=auth_headers, json={
            "name": "Updated Template Name",
            "content": "Updated content",
            "description": "Updated description"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Template Name"
        assert data["content"] == "Updated content"
        assert data["updated_at"] is not None
    
    def test_delete_template(self, auth_headers):
        """Test deleting a template"""
        # Create a template
        create_response = requests.post(f"{BASE_URL}/api/templates", headers=auth_headers, json={
            "name": "Delete Test Template",
            "content": "To be deleted",
            "description": None
        })
        template_id = create_response.json()["id"]
        
        # Delete the template
        response = requests.delete(f"{BASE_URL}/api/templates/{template_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify template is deleted
        get_response = requests.get(f"{BASE_URL}/api/templates", headers=auth_headers)
        templates = get_response.json()
        template = next((t for t in templates if t["id"] == template_id), None)
        assert template is None


class TestCampaignsEndpoints:
    """Campaigns CRUD tests with account categories"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for authenticated requests"""
        unique_email = f"test_campaigns_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "Campaigns Test User"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def setup_accounts_and_contacts(self, auth_headers):
        """Setup accounts and contacts for campaign tests"""
        # Create accounts with different price categories
        accounts = []
        for i, (value, category) in enumerate([(100, "low"), (400, "medium"), (600, "high")]):
            response = requests.post(f"{BASE_URL}/api/accounts", headers=auth_headers, json={
                "phone": f"+7999123456{i}",
                "name": f"{category.capitalize()} Account",
                "value_usdt": value
            })
            if response.status_code == 200:
                acc = response.json()
                # Activate the account
                requests.put(f"{BASE_URL}/api/accounts/{acc['id']}/status?status=active", headers=auth_headers)
                accounts.append(acc)
        
        # Create contacts
        contacts = []
        for i in range(5):
            response = requests.post(f"{BASE_URL}/api/contacts", headers=auth_headers, json={
                "phone": f"+7888123456{i}",
                "name": f"Contact {i}",
                "tags": ["test"]
            })
            if response.status_code == 200:
                contacts.append(response.json())
        
        return {"accounts": accounts, "contacts": contacts}
    
    def test_create_campaign_with_categories(self, auth_headers, setup_accounts_and_contacts):
        """Test creating a campaign with account categories"""
        response = requests.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json={
            "name": "Test Campaign with Categories",
            "message_template": "{time}, {name}! Это тестовое сообщение.",
            "account_categories": ["low", "medium"],
            "use_rotation": True,
            "respect_limits": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Campaign with Categories"
        assert data["account_categories"] == ["low", "medium"]
        assert data["status"] == "draft"
        assert data["use_rotation"] == True
        assert "id" in data
    
    def test_create_campaign_with_all_categories(self, auth_headers, setup_accounts_and_contacts):
        """Test creating a campaign with all account categories"""
        response = requests.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json={
            "name": "All Categories Campaign",
            "message_template": "Сообщение для всех категорий",
            "account_categories": ["low", "medium", "high"],
            "use_rotation": True
        })
        assert response.status_code == 200
        data = response.json()
        assert set(data["account_categories"]) == {"low", "medium", "high"}
    
    def test_create_campaign_with_tag_filter(self, auth_headers, setup_accounts_and_contacts):
        """Test creating a campaign with tag filter"""
        response = requests.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json={
            "name": "Tagged Campaign",
            "message_template": "Сообщение для тегированных контактов",
            "account_categories": ["high"],
            "tag_filter": "test"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["total_contacts"] >= 0  # Should have contacts with "test" tag
    
    def test_get_campaigns_list(self, auth_headers, setup_accounts_and_contacts):
        """Test getting all campaigns"""
        response = requests.get(f"{BASE_URL}/api/campaigns", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # We created 3 campaigns above
    
    def test_start_campaign(self, auth_headers, setup_accounts_and_contacts):
        """Test starting a campaign"""
        # Create a campaign
        create_response = requests.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json={
            "name": "Start Test Campaign",
            "message_template": "Тестовое сообщение для запуска",
            "account_categories": ["low", "medium", "high"],
            "use_rotation": True
        })
        campaign_id = create_response.json()["id"]
        
        # Start the campaign
        response = requests.put(f"{BASE_URL}/api/campaigns/{campaign_id}/start", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "sent" in data or "message" in data
        
        # Verify campaign status changed
        get_response = requests.get(f"{BASE_URL}/api/campaigns", headers=auth_headers)
        campaigns = get_response.json()
        campaign = next((c for c in campaigns if c["id"] == campaign_id), None)
        assert campaign is not None
        assert campaign["status"] in ["running", "completed"]
    
    def test_delete_campaign(self, auth_headers, setup_accounts_and_contacts):
        """Test deleting a campaign"""
        # Create a campaign
        create_response = requests.post(f"{BASE_URL}/api/campaigns", headers=auth_headers, json={
            "name": "Delete Test Campaign",
            "message_template": "To be deleted",
            "account_categories": ["low"]
        })
        campaign_id = create_response.json()["id"]
        
        # Delete the campaign
        response = requests.delete(f"{BASE_URL}/api/campaigns/{campaign_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify campaign is deleted
        get_response = requests.get(f"{BASE_URL}/api/campaigns", headers=auth_headers)
        campaigns = get_response.json()
        campaign = next((c for c in campaigns if c["id"] == campaign_id), None)
        assert campaign is None


class TestAnalyticsEndpoint:
    """Analytics endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for authenticated requests"""
        unique_email = f"test_analytics_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "Analytics Test User"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_analytics(self, auth_headers):
        """Test getting analytics data"""
        response = requests.get(f"{BASE_URL}/api/analytics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields are present
        assert "total_accounts" in data
        assert "active_accounts" in data
        assert "banned_accounts" in data
        assert "total_contacts" in data
        assert "messaged_contacts" in data
        assert "responded_contacts" in data
        assert "total_campaigns" in data
        assert "running_campaigns" in data
        assert "total_messages_sent" in data
        assert "total_messages_delivered" in data
        assert "total_responses" in data
        assert "delivery_rate" in data
        assert "response_rate" in data
        assert "daily_stats" in data
        
        # Verify daily_stats structure
        assert isinstance(data["daily_stats"], list)
        assert len(data["daily_stats"]) == 7  # 7 days
        for day_stat in data["daily_stats"]:
            assert "date" in day_stat
            assert "sent" in day_stat
            assert "delivered" in day_stat
            assert "responses" in day_stat


class TestContactsEndpoints:
    """Contacts CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for authenticated requests"""
        unique_email = f"test_contacts_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "Contacts Test User"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_contact(self, auth_headers):
        """Test creating a contact"""
        response = requests.post(f"{BASE_URL}/api/contacts", headers=auth_headers, json={
            "phone": "+79001234567",
            "name": "Test Contact",
            "tags": ["VIP", "Client"]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["phone"] == "+79001234567"
        assert data["name"] == "Test Contact"
        assert set(data["tags"]) == {"VIP", "Client"}
        assert data["status"] == "pending"
        assert "id" in data
    
    def test_get_contacts_list(self, auth_headers):
        """Test getting all contacts"""
        response = requests.get(f"{BASE_URL}/api/contacts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_contacts_by_tag(self, auth_headers):
        """Test filtering contacts by tag"""
        # Create a contact with specific tag
        requests.post(f"{BASE_URL}/api/contacts", headers=auth_headers, json={
            "phone": "+79001234568",
            "name": "Tagged Contact",
            "tags": ["Premium"]
        })
        
        response = requests.get(f"{BASE_URL}/api/contacts?tag=Premium", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        for contact in data:
            assert "Premium" in contact["tags"]
    
    def test_delete_contact(self, auth_headers):
        """Test deleting a contact"""
        # Create a contact
        create_response = requests.post(f"{BASE_URL}/api/contacts", headers=auth_headers, json={
            "phone": "+79001234569",
            "name": "Delete Test Contact",
            "tags": []
        })
        contact_id = create_response.json()["id"]
        
        # Delete the contact
        response = requests.delete(f"{BASE_URL}/api/contacts/{contact_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify contact is deleted
        get_response = requests.get(f"{BASE_URL}/api/contacts", headers=auth_headers)
        contacts = get_response.json()
        contact = next((c for c in contacts if c["id"] == contact_id), None)
        assert contact is None


class TestHealthEndpoints:
    """Health check endpoints"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "Telegram Bot Manager" in data["message"]
