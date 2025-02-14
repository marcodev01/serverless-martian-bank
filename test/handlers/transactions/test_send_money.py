import os
import sys
import pytest
import json
from unittest.mock import MagicMock, patch
from bson import ObjectId
from datetime import datetime
from decimal import Decimal

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(current_dir, '../../..')
lambda_path = os.path.join(project_root, 'domains/transactions/application/handlers')
events_path = os.path.join(project_root, 'domains/transactions/domain')
sys.path.extend([lambda_path, events_path])

# Mock for TransactionCompletedEvent
class MockTransactionEvent:
    def __init__(self, from_account, to_account, amount, reason):
        self.from_account = from_account
        self.to_account = to_account
        self.amount = amount
        self.reason = reason

    def to_eventbridge(self):
        return {
            'Source': 'martian-bank',
            'DetailType': 'TransactionCompleted',
            'Detail': json.dumps({
                'from_account': self.from_account,
                'to_account': self.to_account,
                'amount': str(self.amount),
                'reason': self.reason
            })
        }

# Mock events
sys.modules['events.transaction_completed'] = MagicMock()
sys.modules['events.transaction_completed'].TransactionCompletedEvent = MockTransactionEvent

from send_money import handler

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {
        'DB_URL': 'mongodb://testdb:27017',
        'EVENT_BUS_NAME': 'test-event-bus'
    }):
        yield

@pytest.fixture
def sample_accounts():
    return {
        "sender": {
            "_id": ObjectId(),
            "account_number": "1234567890",
            "balance": 1000.00,
            "name": "Test Sender"
        },
        "receiver": {
            "_id": ObjectId(),
            "account_number": "9876543210",
            "balance": 500.00,
            "name": "Test Receiver"
        }
    }

@pytest.fixture
def mock_mongodb(mocker):
    mock_transactions = MagicMock()
    mock_accounts = MagicMock()
    mock_db = MagicMock()
    mock_client = MagicMock()
    
    mock_db.__getitem__.side_effect = lambda x: {
        "transactions": mock_transactions,
        "accounts": mock_accounts
    }[x]
    mock_client.__getitem__.return_value = mock_db
    
    with patch('send_money.MongoClient', return_value=mock_client):
        yield mock_client, mock_transactions, mock_accounts

@pytest.fixture
def mock_boto3():
    with patch('boto3.client') as mock:
        mock_events = MagicMock()
        mock.return_value = mock_events
        yield mock_events

def test_invalid_amount(mock_mongodb):
    # Arrange
    mock_client, mock_transactions, mock_accounts = mock_mongodb
    
    event = {
        'body': json.dumps({
            'sender_account_number': "1234567890",
            'receiver_account_number': "9876543210",
            'amount': 0,
            'reason': "Invalid amount test"
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 400
    response_body = json.loads(response['body'])
    assert response_body['approved'] is False
    assert response_body['message'] == "Invalid amount"

def test_eventbridge_failure(mock_mongodb, mock_boto3, sample_accounts):
    # Arrange
    mock_client, mock_transactions, mock_accounts = mock_mongodb
    mock_accounts.find_one.side_effect = [
        sample_accounts["sender"],
        sample_accounts["receiver"]
    ]
    transaction_id = ObjectId()
    mock_transactions.insert_one.return_value = MagicMock(inserted_id=transaction_id)
    
    # Simulate EventBridge failure
    mock_boto3.put_events.side_effect = Exception("EventBridge error")
    
    event = {
        'body': json.dumps({
            'sender_account_number': "1234567890",
            'receiver_account_number': "9876543210",
            'amount': 100.00,
            'reason': "Test transfer"
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body
    assert 'EventBridge error' in str(response_body['error'])
    
    # Verify transaction was marked as failed
    mock_transactions.update_one.assert_called_with(
        {"_id": transaction_id},
        {"$set": {"status": "failed", "error": "EventBridge error"}}
    )

def test_invalid_request_body(mock_mongodb):
    # Arrange
    mock_client, mock_transactions, mock_accounts = mock_mongodb
    event = {
        'body': 'invalid json'
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body