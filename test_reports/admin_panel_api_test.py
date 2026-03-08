"""
Admin Panel API Test Suite
Tests the backend API endpoints used by the Admin Panel component.
"""
import pytest
import requests
import os

# Get the backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://leylektag-debug.preview.emergentagent.com')
ADMIN_PHONE = "5326497412"

class TestAdminPanelAPIs:
    """Tests for Admin Panel API endpoints"""
    
    def test_admin_check(self):
        """Test admin verification endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/check?phone={ADMIN_PHONE}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["is_admin"] == True
        print(f"✅ Admin check passed: {data}")
    
    def test_dashboard_full(self):
        """Test dashboard/full endpoint returns correct stats"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard/full?admin_phone={ADMIN_PHONE}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert "stats" in data
        
        stats = data["stats"]
        # Verify users stats
        assert "users" in stats
        assert "total" in stats["users"]
        assert "drivers" in stats["users"]
        assert "passengers" in stats["users"]
        assert "online_drivers" in stats["users"]
        
        # Verify trips stats
        assert "trips" in stats
        assert "completed_today" in stats["trips"]
        assert "completed_week" in stats["trips"]
        assert "active" in stats["trips"]
        assert "waiting" in stats["trips"]
        
        print(f"✅ Dashboard stats: Total Users={stats['users']['total']}, Drivers={stats['users']['drivers']}, Passengers={stats['users']['passengers']}")
        print(f"   Trips: Today={stats['trips']['completed_today']}, Week={stats['trips']['completed_week']}, Waiting={stats['trips']['waiting']}")
    
    def test_users_full(self):
        """Test users/full endpoint returns user list"""
        response = requests.get(f"{BASE_URL}/api/admin/users/full?admin_phone={ADMIN_PHONE}&page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert "users" in data
        assert "total" in data
        assert isinstance(data["users"], list)
        assert len(data["users"]) > 0
        
        # Verify user object structure
        if data["users"]:
            user = data["users"][0]
            assert "id" in user
            assert "name" in user
            # Phone might be empty for some users
            
        print(f"✅ Users endpoint: Total={data['total']}, Returned={len(data['users'])}")
    
    def test_trips(self):
        """Test trips endpoint returns trip list"""
        response = requests.get(f"{BASE_URL}/api/admin/trips?admin_phone={ADMIN_PHONE}&page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert "trips" in data
        assert "total" in data
        assert isinstance(data["trips"], list)
        
        # Verify trip object structure if trips exist
        if data["trips"]:
            trip = data["trips"][0]
            assert "id" in trip
            assert "status" in trip
            assert "pickup_location" in trip or trip.get("pickup_location") is None
            
        print(f"✅ Trips endpoint: Total={data['total']}, Returned={len(data['trips'])}")
    
    def test_pricing(self):
        """Test pricing endpoint returns settings"""
        response = requests.get(f"{BASE_URL}/api/admin/pricing?phone={ADMIN_PHONE}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure  
        assert data["success"] == True
        assert "settings" in data
        
        print(f"✅ Pricing endpoint: Settings={data['settings']}")
    
    def test_kyc_all(self):
        """Test KYC all endpoint returns KYC requests"""
        response = requests.get(f"{BASE_URL}/api/admin/kyc/all?admin_phone={ADMIN_PHONE}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert "pending" in data
        assert "approved" in data
        assert "rejected" in data
        
        print(f"✅ KYC endpoint: Pending={len(data['pending'])}, Approved={len(data['approved'])}, Rejected={len(data['rejected'])}")


if __name__ == "__main__":
    # Run tests
    test = TestAdminPanelAPIs()
    test.test_admin_check()
    test.test_dashboard_full()
    test.test_users_full()
    test.test_trips()
    test.test_pricing()
    test.test_kyc_all()
    print("\n✅ All Admin Panel API tests passed!")
