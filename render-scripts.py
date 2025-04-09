import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

RENDER_API_KEY = os.getenv('RENDER_API_KEY')
SERVICE_ID = os.getenv('RENDER_SERVICE_ID')

def get_service_logs():
    """Get the latest logs from the Render service"""
    headers = {
        'Authorization': f'Bearer {RENDER_API_KEY}',
        'Accept': 'application/json',
    }
    
    url = f'https://api.render.com/v1/services/{SERVICE_ID}/logs'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error getting logs: {response.status_code}")
        return None

def restart_service():
    """Restart the Render service"""
    headers = {
        'Authorization': f'Bearer {RENDER_API_KEY}',
        'Accept': 'application/json',
    }
    
    url = f'https://api.render.com/v1/services/{SERVICE_ID}/deploys'
    response = requests.post(url, headers=headers)
    
    if response.status_code == 201:
        print("Service restart initiated successfully")
        return True
    else:
        print(f"Error restarting service: {response.status_code}")
        return False

def get_service_status():
    """Get the current status of the Render service"""
    headers = {
        'Authorization': f'Bearer {RENDER_API_KEY}',
        'Accept': 'application/json',
    }
    
    url = f'https://api.render.com/v1/services/{SERVICE_ID}'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error getting service status: {response.status_code}")
        return None

if __name__ == '__main__':
    print("1. Get service logs")
    print("2. Restart service")
    print("3. Get service status")
    
    choice = input("Enter your choice (1-3): ")
    
    if choice == '1':
        logs = get_service_logs()
        if logs:
            print(json.dumps(logs, indent=2))
    elif choice == '2':
        restart_service()
    elif choice == '3':
        status = get_service_status()
        if status:
            print(json.dumps(status, indent=2))
    else:
        print("Invalid choice") 