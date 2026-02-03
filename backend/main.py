import firebase_admin
from firebase_admin import credentials, auth, db
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import httpx 
import time

# ---------------------------------------------------------
# 1. SETUP: Initialize Firebase (Complete & Preserved)
# ---------------------------------------------------------
base_dir = os.path.dirname(os.path.abspath(__file__))
service_key_path = os.path.join(base_dir, "serviceAccountKey.json")

if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(service_key_path)
        firebase_admin.initialize_app(cred, {
            'databaseURL': 'https://final-future-d1547-default-rtdb.firebaseio.com/' 
        })
    except Exception as e:
        print(f"CRITICAL: Firebase Init Error: {e}")

app = FastAPI()

# ---------------------------------------------------------
# 2. CORS: Smartphone Connection (Complete & Preserved)
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# 3. MESSENGER SCHEMAS
# ---------------------------------------------------------
class EditMessageSchema(BaseModel):
    messageId: str
    newText: str

# ---------------------------------------------------------
# 4. HOME DATA ENDPOINT (Profile & Batch Logic)
# ---------------------------------------------------------
@app.get("/user-home-data")
async def get_home_data(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.split("Bearer ")[1]
    
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        
        # Pull profile from FLAT structure
        user_ref = db.reference(f'users/{uid}')
        user_data = user_ref.get()

        if not user_data:
            raise HTTPException(status_code=403, detail="User not found")

        # Set user to online
        user_ref.update({"status": "online"})

        # --- REAL-TIME STATUS: Mark Admin messages as 'delivered' because user is now online ---
        chat_ref = db.reference(f'chats/{uid}')
        messages = chat_ref.get()
        if messages:
            updates = {}
            for m_id, m_val in messages.items():
                if m_val.get("sender") == "admin" and m_val.get("status") == "sent":
                    updates[f"{m_id}/status"] = "delivered"
            if updates:
                chat_ref.update(updates)

        # Pull Global Batches
        global_batches = db.reference('global_batches').get() or {}
        active_batch = None
        for key, val in global_batches.items():
            if val.get("status") == "active":
                active_batch = {**val, "id": key}
                break

        return {
            "profile": {
                "firstName": user_data.get("firstName", "Farmer"),
                "lastName": user_data.get("lastName", ""),
                "fullName": user_data.get("fullName", user_data.get("firstName")),
                "role": user_data.get("role", "user"),
                "username": user_data.get("username"),
                "status": "online",
                "profilePicture": user_data.get("profilePicture", "")
            },
            "activeBatch": active_batch
        }
        
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Session")

# ---------------------------------------------------------
# 5. MESSENGER ENDPOINTS (New Status Logic Added)
# ---------------------------------------------------------
@app.patch("/edit-message")
async def edit_user_message(data: EditMessageSchema, authorization: str = Header(None)):
    """Allows user to edit their own message in the chat"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        
        msg_ref = db.reference(f'chats/{uid}/{data.messageId}')
        msg_ref.update({
            "text": data.newText,
            "isEdited": True,
            "editTimestamp": int(time.time() * 1000)
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/delete-message/{message_id}")
async def delete_user_message(message_id: str, authorization: str = Header(None)):
    """Allows user to delete their own message"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        
        db.reference(f'chats/{uid}/{message_id}').delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/mark-seen")
async def mark_messages_as_seen(authorization: str = Header(None)):
    """NEW: Call this when user opens the chat to set status to 'seen'"""
    if not authorization: raise HTTPException(status_code=401)
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        chat_ref = db.reference(f'chats/{uid}')
        messages = chat_ref.get()
        if messages:
            updates = {}
            for m_id, m_val in messages.items():
                if m_val.get("sender") == "admin":
                    updates[f"{m_id}/status"] = "seen"
                    updates[f"{m_id}/seen"] = True
            if updates:
                chat_ref.update(updates)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------
# 6. GET WEATHER FROM DB (Admin-Updated node)
# ---------------------------------------------------------
@app.get("/get-db-weather")
async def get_db_weather():
    weather_data = db.reference('current_weather').get()
    if not weather_data:
        return {"temperature": "--", "weatherCode": 0, "unit": "°C"}
    return weather_data

# ---------------------------------------------------------
# 7. EXECUTION
# ---------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    # Smartphone access host on Port 8001
    uvicorn.run(app, host="0.0.0.0", port=8001)