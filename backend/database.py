"""Database adapter - MongoDB (Supabase'e geçiş için hazır)"""
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, List, Dict, Any
import os
from datetime import datetime
from bson import ObjectId

class Database:
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self.db_type = "mongodb"  # Supabase'e geçişte "supabase" olacak
    
    async def connect(self):
        """Connect to database"""
        if self.db_type == "mongodb":
            mongo_url = os.environ.get('MONGO_URL')
            self.client = AsyncIOMotorClient(mongo_url)
            self.db = self.client[os.environ.get('DB_NAME', 'leylek_tag')]
        # Supabase için hazır
        # elif self.db_type == "supabase":
        #     from supabase import create_client, Client
        #     url = os.environ.get("SUPABASE_URL")
        #     key = os.environ.get("SUPABASE_KEY")
        #     self.db = create_client(url, key)
    
    async def disconnect(self):
        """Disconnect from database"""
        if self.client:
            self.client.close()
    
    # Generic CRUD operations
    async def insert_one(self, collection: str, data: Dict[str, Any]) -> str:
        """Insert one document"""
        result = await self.db[collection].insert_one(data)
        return str(result.inserted_id)
    
    async def find_one(self, collection: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find one document"""
        return await self.db[collection].find_one(query)
    
    async def find_many(self, collection: str, query: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
        """Find many documents"""
        cursor = self.db[collection].find(query).limit(limit)
        return await cursor.to_list(length=limit)
    
    async def update_one(self, collection: str, query: Dict[str, Any], update: Dict[str, Any]) -> bool:
        """Update one document"""
        result = await self.db[collection].update_one(query, update)
        return result.modified_count > 0
    
    async def update_many(self, collection: str, query: Dict[str, Any], update: Dict[str, Any]) -> int:
        """Update many documents"""
        result = await self.db[collection].update_many(query, update)
        return result.modified_count
    
    async def delete_one(self, collection: str, query: Dict[str, Any]) -> bool:
        """Delete one document"""
        result = await self.db[collection].delete_one(query)
        return result.deleted_count > 0
    
    async def count_documents(self, collection: str, query: Dict[str, Any]) -> int:
        """Count documents"""
        return await self.db[collection].count_documents(query)

# Global database instance
db_instance = Database()
