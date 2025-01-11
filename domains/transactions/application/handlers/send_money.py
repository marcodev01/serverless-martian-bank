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
            return {
                'statusCode': 400,
                'body': json.dumps({"approved": False, "message": "Invalid amount"})
            }
        
        # Connect to MongoDB
        client = get_mongodb_client()
        db = client["bank"]
        collection_transactions = db["transactions"]
        collection_accounts = db["accounts"]
        
        # Get accounts and validate
        sender_account = collection_accounts.find_one(
            {"account_number": request_data["sender_account_number"]}
        )
        if not sender_account:
            return {
                'statusCode': 404,
                'body': json.dumps({"approved": False, "message": "Sender Account Not Found"})
            }
        
        receiver_account = collection_accounts.find_one(
            {"account_number": request_data["receiver_account_number"]}
        )
        if not receiver_account:
            return {
                'statusCode': 404,
                'body': json.dumps({"approved": False, "message": "Receiver Account Not Found"})
            }
        
        # Check sufficient balance
        if sender_account["balance"] < amount:
            return {
                'statusCode': 400,
                'body': json.dumps({"approved": False, "message": "Insufficient Balance"})
            }
            
        # Record transaction first
        transaction = {
            "sender": sender_account["account_number"],
            "receiver": receiver_account["account_number"],
            "amount": amount,
            "reason": request_data.get("reason", "Transfer"),
            "time_stamp": datetime.now(),
            "status": "pending"
        }
        transaction_result = collection_transactions.insert_one(transaction)
        
        # Publish transaction event
        try:
            transaction_event = TransactionCompletedEvent(
                from_account=sender_account["account_number"],
                to_account=receiver_account["account_number"],
                amount=Decimal(str(amount)),
                reason=request_data.get("reason", "Transfer")
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
            raise
        
        return {
            'statusCode': 200,
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
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if client:
            client.close()