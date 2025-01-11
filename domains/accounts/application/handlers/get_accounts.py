import os
import json
import logging
from pymongo import MongoClient

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_mongodb_client():
    mongodb_uri = os.environ['MONGODB_URI']
    return MongoClient(mongodb_uri)

def handler(event, context):
    client = None
    try:
        # Parse request body
        body = json.loads(event['body'])
        email_id = body['email_id']
        account_number = body.get('account_number')  # Optional
        
        # Connect to MongoDB
        client = get_mongodb_client()
        db = client["bank"]
        collection = db["accounts"]
        
        # Build query
        query = {"email_id": email_id}
        if account_number:
            query["account_number"] = account_number
            
        # Get accounts
        accounts = collection.find(query)
        account_list = []
        
        for account in accounts:
            account_list.append({
                "account_number": account["account_number"],
                "email_id": account["email_id"],
                "account_type": account["account_type"],
                "address": account["address"],
                "govt_id_number": account["govt_id_number"],
                "government_id_type": account["government_id_type"],
                "name": account["name"],
                "balance": account["balance"],
                "currency": account["currency"]
            })
            
        return {
            'statusCode': 200,
            'body': json.dumps(account_list)
        }
        
    except Exception as e:
        logger.error(f"Error getting accounts: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if client is not None:
            client.close()