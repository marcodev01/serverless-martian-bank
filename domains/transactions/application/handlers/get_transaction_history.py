import json
import logging
import os
from pymongo import MongoClient

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_mongodb_client():
    mongodb_uri = os.environ['DB_URL']
    return MongoClient(mongodb_uri)

def handler(event, context):
    try:
        request_data = json.loads(event['body'])
        account_number = request_data["account_number"]
        
        client = get_mongodb_client()
        db = client["bank"]
        collection_transactions = db["transactions"]
        
        # Get all transactions as sender or receiver
        transactions = collection_transactions.find({
            "$or": [
                {"sender": account_number},
                {"receiver": account_number}
            ]
        })
        
        transactions_list = []
        
        for t in transactions:
            is_sender = t["sender"] == account_number
            transactions_list.append({
                "account_number": t["receiver"] if is_sender else t["sender"],
                "amount": t["amount"],
                "reason": t["reason"],
                "time_stamp": t["time_stamp"].isoformat(),
                "type": "debit" if is_sender else "credit",
                "status": t["status"],
                "transaction_id": str(t["_id"])
            })
            
        return {
            'statusCode': 200,
            'body': json.dumps(transactions_list)
        }
        
    except Exception as e:
        logger.error(f"Error getting transaction history: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if client:
            client.close()