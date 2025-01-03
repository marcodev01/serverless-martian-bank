import json
import os
from pymongo import MongoClient

def handler(event, context):
    # Parse request body
    body = json.loads(event['body'])
    email_id = body.get('email_id')
    account_type = body.get('account_type')
    
    # Connect to DocumentDB
    client = MongoClient(os.environ['DB_URL'])
    db = client.martianbank
    collection = db.accounts
    
    # Build query
    query = {"email_id": email_id}
    if account_type:
        query["account_type"] = account_type
    
    # Find account
    account = collection.find_one(query)
    
    if account:
        response = {
            'account_number': account["account_number"],
            'name': account["name"],
            'balance': account["balance"],
            'currency': account["currency"],
            'email_id': account["email_id"],
            'account_type': account["account_type"]
        }

        return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(response)
    }
    
    return {
            'statusCode': 500
        }