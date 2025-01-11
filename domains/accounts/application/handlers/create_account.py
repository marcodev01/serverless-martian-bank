import os
import json
import logging
import random
import datetime
from pymongo import MongoClient

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_mongodb_client():
    mongodb_uri = os.environ['DB_URL']
    return MongoClient(mongodb_uri)

def generate_account_number():
    return f"IBAN{random.randint(1000000000000000, 9999999999999999)}"

def handler(event, context):
    client = None
    try:
        # Parse request body
        request_data = json.loads(event['body'])
       
        # Connect to MongoDB
        client = get_mongodb_client()
        db = client["bank"]
        collection = db["accounts"]

        # Check if account already exists
        count = collection.count_documents({
            "email_id": request_data["email_id"],
            "account_type": request_data["account_type"]
        })

        if count > 0:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'success': False,
                    'message': 'Account already exists'
                })
            }

        # Create new account
        account = {
            "email_id": request_data["email_id"],
            "account_type": request_data["account_type"],
            "address": request_data["address"],
            "govt_id_number": request_data["govt_id_number"],
            "government_id_type": request_data["government_id_type"],
            "name": request_data["name"],
            "balance": 100,  # Initial balance
            "currency": "USD",
            "account_number": generate_account_number(),
            "created_at": datetime.datetime.now()
        }

        # Insert account
        collection.insert_one(account)

        return {
            'statusCode': 201,
            'body': json.dumps({
                'success': True,
                'account_number': account['account_number']
            })
        }

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
    finally:
        if client is not None:
            client.close()