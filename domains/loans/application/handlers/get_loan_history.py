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
        email = request_data["email"]
        
        client = get_mongodb_client()
        db = client["bank"]
        collection_loans = db["loans"]
        
        loans = collection_loans.find({"email": email})
        loan_history = []
        
        for loan in loans:
            loan_history.append({
                "name": loan["name"],
                "email": loan["email"],
                "account_type": loan["account_type"],
                "account_number": loan["account_number"],
                "govt_id_type": loan["govt_id_type"],
                "govt_id_number": loan["govt_id_number"],
                "loan_type": loan["loan_type"],
                "loan_amount": loan["loan_amount"],
                "interest_rate": loan["interest_rate"],
                "time_period": loan["time_period"],
                "status": loan["status"],
                "timestamp": loan["timestamp"].isoformat()
            })
            
        return {
            'statusCode': 200,
            'body': json.dumps(loan_history)
        }
        
    except Exception as e:
        logger.error(f"Error getting loan history: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if client:
            client.close()