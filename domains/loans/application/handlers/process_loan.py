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
    approved = True
    try:
        # Parse request data
        if 'httpMethod' in event or 'body' in event:
            source = "APIGateway"
            request_data = json.loads(event['body'])
        else:
            source = "StepFunction" 
            request_data = event   

        logger.info(f"From source: {source} received event: {event}")

        if not request_data.get("account_number"):
            logger.error(f"Account not found in request data: {request_data}")
            approved = False
            raise ValueError("Account number not found in request data")

        loan_amount = float(request_data["loan_amount"])
        if loan_amount <= 0:
            logger.error(f"Invalid loan amount: {loan_amount}")
            approved = False
        if loan_amount >= 100000:
            logger.error(f"Oops! Our bank's vault is empty: {loan_amount}")
            approved = False

        client = get_mongodb_client()
        db = client["bank"]
        collection_loans = db["loans"]
        
        # Create loan request
        loan_request = {
            "name": request_data["name"],
            "email": request_data["email"],
            "account_type": request_data["account_type"],
            "account_number": request_data["account_number"],
            "govt_id_type": request_data["govt_id_type"],
            "govt_id_number": request_data["govt_id_number"],
            "loan_type": request_data["loan_type"],
            "loan_amount": loan_amount,
            "interest_rate": float(request_data["interest_rate"]),
            "time_period": request_data["time_period"],
            "approved": approved, 
            "timestamp": datetime.now()
        }
        
        # Insert loan
        loan_result = collection_loans.insert_one(loan_request)
        
        if source == "APIGateway" and approved:
            # Publish loan granted event
            loan_event = LoanGrantedEvent(
                account_number=request_data["account_number"],
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
            'body': {
                "approved": approved,
                "loanId": str(loan_result.inserted_id),
                "account_number": request_data["account_number"],
                "amount": Decimal(str(loan_amount))
            }
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