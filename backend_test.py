#!/usr/bin/env python3
"""
Backend API Test Suite for Leylek TAG
Tests critical endpoints based on test_result.md priorities
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional

# Test configuration
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://rideshare-fix-2.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class TestResults:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def add_result(self, test_name: str, passed: bool, message: str, details: Dict = None):
        result = {
            "test": test_name,
            "passed": passed,
            "message": message,
            "details": details or {},
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")

class LeylekTagTester:
    def __init__(self):
        self.session = None
        self.test_results = TestResults()
        self.test_users = {}
        self.test_tag_id = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> Dict:
        """Make HTTP request to API"""
        url = f"{API_BASE}{endpoint}"
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url, params=params) as response:
                    return {
                        "status": response.status,
                        "data": await response.json(),
                        "success": response.status < 400
                    }
            elif method.upper() == "POST":
                async with self.session.post(url, json=data, params=params) as response:
                    return {
                        "status": response.status,
                        "data": await response.json(),
                        "success": response.status < 400
                    }
            elif method.upper() == "PUT":
                async with self.session.put(url, json=data, params=params) as response:
                    return {
                        "status": response.status,
                        "data": await response.json(),
                        "success": response.status < 400
                    }
        except Exception as e:
            return {
                "status": 0,
                "data": {"error": str(e)},
                "success": False
            }
    
    async def setup_test_users(self):
        """Create test passenger and driver users"""
        print("\n🔧 Setting up test users...")
        
        # Test passenger in Adana
        passenger_data = {
            "phone": "+905551234567",
            "name": "Test Yolcu Ahmet",
            "city": "Adana"
        }
        
        # Test driver in Adana  
        driver_data = {
            "phone": "+905557654321", 
            "name": "Test Sürücü Mehmet",
            "city": "Adana"
        }
        
        # Register passenger
        response = await self.make_request("POST", "/auth/register", passenger_data)
        if response["success"]:
            self.test_users["passenger"] = response["data"]["user"]
            self.test_results.add_result(
                "Setup Passenger User", 
                True, 
                f"Created passenger: {passenger_data['name']}"
            )
        else:
            # Try to verify existing user
            verify_response = await self.make_request("POST", "/auth/verify-otp", {
                "phone": passenger_data["phone"],
                "otp": "123456"
            })
            if verify_response["success"] and verify_response["data"]["user_exists"]:
                self.test_users["passenger"] = verify_response["data"]["user"]
                self.test_results.add_result(
                    "Setup Passenger User", 
                    True, 
                    f"Using existing passenger: {passenger_data['name']}"
                )
            else:
                self.test_results.add_result(
                    "Setup Passenger User", 
                    False, 
                    f"Failed to create/find passenger: {response['data']}"
                )
                return False
        
        # Register driver
        response = await self.make_request("POST", "/auth/register", driver_data)
        if response["success"]:
            self.test_users["driver"] = response["data"]["user"]
            self.test_results.add_result(
                "Setup Driver User", 
                True, 
                f"Created driver: {driver_data['name']}"
            )
        else:
            # Try to verify existing user
            verify_response = await self.make_request("POST", "/auth/verify-otp", {
                "phone": driver_data["phone"],
                "otp": "123456"
            })
            if verify_response["success"] and verify_response["data"]["user_exists"]:
                self.test_users["driver"] = verify_response["data"]["user"]
                self.test_results.add_result(
                    "Setup Driver User", 
                    True, 
                    f"Using existing driver: {driver_data['name']}"
                )
            else:
                self.test_results.add_result(
                    "Setup Driver User", 
                    False, 
                    f"Failed to create/find driver: {response['data']}"
                )
                return False
        
        # Update driver location to Adana coordinates
        driver_id = self.test_users["driver"]["id"]
        location_response = await self.make_request("POST", "/user/update-location", 
            params={
                "user_id": driver_id,
                "latitude": 37.1,  # Adana coordinates (slightly different from pickup)
                "longitude": 35.1
            }
        )
        
        if location_response["success"]:
            self.test_results.add_result(
                "Update Driver Location", 
                True, 
                "Driver location set to Adana (37.1, 35.1)"
            )
        else:
            self.test_results.add_result(
                "Update Driver Location", 
                False, 
                f"Failed to update driver location: {location_response['data']}"
            )
        
        return True
    
    async def test_create_tag_with_coordinates(self):
        """Test creating TAG with coordinates - Critical for distance calculation"""
        print("\n🎯 Testing TAG creation with coordinates...")
        
        passenger_id = self.test_users["passenger"]["id"]
        
        tag_data = {
            "pickup_location": "Adana Merkez",
            "dropoff_location": "Kadıköy, İstanbul", 
            "pickup_lat": 37.0,  # Adana coordinates
            "pickup_lng": 35.0,
            "dropoff_lat": 41.0,  # Kadıköy coordinates
            "dropoff_lng": 29.0,
            "notes": "Test yolculuğu - mesafe hesaplama testi"
        }
        
        response = await self.make_request("POST", "/passenger/create-request", 
            tag_data, 
            params={"user_id": passenger_id}
        )
        
        if response["success"]:
            tag = response["data"]["tag"]
            self.test_tag_id = tag["id"]
            
            # Verify coordinates are saved correctly
            coordinates_saved = (
                tag.get("pickup_lat") == 37.0 and 
                tag.get("pickup_lng") == 35.0 and
                tag.get("dropoff_lat") == 41.0 and
                tag.get("dropoff_lng") == 29.0
            )
            
            self.test_results.add_result(
                "Create TAG with Coordinates",
                coordinates_saved,
                f"TAG created with coordinates saved: {coordinates_saved}",
                {
                    "tag_id": self.test_tag_id,
                    "pickup_coords": f"({tag.get('pickup_lat')}, {tag.get('pickup_lng')})",
                    "dropoff_coords": f"({tag.get('dropoff_lat')}, {tag.get('dropoff_lng')})",
                    "coordinates_match": coordinates_saved
                }
            )
            return coordinates_saved
        else:
            self.test_results.add_result(
                "Create TAG with Coordinates",
                False,
                f"Failed to create TAG: {response['data']}"
            )
            return False
    
    async def test_distance_calculation(self):
        """Test distance calculation in driver requests - MOST CRITICAL"""
        print("\n📏 Testing distance calculation (CRITICAL)...")
        
        if not self.test_tag_id:
            self.test_results.add_result(
                "Distance Calculation Test",
                False,
                "No test TAG available for distance testing"
            )
            return False
        
        driver_id = self.test_users["driver"]["id"]
        
        response = await self.make_request("GET", "/driver/requests", 
            params={"user_id": driver_id}
        )
        
        if response["success"]:
            requests = response["data"]["requests"]
            
            # Find our test TAG
            test_request = None
            for req in requests:
                if req["id"] == self.test_tag_id:
                    test_request = req
                    break
            
            if test_request:
                distance_to_passenger = test_request.get("distance_to_passenger_km")
                trip_distance = test_request.get("trip_distance_km")
                
                # Check if distances are calculated (not "Hesaplanıyor..." or 0)
                distance_calculated = (
                    isinstance(distance_to_passenger, (int, float)) and 
                    distance_to_passenger > 0 and
                    isinstance(trip_distance, (int, float)) and 
                    trip_distance > 0
                )
                
                self.test_results.add_result(
                    "Distance Calculation - Driver to Passenger",
                    distance_calculated,
                    f"Distance calculated correctly: {distance_calculated}",
                    {
                        "distance_to_passenger_km": distance_to_passenger,
                        "trip_distance_km": trip_distance,
                        "expected_distance_range": "10-20km (Adana to Adana)",
                        "expected_trip_range": "500-600km (Adana to Istanbul)",
                        "calculation_working": distance_calculated
                    }
                )
                
                # Verify reasonable distance values
                reasonable_distances = (
                    0 < distance_to_passenger < 50 and  # Driver to passenger should be reasonable
                    400 < trip_distance < 700  # Adana to Istanbul is ~550km
                )
                
                self.test_results.add_result(
                    "Distance Values Reasonableness",
                    reasonable_distances,
                    f"Distance values are reasonable: {reasonable_distances}",
                    {
                        "distance_to_passenger_reasonable": 0 < distance_to_passenger < 50,
                        "trip_distance_reasonable": 400 < trip_distance < 700
                    }
                )
                
                return distance_calculated and reasonable_distances
            else:
                self.test_results.add_result(
                    "Distance Calculation Test",
                    False,
                    "Test TAG not found in driver requests"
                )
                return False
        else:
            self.test_results.add_result(
                "Distance Calculation Test",
                False,
                f"Failed to get driver requests: {response['data']}"
            )
            return False
    
    async def test_driver_send_offer(self):
        """Test driver send offer endpoint"""
        print("\n💰 Testing driver send offer...")
        
        if not self.test_tag_id:
            self.test_results.add_result(
                "Driver Send Offer Test",
                False,
                "No test TAG available for offer testing"
            )
            return False
        
        driver_id = self.test_users["driver"]["id"]
        
        offer_data = {
            "tag_id": self.test_tag_id,
            "price": 850.0,  # Reasonable price for Adana-Istanbul
            "estimated_time": 480,  # 8 hours
            "notes": "Konforlu yolculuk, klimalı araç"
        }
        
        response = await self.make_request("POST", "/driver/send-offer", 
            offer_data,
            params={"user_id": driver_id}
        )
        
        success = response["success"]
        self.test_results.add_result(
            "Driver Send Offer",
            success,
            f"Offer sent successfully: {success}",
            {
                "offer_price": offer_data["price"],
                "estimated_time": offer_data["estimated_time"],
                "response": response["data"]
            }
        )
        
        return success
    
    async def test_passenger_update_destination(self):
        """Test passenger update destination endpoint"""
        print("\n🎯 Testing passenger update destination...")
        
        if not self.test_tag_id:
            self.test_results.add_result(
                "Passenger Update Destination Test",
                False,
                "No test TAG available for destination update testing"
            )
            return False
        
        passenger_id = self.test_users["passenger"]["id"]
        
        update_data = {
            "tag_id": self.test_tag_id,
            "dropoff_location": "Taksim, İstanbul",
            "dropoff_lat": 41.05,  # Taksim coordinates
            "dropoff_lng": 28.98
        }
        
        response = await self.make_request("POST", "/passenger/update-destination",
            update_data,
            params={"user_id": passenger_id}
        )
        
        success = response["success"]
        self.test_results.add_result(
            "Passenger Update Destination",
            success,
            f"Destination updated successfully: {success}",
            {
                "new_destination": update_data["dropoff_location"],
                "new_coordinates": f"({update_data['dropoff_lat']}, {update_data['dropoff_lng']})",
                "response": response["data"]
            }
        )
        
        # Verify the update by checking the TAG
        if success:
            tag_response = await self.make_request("GET", "/passenger/active-tag",
                params={"user_id": passenger_id}
            )
            
            if tag_response["success"] and tag_response["data"]["tag"]:
                tag = tag_response["data"]["tag"]
                coordinates_updated = (
                    tag.get("dropoff_lat") == 41.05 and
                    tag.get("dropoff_lng") == 28.98 and
                    tag.get("dropoff_location") == "Taksim, İstanbul"
                )
                
                self.test_results.add_result(
                    "Destination Update Verification",
                    coordinates_updated,
                    f"Destination coordinates updated in database: {coordinates_updated}",
                    {
                        "updated_location": tag.get("dropoff_location"),
                        "updated_coords": f"({tag.get('dropoff_lat')}, {tag.get('dropoff_lng')})"
                    }
                )
        
        return success
    
    async def test_passenger_cancel_tag(self):
        """Test passenger cancel TAG endpoint"""
        print("\n❌ Testing passenger cancel TAG...")
        
        if not self.test_tag_id:
            self.test_results.add_result(
                "Passenger Cancel TAG Test",
                False,
                "No test TAG available for cancellation testing"
            )
            return False
        
        passenger_id = self.test_users["passenger"]["id"]
        
        cancel_data = {
            "tag_id": self.test_tag_id
        }
        
        response = await self.make_request("POST", "/passenger/cancel-tag",
            cancel_data,
            params={"user_id": passenger_id}
        )
        
        success = response["success"]
        self.test_results.add_result(
            "Passenger Cancel TAG",
            success,
            f"TAG cancelled successfully: {success}",
            {
                "cancelled_tag_id": self.test_tag_id,
                "response": response["data"]
            }
        )
        
        # Verify TAG status is CANCELLED
        if success:
            tag_response = await self.make_request("GET", "/passenger/active-tag",
                params={"user_id": passenger_id}
            )
            
            # Should return no active TAG since it's cancelled
            no_active_tag = (
                tag_response["success"] and 
                tag_response["data"]["tag"] is None
            )
            
            self.test_results.add_result(
                "TAG Cancellation Verification",
                no_active_tag,
                f"No active TAG after cancellation: {no_active_tag}",
                {
                    "active_tag_response": tag_response["data"]
                }
            )
        
        return success
    
    async def run_all_tests(self):
        """Run all priority tests"""
        print("🚀 Starting Leylek TAG Backend Tests")
        print(f"🌐 Testing API at: {API_BASE}")
        print("=" * 60)
        
        # Setup
        setup_success = await self.setup_test_users()
        if not setup_success:
            print("❌ Setup failed, aborting tests")
            return
        
        # Priority tests based on test_result.md
        await self.test_create_tag_with_coordinates()
        await self.test_distance_calculation()  # MOST CRITICAL
        await self.test_driver_send_offer()
        await self.test_passenger_update_destination()
        await self.test_passenger_cancel_tag()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.test_results.passed}")
        print(f"❌ Failed: {self.test_results.failed}")
        print(f"📈 Success Rate: {(self.test_results.passed / (self.test_results.passed + self.test_results.failed) * 100):.1f}%")
        
        # Critical issues
        critical_failures = []
        for result in self.test_results.results:
            if not result["passed"] and "Distance Calculation" in result["test"]:
                critical_failures.append(result["test"])
        
        if critical_failures:
            print(f"\n🚨 CRITICAL FAILURES:")
            for failure in critical_failures:
                print(f"   - {failure}")
        
        return self.test_results

async def main():
    """Main test runner"""
    async with LeylekTagTester() as tester:
        results = await tester.run_all_tests()
        
        # Save results to file
        with open("/app/test_results_backend.json", "w", encoding="utf-8") as f:
            json.dump({
                "summary": {
                    "passed": results.passed,
                    "failed": results.failed,
                    "total": results.passed + results.failed,
                    "success_rate": results.passed / (results.passed + results.failed) * 100 if (results.passed + results.failed) > 0 else 0
                },
                "results": results.results,
                "timestamp": datetime.now().isoformat()
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Detailed results saved to: /app/test_results_backend.json")

if __name__ == "__main__":
    asyncio.run(main())