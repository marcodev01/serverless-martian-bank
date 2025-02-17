import json
import logging
import os
import boto3
from pymongo import MongoClient
from decimal import Decimal
from datetime import datetime
from events.loan_granted import LoanGrantedEvent

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_mongodb_client():
    mongodb_uri = os.environ['DB_URL']
    return MongoClient(mongodb_uri)

def handler(event, context):
    client = None 
    try:
        # Parse request data
        request_data = json.loads(event['body'])
        loan_amount = float(request_data["loan_amount"])
        
        if loan_amount <= 0:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': '*',
                    'Content-Type': 'application/json'
                }, 
                'body': json.dumps({"approved": False, "message": "Invalid loan amount"})
            }

        # Step 1: Get account details from account domain (via Step Functions)
        account = event.get("accountDetails")  # Provided by previous step
        if not account:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': '*',
                    'Content-Type': 'application/json'
                }, 
                'body': json.dumps({"approved": False, "message": "Account details not found"})
            }

        # Step 2: Process loan in loans domain
        client = get_mongodb_client()
        db = client["bank"]
        collection_loans = db["loans"]
        
        # Create loan request
        loan_request = {
            "name": request_data["name"],
            "email": request_data["email"],
            "account_type": account["account_type"],
            "account_number": account["account_number"],
            "govt_id_type": request_data["govt_id_type"],
            "govt_id_number": request_data["govt_id_number"],
            "loan_type": request_data["loan_type"],
            "loan_amount": loan_amount,
            "interest_rate": float(request_data["interest_rate"]),
            "time_period": request_data["time_period"],
            "status": "approved", 
            "timestamp": datetime.now()
        }
        
        # Insert loan
        loan_result = collection_loans.insert_one(loan_request)
        
        # Publish loan granted event
        loan_event = LoanGrantedEvent(
            account_number=account["account_number"],
            amount=Decimal(str(loan_amount))
        )
        
        events_client = boto3.client('events')
        events_client.put_events(
            Entries=[{
                **loan_event.to_eventbridge(),
                'EventBusName': os.environ['EVENT_BUS_NAME']
            }]
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*',
                'Content-Type': 'application/json'
            }, 
            'body': json.dumps({
                "approved": True,
                "message": "Loan Approved",
                "loanId": str(loan_result.inserted_id)
            })
        }
            
    except Exception as e:
        logger.error(f"Error processing loan: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*',
                'Content-Type': 'application/json'
            }, 
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if client:
            client.close()