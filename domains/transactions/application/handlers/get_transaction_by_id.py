import os
import json
import logging
from pymongo import MongoClient
from bson.objectid import ObjectId

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
        transaction_id = body['transaction_id']
        
        # Connect to MongoDB
        client = get_mongodb_client()
        db = client["bank"]
        collection = db["transactions"]
        
        # Find transaction
        transaction = collection.find_one({"_id": ObjectId(transaction_id)})
        
        if not transaction:
            return {
                'statusCode': 404,
                'body': json.dumps({})
            }
            
        # Format response
        response = {
            "account_number": transaction["receiver"],
            "amount": transaction["amount"],
            "reason": transaction["reason"],
            "time_stamp": transaction["time_stamp"].isoformat(),
            "type": "credit",
            "transaction_id": str(transaction["_id"])
        }
        
        return {
            'statusCode': 200,
            'body': json.dumps(response)
        }
        
    except Exception as e:
        logger.error(f"Error getting transaction: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if client:
            client.close()