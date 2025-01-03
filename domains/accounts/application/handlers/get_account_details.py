import os
import json
import logging
from pymongo import MongoClient

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_mongodb_client():
    mongodb_uri = os.environ['DB_URL']
    return MongoClient(mongodb_uri)

def handler(event, context):
    try:
        # Parse request body
        request_data = json.loads(event['body'])

        # Connect to MongoDB
        client = get_mongodb_client()
        db = client["bank"]
        collection = db["accounts"]

        # Get account details
        account = collection.find_one({"account_number": request_data["account_number"]})
        
        if account:
            response = {
                'account_number': account["account_number"],
                'name': account["name"],
                'balance': account["balance"],
                'currency': account["currency"],
                'email_id': account["email_id"],
                'account_type': account["account_type"],
            }
            return {
                'statusCode': 200,
                'body': json.dumps(response)
            }
        
        return {
            'statusCode': 404,
            'body': json.dumps({})
        }

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        client.close()