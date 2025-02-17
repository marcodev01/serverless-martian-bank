import json
import logging
import os
import boto3
from pymongo import MongoClient
from datetime import datetime
from decimal import Decimal
from events.transaction_completed import TransactionCompletedEvent

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_mongodb_client():
    mongodb_uri = os.environ['DB_URL']
    return MongoClient(mongodb_uri)

def handler(event, context):
    client = None
    try:
        # Parse request body
        request_data = json.loads(event['body'])
        amount = float(request_data["amount"])
        
        if amount <= 0:
            return error_response("Invalid amount", 400)
        
        # Connect to MongoDB
        client = get_mongodb_client()
        db = client["bank"]
        collection_transactions = db["transactions"]
        collection_accounts = db["accounts"]
        
        # Determine sender and receiver accounts using the e-mail
        sender_account = collection_accounts.find_one(
            {"email": request_data["sender_email"]}
        )
        if not sender_account:
            return error_response("Sender Account Not Found", 404)
        
        receiver_account = collection_accounts.find_one(
            {"email": request_data["receiver_email"]}
        )
        if not receiver_account:
            return error_response("Receiver Account Not Found", 404)
        
        # Get the account numbers from the accounts found
        sender_account_number = sender_account.get("account_number")
        receiver_account_number = receiver_account.get("account_number")
        
        if not sender_account_number or not receiver_account_number:
            return error_response("Account number missing", 500)
        
        # Check sufficient balance
        if sender_account["balance"] < amount:
            return error_response("Insufficient Balance", 400)
            
        # save the transaction in the DB (status: pending)
        transaction = {
            "sender": sender_account_number,
            "receiver": receiver_account_number,
            "amount": amount,
            "reason": request_data.get("reason", "Zelle Transfer"),
            "time_stamp": datetime.now(),
            "status": "pending"
        }
        transaction_result = collection_transactions.insert_one(transaction)
        
        # Publish transaction event
        try:
            # The event with the account numbers
            transaction_event = TransactionCompletedEvent(
                from_account=sender_account_number,
                to_account=receiver_account_number,
                amount=Decimal(str(amount)),
                reason=request_data.get("reason", "Zelle Transfer")
            )
            
            events_client = boto3.client('events')
            events_client.put_events(
                Entries=[{
                    **transaction_event.to_eventbridge(),
                    'EventBusName': os.environ['EVENT_BUS_NAME']
                }]
            )
            
            # Update transaction status to completed
            collection_transactions.update_one(
                {"_id": transaction_result.inserted_id},
                {"$set": {"status": "completed"}}
            )
            
        except Exception as e:
            # Mark transaction as failed if event publishing fails
            collection_transactions.update_one(
                {"_id": transaction_result.inserted_id},
                {"$set": {"status": "failed", "error": str(e)}}
            )
            raise e
        
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({
                "approved": True, 
                "message": "Transaction is Successful",
                "transactionId": str(transaction_result.inserted_id)
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing transaction: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers(),
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if client:
            client.close()

def error_response(message, status):
    return {
        'statusCode': status,
        'headers': cors_headers(),
        'body': json.dumps({"approved": False, "message": message})
    }

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
        'Content-Type': 'application/json'
    }

