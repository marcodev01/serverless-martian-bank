import os
import sys
import pytest
import json
from unittest.mock import MagicMock, patch
from bson import ObjectId

current_dir = os.path.dirname(os.path.abspath(__file__))
lambda_path = os.path.join(current_dir, '../../../domains/accounts/application/handlers')
sys.path.append(lambda_path)

from get_accounts import handler

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {'MONGODB_URI': 'mongodb://testdb:27017'}):
        yield

@pytest.fixture
def mock_account_data():
    return [
        {
            '_id': ObjectId(),
            'account_number': 'IBAN1234567890123456',
            'email_id': 'test@example.com',
            'account_type': 'savings',
            'address': '123 Test St',
            'govt_id_number': 'ABC123',
            'government_id_type': 'passport',
            'name': 'Test User',
            'balance': 1000,
            'currency': 'USD'
        },
        {
            '_id': ObjectId(),
            'account_number': 'IBAN9876543210987654',
            'email_id': 'test@example.com',
            'account_type': 'checking',
            'address': '123 Test St',
            'govt_id_number': 'ABC123',
            'government_id_type': 'passport',
            'name': 'Test User',
            'balance': 2000,
            'currency': 'USD'
        }
    ]

@pytest.fixture
def mock_mongodb(mocker):
    mock_collection = MagicMock()
    mock_db = MagicMock()
    mock_client = MagicMock()
    
    mock_db.__getitem__.return_value = mock_collection
    mock_client.__getitem__.return_value = mock_db
    
    with patch('get_accounts.MongoClient', return_value=mock_client):
        yield mock_client, mock_collection

def test_get_all_accounts_for_email(mock_mongodb, mock_account_data):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find.return_value = mock_account_data
    
    event = {
        'body': json.dumps({
            'email_id': 'test@example.com'
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    accounts = json.loads(response['body'])
    assert len(accounts) == 2
    
    # Verify MongoDB query
    mock_collection.find.assert_called_once_with({"email_id": "test@example.com"})
    
    # Check first account details
    assert accounts[0]['account_number'] == 'IBAN1234567890123456'
    assert accounts[0]['account_type'] == 'savings'
    assert accounts[0]['balance'] == 1000
    
    # Check second account details
    assert accounts[1]['account_number'] == 'IBAN9876543210987654'
    assert accounts[1]['account_type'] == 'checking'
    assert accounts[1]['balance'] == 2000

def test_get_specific_account(mock_mongodb, mock_account_data):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find.return_value = [mock_account_data[0]]
    
    event = {
        'body': json.dumps({
            'email_id': 'test@example.com',
            'account_number': 'IBAN1234567890123456'
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    accounts = json.loads(response['body'])
    assert len(accounts) == 1
    
    # Verify MongoDB query
    mock_collection.find.assert_called_once_with({
        "email_id": "test@example.com",
        "account_number": "IBAN1234567890123456"
    })
    
    # Check account details
    assert accounts[0]['account_number'] == 'IBAN1234567890123456'
    assert accounts[0]['account_type'] == 'savings'

def test_no_accounts_found(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find.return_value = []
    
    event = {
        'body': json.dumps({
            'email_id': 'nonexistent@example.com'
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    accounts = json.loads(response['body'])
    assert len(accounts) == 0

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

def test_missing_email_id(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    event = {
        'body': json.dumps({})
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_mongodb_connection_error():
    # Arrange
    with patch('get_accounts.get_mongodb_client') as mock_get_client:
        mock_get_client.side_effect = Exception('Connection error')
        
        event = {
            'body': json.dumps({
                'email_id': 'test@example.com'
            })
        }
        
        # Act
        response = handler(event, {})
        
        # Assert
        assert response['statusCode'] == 500
        response_body = json.loads(response['body'])
        assert 'error' in response_body
        assert 'Connection error' in response_body['error']