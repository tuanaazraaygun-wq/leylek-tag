#!/usr/bin/env python3
"""
Backend API Test Suite - Supabase Realtime Integration
Testing specific endpoints from review request
"""

import requests
import json
import time
import sys
from datetime import datetime

# Test Configuration from review request
BACKEND_URL = "https://leylek-realtime.preview.emergentagent.com/api"
TEST_PHONE = "5321234567"
TEST_OTP = "123456"

# Test Results Storage
test_results = []
total_tests = 0
passed_tests = 0

def log_test(test_name, success, details, response_time=None):
    """Log test results"""
    global total_tests, passed_tests
    total_tests += 1
    if success:
        passed_tests += 1
    
    result = {
        "test": test_name,
        "success": success,
        "details": details,
        "response_time": response_time,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    
    status = "✅ PASS" if success else "❌ FAIL"
    time_info = f" ({response_time:.2f}s)" if response_time else ""
    print(f"{status} {test_name}{time_info}")
    if not success:
        print(f"   Details: {details}")

def make_request(method, endpoint, data=None, params=None, timeout=10):
    """Make HTTP request with error handling"""
    url = f"{BACKEND_URL}{endpoint}"
    start_time = time.time()
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, params=params, timeout=timeout)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, params=params, timeout=timeout)
        elif method.upper() == "DELETE":
            response = requests.delete(url, json=data, params=params, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response_time = time.time() - start_time
        return response, response_time
    except Exception as e:
        response_time = time.time() - start_time
        print(f"   Request error: {str(e)}")
        return None, response_time

def test_auth_check_user():
    """Test POST /api/auth/check-user"""
    print("\n🔐 Testing Auth System - Check User...")
    
    response, response_time = make_request("POST", "/auth/check-user", {
        "phone": TEST_PHONE
    })
    
    if response and response.status_code == 200:
        data = response.json()
        success = data.get("success", False)
        user_exists = data.get("user_exists", False)
        log_test("Auth - Check User", success, 
                f"User exists: {user_exists}, Has PIN: {data.get('has_pin', False)}", response_time)
        return data.get("user_id") if user_exists else None
    else:
        log_test("Auth - Check User", False, 
                f"HTTP {response.status_code if response else 'Connection Error'}", response_time)
        return None

def test_passenger_create_request(user_id):
    """Test POST /api/passenger/create-request"""
    print("\n🏷️ Testing Tag System - Create Request...")
    
    if not user_id:
        log_test("TAG - Create Request", False, "No user_id available")
        return None
    
    tag_data = {
        "user_id": user_id,
        "pickup_location": "Adana Merkez",
        "pickup_lat": 37.0,
        "pickup_lng": 35.3213,
        "dropoff_location": "İstanbul Taksim",
        "dropoff_lat": 41.0369,
        "dropoff_lng": 28.9857,
        "notes": "Test yolculuğu - Supabase realtime test"
    }
    
    response, response_time = make_request("POST", "/passenger/create-request", tag_data)
    
    if response and response.status_code == 200:
        data = response.json()
        success = data.get("success", False)
        tag_id = data.get("tag", {}).get("id") if success else None
        log_test("TAG - Create Request", success, 
                f"TAG ID: {tag_id}", response_time)
        return tag_id
    else:
        log_test("TAG - Create Request", False, 
                f"HTTP {response.status_code if response else 'Connection Error'}", response_time)
        return None

def test_passenger_active_tag(user_id):
    """Test GET /api/passenger/active-tag"""
    print("\n🔍 Testing Tag System - Active Tag...")
    
    if not user_id:
        log_test("TAG - Active Tag", False, "No user_id available")
        return None
    
    response, response_time = make_request("GET", "/passenger/active-tag", params={
        "user_id": user_id
    })
    
    if response and response.status_code == 200:
        data = response.json()
        success = data.get("success", False)
        active_tag = data.get("tag")
        tag_id = active_tag["id"] if active_tag else None
        log_test("TAG - Active Tag", success, 
                f"Active TAG: {tag_id}", response_time)
        return tag_id
    else:
        log_test("TAG - Active Tag", False, 
                f"HTTP {response.status_code if response else 'Connection Error'}", response_time)
        return None

def test_driver_send_offer(user_id, tag_id):
    """Test POST /api/driver/send-offer - Performance Critical (<2s)"""
    print("\n🚀 Testing Offer System - Send Offer (Performance Test)...")
    
    if not user_id or not tag_id:
        log_test("Offer - Send Offer", False, "Missing user_id or tag_id")
        return None
    
    offer_data = {
        "user_id": user_id,
        "tag_id": tag_id,
        "price": 850.0,
        "notes": "Test teklifi - 15 dakikada gelirim",
        "latitude": 37.0,
        "longitude": 35.3213
    }
    
    # Measure response time - CRITICAL: Should be < 2 seconds
    start_time = time.time()
    response, response_time = make_request("POST", "/driver/send-offer", offer_data)
    
    if response and response.status_code == 200:
        data = response.json()
        success = data.get("success", False)
        offer_id = data.get("offer_id")
        
        # Performance check
        performance_ok = response_time < 2.0
        performance_note = f"Response time: {response_time:.2f}s ({'✅ FAST' if performance_ok else '⚠️ SLOW'})"
        
        log_test("Offer - Send Offer", success, 
                f"Offer ID: {offer_id}, {performance_note}", response_time)
        
        # Separate performance test
        log_test("Offer - Performance Check", performance_ok, 
                f"Target: <2s, Actual: {response_time:.2f}s", response_time)
        
        return offer_id
    else:
        log_test("Offer - Send Offer", False, 
                f"HTTP {response.status_code if response else 'Connection Error'}", response_time)
        return None

def test_passenger_offers(user_id, tag_id):
    """Test GET /api/passenger/offers/{tag_id}"""
    print("\n📋 Testing Offer System - Get Offers...")
    
    if not user_id or not tag_id:
        log_test("Offer - Get Offers", False, "Missing user_id or tag_id")
        return []
    
    response, response_time = make_request("GET", f"/passenger/offers/{tag_id}", params={
        "user_id": user_id
    })
    
    if response and response.status_code == 200:
        data = response.json()
        success = data.get("success", False)
        offers = data.get("offers", [])
        log_test("Offer - Get Offers", success, 
                f"Found {len(offers)} offers", response_time)
        return offers
    else:
        log_test("Offer - Get Offers", False, 
                f"HTTP {response.status_code if response else 'Connection Error'}", response_time)
        return []

def test_passenger_accept_offer(offer_id):
    """Test POST /api/passenger/accept-offer"""
    print("\n✅ Testing Offer System - Accept Offer...")
    
    if not offer_id:
        log_test("Offer - Accept Offer", False, "No offer_id available")
        return False
    
    response, response_time = make_request("POST", "/passenger/accept-offer", {
        "offer_id": offer_id
    })
    
    if response and response.status_code == 200:
        data = response.json()
        success = data.get("success", False)
        driver_id = data.get("driver_id")
        log_test("Offer - Accept Offer", success, 
                f"Driver ID: {driver_id}", response_time)
        return success
    else:
        log_test("Offer - Accept Offer", False, 
                f"HTTP {response.status_code if response else 'Connection Error'}", response_time)
        return False

def test_realtime_integration():
    """Test Supabase Realtime Integration Flow"""
    print("\n🔄 Testing Complete Supabase Realtime Flow...")
    
    # Step 1: Check user
    user_id = test_auth_check_user()
    
    # Step 2: Create request
    tag_id = test_passenger_create_request(user_id)
    
    # Step 3: Verify active tag
    active_tag_id = test_passenger_active_tag(user_id)
    
    # Use the active tag ID if available
    if active_tag_id:
        tag_id = active_tag_id
    
    # Step 4: Send offer (performance critical)
    offer_id = test_driver_send_offer(user_id, tag_id)
    
    # Step 5: Get offers (should show realtime)
    offers = test_passenger_offers(user_id, tag_id)
    
    # Step 6: Accept offer
    if offers and len(offers) > 0:
        offer_to_accept = offers[0]["id"]
        test_passenger_accept_offer(offer_to_accept)
    elif offer_id:
        test_passenger_accept_offer(offer_id)

def print_summary():
    """Print test summary"""
    print("\n" + "="*60)
    print("🧪 SUPABASE REALTIME INTEGRATION TEST SUMMARY")
    print("="*60)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    print("\n📊 DETAILED RESULTS:")
    for result in test_results:
        status = "✅" if result["success"] else "❌"
        time_info = f" ({result['response_time']:.2f}s)" if result['response_time'] else ""
        print(f"{status} {result['test']}{time_info}")
        if not result["success"]:
            print(f"   └─ {result['details']}")
    
    print("\n🎯 KEY PERFORMANCE METRICS:")
    send_offer_tests = [r for r in test_results if "Send Offer" in r["test"] and r.get("response_time")]
    if send_offer_tests:
        avg_time = sum(r["response_time"] for r in send_offer_tests) / len(send_offer_tests)
        print(f"   Send Offer Average Response Time: {avg_time:.2f}s")
        print(f"   Performance Target (<2s): {'✅ MET' if avg_time < 2.0 else '❌ NOT MET'}")
    
    # Critical issues
    critical_failures = [r for r in test_results if not r["success"] and any(keyword in r["test"] for keyword in ["Send Offer", "Create Request", "Check User"])]
    if critical_failures:
        print(f"\n🚨 CRITICAL FAILURES:")
        for failure in critical_failures:
            print(f"   - {failure['test']}: {failure['details']}")

def main():
    """Main test execution"""
    print("🚀 Starting Supabase Realtime Integration Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Phone: {TEST_PHONE}")
    print("-" * 60)
    
    # Run the complete realtime integration test
    test_realtime_integration()
    
    # Print Summary
    print_summary()
    
    # Save results to file
    with open("/app/supabase_test_results.json", "w", encoding="utf-8") as f:
        json.dump({
            "summary": {
                "total": total_tests,
                "passed": passed_tests,
                "failed": total_tests - passed_tests,
                "success_rate": (passed_tests/total_tests*100) if total_tests > 0 else 0
            },
            "results": test_results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: /app/supabase_test_results.json")
    
    # Return exit code based on results
    if passed_tests == total_tests:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️ {total_tests - passed_tests} TESTS FAILED")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)