import os
import sys
import pytest
import json
from unittest.mock import MagicMock, patch
from bson import ObjectId
from datetime import datetime

current_dir = os.path.dirname(os.path.abspath(__file__))
lambda_path = os.path.join(current_dir, '../../../domains/transactions/application/handlers')
sys.path.append(lambda_path)

from get_transaction_history import handler

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {'DB_URL': 'mongodb://testdb:27017'}):
        yield

@pytest.fixture
def sample_transactions():
    account_number = "1234567890"
    other_account = "9876543210"
    timestamp = datetime.now()
    
    return [
        {
            "_id": ObjectId(),
            "sender": account_number,
            "receiver": other_account,
            "amount": 100.50,
            "reason": "Payment sent",
            "time_stamp": timestamp,
            "status": "completed"
        },
        {
            "_id": ObjectId(),
            "sender": other_account,
            "receiver": account_number,
            "amount": 200.75,
            "reason": "Payment received",
            "time_stamp": timestamp,
            "status": "completed"
        }
    ]

@pytest.fixture
def mock_mongodb(mocker):
    mock_collection = MagicMock()
    mock_db = MagicMock()
    mock_client = MagicMock()
    
    # Setup MongoDB mock returns
    mock_db.__getitem__.return_value = mock_collection
    mock_client.__getitem__.return_value = mock_db
    
    with patch('get_transaction_history.get_mongodb_client', return_value=mock_client):
        yield mock_client, mock_collection

def test_successful_transaction_history_retrieval(mock_mongodb, sample_transactions):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find.return_value = sample_transactions
    account_number = "1234567890"
    
    event = {
        'body': json.dumps({
            'account_number': account_number
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    transactions = json.loads(response['body'])
    assert len(transactions) == 2
    
    # Check first transaction (sent payment)
    assert transactions[0]['account_number'] == "9876543210"
    assert transactions[0]['amount'] == 100.50
    assert transactions[0]['type'] == "debit"
    
    # Check second transaction (received payment)
    assert transactions[1]['account_number'] == "9876543210"
    assert transactions[1]['amount'] == 200.75
    assert transactions[1]['type'] == "credit"

def test_empty_transaction_history(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find.return_value = []
    
    event = {
        'body': json.dumps({
            'account_number': "1234567890"
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    transactions = json.loads(response['body'])
    assert len(transactions) == 0

def test_invalid_request_body(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    event = {
        'body': 'invalid json'
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_missing_account_number(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    event = {
        'body': json.dumps({})  # Missing account_number
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_mongodb_connection_error(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_client.__getitem__.side_effect = Exception('MongoDB connection error')
    
    event = {
        'body': json.dumps({
            'account_number': "1234567890"
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body
    assert 'MongoDB connection error' in str(response_body['error'])

def test_mixed_transaction_types(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    account_number = "1234567890"
    transactions = [
        {
            "_id": ObjectId(),
            "sender": account_number,
            "receiver": "9876543210",
            "amount": 100.00,
            "reason": "Sent payment",
            "time_stamp": datetime.now(),
            "status": "completed"
        },
        {
            "_id": ObjectId(),
            "sender": "5555555555",
            "receiver": account_number,
            "amount": 50.00,
            "reason": "Received payment",
            "time_stamp": datetime.now(),
            "status": "completed"
        }
    ]
    mock_collection.find.return_value = transactions
    
    event = {
        'body': json.dumps({
            'account_number': account_number
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    result = json.loads(response['body'])
    assert result[0]['type'] == 'debit'
    assert result[1]['type'] == 'credit'