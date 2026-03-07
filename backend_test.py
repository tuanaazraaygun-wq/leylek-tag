#!/usr/bin/env python3
"""
Leylek TAG Backend API Testing Suite
Tests all key features for APK/mobile compatibility as per review request
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Test configuration from review request
BACKEND_URL = "https://tag-dispatch.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test data from review request
TEST_PHONE = "5341112233"
TEST_USER_ID = "fe45bd9c-10b0-4b7b-a745-3d5c7749607a"
ADMIN_PHONE = "5326497412"
TEST_OTP = "123456"
TEST_PIN = "123456"
TEST_DEVICE_ID = "test_device"

class TestResults:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def add_result(self, test_name: str, passed: bool, message: str, details: Dict = None, response_time: float = 0):
        result = {
            "test": test_name,
            "passed": passed,
            "message": message,
            "details": details or {},
            "response_time": f"{response_time:.2f}s" if response_time > 0 else "N/A",
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        time_str = f" ({response_time:.2f}s)" if response_time > 0 else ""
        print(f"{status}: {test_name}{time_str} - {message}")
        if details and not passed:
            print(f"   Details: {details}")

class LeylekTagTester:
    def __init__(self):
        self.session = None
        self.test_results = TestResults()
        self.created_tag_id = None
        self.pending_user_id = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple[bool, float, Dict]:
        """Make HTTP request to API and return (success, response_time, data)"""
        url = f"{API_BASE}{endpoint}"
        start_time = time.time()
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url, params=params) as response:
                    response_time = time.time() - start_time
                    response_data = await response.json()
                    return response.status < 400, response_time, response_data
            elif method.upper() == "POST":
                async with self.session.post(url, json=data, params=params) as response:
                    response_time = time.time() - start_time
                    response_data = await response.json()
                    return response.status < 400, response_time, response_data
        except Exception as e:
            response_time = time.time() - start_time
            return False, response_time, {"error": str(e)}

    # ==================== 1. AUTHENTICATION FLOW TESTS ====================
    
    async def test_check_user(self):
        """Test 1.1: Check User - POST /api/auth/check-user"""
        success, response_time, data = await self.make_request(
            "POST", "/auth/check-user",
            data={"phone": TEST_PHONE}
        )
        
        user_exists = data.get('user_exists', False) if success else False
        has_pin = data.get('has_pin', False) if success else False
        
        self.test_results.add_result(
            "1.1 Check User",
            success,
            f"User exists: {user_exists}, Has PIN: {has_pin}",
            data,
            response_time
        )
        return success
        
    async def test_send_otp(self):
        """Test 1.2: Send OTP - POST /api/auth/send-otp"""
        success, response_time, data = await self.make_request(
            "POST", "/auth/send-otp",
            data={"phone": TEST_PHONE}
        )
        
        message = data.get('message', 'No message') if success else f"Error: {data.get('error', 'Unknown')}"
        
        self.test_results.add_result(
            "1.2 Send OTP",
            success,
            message,
            data,
            response_time
        )
        return success
        
    async def test_verify_otp(self):
        """Test 1.3: Verify OTP - POST /api/auth/verify-otp"""
        success, response_time, data = await self.make_request(
            "POST", "/auth/verify-otp",
            data={"phone": TEST_PHONE, "otp": TEST_OTP}
        )
        
        user_exists = data.get('user_exists', False) if success else False
        message = data.get('message', 'No message') if success else f"Error: {data.get('error', 'Unknown')}"
        
        self.test_results.add_result(
            "1.3 Verify OTP",
            success,
            f"{message}, User exists: {user_exists}",
            data,
            response_time
        )
        return success
        
    async def test_verify_pin(self):
        """Test 1.4: Verify PIN - POST /api/auth/verify-pin"""
        success, response_time, data = await self.make_request(
            "POST", "/auth/verify-pin",
            params={"phone": TEST_PHONE, "pin": TEST_PIN, "device_id": TEST_DEVICE_ID}
        )
        
        user_id = data.get('user', {}).get('id', 'N/A') if success else 'N/A'
        
        self.test_results.add_result(
            "1.4 Verify PIN",
            success,
            f"Login successful, User ID: {user_id}",
            data,
            response_time
        )
        return success
        
    async def test_get_cities(self):
        """Test 1.5: Get Cities - GET /api/auth/cities"""
        success, response_time, data = await self.make_request("GET", "/auth/cities")
        
        cities_count = len(data.get('cities', [])) if success else 0
        
        self.test_results.add_result(
            "1.5 Get Cities",
            success,
            f"Cities returned: {cities_count}",
            {"cities_count": cities_count},
            response_time
        )
        return success

    # ==================== 2. DRIVER KYC SYSTEM TESTS ====================
    
    async def test_kyc_status_check(self):
        """Test 2.1: KYC Status Check - GET /api/driver/kyc/status"""
        success, response_time, data = await self.make_request(
            "GET", "/driver/kyc/status",
            params={"user_id": TEST_USER_ID}
        )
        
        kyc_status = data.get('kyc_status', 'unknown') if success else 'error'
        is_driver = data.get('is_driver', False) if success else False
        
        self.test_results.add_result(
            "2.1 KYC Status Check",
            success,
            f"KYC Status: {kyc_status}, Is Driver: {is_driver}",
            data,
            response_time
        )
        return success
        
    async def test_admin_get_all_kycs(self):
        """Test 2.2: Admin Get All KYCs - GET /api/admin/kyc/all"""
        success, response_time, data = await self.make_request(
            "GET", "/admin/kyc/all",
            params={"admin_phone": ADMIN_PHONE}
        )
        
        if success:
            pending = data.get('pending', [])
            approved = data.get('approved', [])
            rejected = data.get('rejected', [])
            
            pending_count = len(pending)
            approved_count = len(approved)
            rejected_count = len(rejected)
            
            # Store a pending user ID for approval/rejection tests
            if pending and len(pending) > 0:
                self.pending_user_id = pending[0].get('user_id')
            
            message = f"Pending: {pending_count}, Approved: {approved_count}, Rejected: {rejected_count}"
        else:
            message = f"Error: {data.get('error', 'Unknown error')}"
            
        self.test_results.add_result(
            "2.2 Admin Get All KYCs",
            success,
            message,
            data,
            response_time
        )
        return success
        
    async def test_admin_approve_kyc(self):
        """Test 2.3: Admin Approve KYC - POST /api/admin/kyc/approve"""
        if not self.pending_user_id:
            # Use test user ID if no pending user found
            test_user_id = TEST_USER_ID
        else:
            test_user_id = self.pending_user_id
            
        success, response_time, data = await self.make_request(
            "POST", "/admin/kyc/approve",
            params={"admin_phone": ADMIN_PHONE, "user_id": test_user_id}
        )
        
        message = data.get('message', 'No message') if success else f"Error: {data.get('error', 'Unknown')}"
        
        self.test_results.add_result(
            "2.3 Admin Approve KYC",
            success,
            message,
            data,
            response_time
        )
        return success
        
    async def test_admin_reject_kyc(self):
        """Test 2.4: Admin Reject KYC - POST /api/admin/kyc/reject"""
        test_user_id = TEST_USER_ID  # Use test user for rejection
        
        success, response_time, data = await self.make_request(
            "POST", "/admin/kyc/reject",
            params={
                "admin_phone": ADMIN_PHONE, 
                "user_id": test_user_id,
                "reason": "Test rejection"
            }
        )
        
        message = data.get('message', 'No message') if success else f"Error: {data.get('error', 'Unknown')}"
        
        self.test_results.add_result(
            "2.4 Admin Reject KYC",
            success,
            message,
            data,
            response_time
        )
        return success

    # ==================== 3. TAG/OFFER SYSTEM TESTS ====================
    
    async def test_create_tag(self):
        """Test 3.1: Create Tag - POST /api/passenger/create-tag"""
        tag_data = {
            "pickup_location": "Ankara",
            "dropoff_location": "İstanbul",
            "offered_price": 500,
            "pickup_lat": 39.9334,
            "pickup_lng": 32.8597,
            "dropoff_lat": 41.0082,
            "dropoff_lng": 28.9784
        }
        
        success, response_time, data = await self.make_request(
            "POST", "/passenger/create-tag",
            data=tag_data,
            params={"user_id": TEST_USER_ID}
        )
        
        if success and data.get('tag'):
            self.created_tag_id = data['tag'].get('id')
            message = f"Tag created with ID: {self.created_tag_id}"
        else:
            message = f"Error: {data.get('detail', 'Unknown error')}"
            
        self.test_results.add_result(
            "3.1 Create Tag",
            success,
            message,
            data,
            response_time
        )
        return success
        
    async def test_get_active_tags(self):
        """Test 3.2: Get Active Tags - GET /api/passenger/active-tag"""
        success, response_time, data = await self.make_request(
            "GET", "/passenger/active-tag",
            params={"user_id": TEST_USER_ID}
        )
        
        if success:
            has_active_tag = data.get('tag') is not None
            message = f"Has active tag: {has_active_tag}"
        else:
            message = f"Error: {data.get('detail', 'Unknown error')}"
            
        self.test_results.add_result(
            "3.2 Get Active Tags",
            success,
            message,
            data,
            response_time
        )
        return success

    # ==================== 4. ADMIN PANEL TESTS ====================
    
    async def test_admin_check(self):
        """Test 4.1: Admin Check - GET /api/admin/check"""
        success, response_time, data = await self.make_request(
            "GET", "/admin/check",
            params={"phone": ADMIN_PHONE}
        )
        
        is_admin = data.get('is_admin', False) if success else False
        
        self.test_results.add_result(
            "4.1 Admin Check",
            success,
            f"Is Admin: {is_admin}",
            data,
            response_time
        )
        return success

    # ==================== MAIN TEST RUNNER ====================
    
    async def run_all_tests(self):
        """Run all backend tests as specified in review request"""
        print(f"🧪 Starting Leylek TAG Backend API Tests")
        print(f"🌐 Backend URL: {BACKEND_URL}")
        print(f"📱 Test Phone: {TEST_PHONE}")
        print(f"👤 Test User ID: {TEST_USER_ID}")
        print(f"👑 Admin Phone: {ADMIN_PHONE}")
        print("=" * 80)
        
        # 1. AUTHENTICATION FLOW
        print("\n🔐 1. AUTHENTICATION FLOW")
        await self.test_check_user()
        await self.test_send_otp()
        await self.test_verify_otp()
        await self.test_verify_pin()
        await self.test_get_cities()
        
        # 2. DRIVER KYC SYSTEM
        print("\n🚗 2. DRIVER KYC SYSTEM")
        await self.test_kyc_status_check()
        await self.test_admin_get_all_kycs()
        await self.test_admin_approve_kyc()
        await self.test_admin_reject_kyc()
        
        # 3. TAG/OFFER SYSTEM
        print("\n🏷️ 3. TAG/OFFER SYSTEM")
        await self.test_create_tag()
        await self.test_get_active_tags()
        
        # 4. ADMIN PANEL
        print("\n👑 4. ADMIN PANEL")
        await self.test_admin_check()
        
        # Summary
        await self.print_summary()
        
    async def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = self.test_results.passed + self.test_results.failed
        success_rate = (self.test_results.passed / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {self.test_results.passed}")
        print(f"❌ Failed: {self.test_results.failed}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Failed tests details
        failed_tests = [r for r in self.test_results.results if not r['passed']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for result in failed_tests:
                print(f"  - {result['test']}: {result['message']}")
        
        # Performance analysis
        response_times = []
        for result in self.test_results.results:
            if result['passed'] and result['response_time'] != "N/A":
                try:
                    time_val = float(result['response_time'].replace('s', ''))
                    response_times.append(time_val)
                except:
                    pass
        
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            max_time = max(response_times)
            min_time = min(response_times)
            
            print(f"\n⚡ PERFORMANCE ANALYSIS:")
            print(f"  Average Response Time: {avg_time:.2f}s")
            print(f"  Fastest Response: {min_time:.2f}s")
            print(f"  Slowest Response: {max_time:.2f}s")

async def main():
    """Main test function"""
    async with LeylekTagTester() as tester:
        await tester.run_all_tests()
        
        # Save results to file
        results_data = {
            "summary": {
                "passed": tester.test_results.passed,
                "failed": tester.test_results.failed,
                "total": tester.test_results.passed + tester.test_results.failed,
                "success_rate": (tester.test_results.passed / (tester.test_results.passed + tester.test_results.failed) * 100) if (tester.test_results.passed + tester.test_results.failed) > 0 else 0
            },
            "results": tester.test_results.results,
            "timestamp": datetime.now().isoformat()
        }
        
        with open("/app/test_results_backend.json", "w", encoding="utf-8") as f:
            json.dump(results_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Detailed results saved to: /app/test_results_backend.json")
        return tester.test_results

if __name__ == "__main__":
    asyncio.run(main())