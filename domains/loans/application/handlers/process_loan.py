import json
import logging
import os
import boto3
from pymongo import MongoClient
from datetime import datetime
from decimal import Decimal
from events.loan_granted import LoanGrantedEvent

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_mongodb_client():
    mongodb_uri = os.environ['DB_URL']
    return MongoClient(mongodb_uri)

def handler(event, context):
    try:
        request_data = json.loads(event['body'])
        loan_amount = float(request_data["loan_amount"])
        
        if loan_amount <= 0:
            return {
                'statusCode': 400,
                'body': json.dumps({"approved": False, "message": "Invalid loan amount"})
            }
        
        client = get_mongodb_client()
        db = client["bank"]
        collection_loans = db["loans"]
        collection_accounts = db["accounts"]
        
        # Verify account exists
        account = collection_accounts.find_one(
            {"account_number": request_data["account_number"]}
        )
        if not account:
            return {
                'statusCode': 404,
                'body': json.dumps({"approved": False, "message": "Account not found"})
            }
            
        # Process loan request
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
            "status": "pending",
            "timestamp": datetime.now()
        }
        
        # Insert loan request
        loan_result = collection_loans.insert_one(loan_request)
        
        try:
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
            
            # Update loan status to approved
            collection_loans.update_one(
                {"_id": loan_result.inserted_id},
                {"$set": {"status": "approved"}}
            )
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    "approved": True,
                    "message": "Loan Approved",
                    "loanId": str(loan_result.inserted_id)
                })
            }
            
        except Exception as e:
            # Mark loan as failed if event publishing fails
            collection_loans.update_one(
                {"_id": loan_result.inserted_id},
                {"$set": {"status": "failed", "error": str(e)}}
            )
            raise
        
    except Exception as e:
        logger.error(f"Error processing loan: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if client:
            client.close()