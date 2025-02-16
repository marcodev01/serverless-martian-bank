import logging
from decimal import Decimal
from pymongo import MongoClient
import os
from events.transaction_completed import TransactionCompletedEvent
from events.loan_granted import LoanGrantedEvent

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_mongodb_client():
    mongodb_uri = os.environ['DB_URL']
    return MongoClient(mongodb_uri)

def handler(event, context):
    client = None
    try:
        client = get_mongodb_client()
        db = client["bank"]
        collection = db["accounts"]

        if event['source'] == TransactionCompletedEvent.SOURCE:
            # Handle transaction event
            transaction = TransactionCompletedEvent.from_eventbridge(event)
            
            # Update sender balance (decrement)
            result = collection.update_one(
                {"account_number": transaction.from_account},
                {"$inc": {"balance": -float(transaction.amount)}}
            )
            if result.modified_count == 0:
                logger.error(f"Failed to update sender balance for account {transaction.from_account}")
                return {'statusCode': 500}
            
            # Update receiver balance (increment)
            result = collection.update_one(
                {"account_number": transaction.to_account},
                {"$inc": {"balance": float(transaction.amount)}}
            )
            if result.modified_count == 0:
                logger.error(f"Failed to update receiver balance for account {transaction.to_account}")
                # TODO: Consider implementing compensation transaction
                return {'statusCode': 500}

        elif event['source'] == LoanGrantedEvent.SOURCE:
            # Handle loan event
            loan = LoanGrantedEvent.from_eventbridge(event)
            
            # Update account balance with loan amount
            result = collection.update_one(
                {"account_number": loan.account_number},
                {"$inc": {"balance": float(loan.amount)}}
            )
            if result.modified_count == 0:
                logger.error(f"Failed to update balance for account {loan.account_number}")
                return {'statusCode': 500}

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },   
        }

    except Exception as e:
        logger.error(f"Error updating balance: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json'
            },   
        }
    finally:
        if client:
            client.close()