import os
import sys
import pytest
import json
from unittest.mock import MagicMock, patch
from bson import ObjectId

# Fügen Sie den Lambda-Code-Pfad zum Python-Path hinzu
current_dir = os.path.dirname(os.path.abspath(__file__))
lambda_path = os.path.join(current_dir, '../../../domains/accounts/application/handlers')
sys.path.append(lambda_path)

from get_account_details import handler

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {'DB_URL': 'mongodb://testdb:27017'}):
        yield

@pytest.fixture
def valid_event():
    return {
        'body': json.dumps({
            'account_number': 'IBAN1234567890123456'
        })
    }

@pytest.fixture
def mock_account_data():
    return {
        '_id': ObjectId(),
        'account_number': 'IBAN1234567890123456',
        'name': 'Test User',
        'balance': 1000,
        'currency': 'USD',
        'email_id': 'test@example.com',
        'account_type': 'savings',
        'address': '123 Test St',
        'govt_id_number': 'ABC123'
    }

@pytest.fixture
def mock_mongodb(mocker):
    mock_collection = MagicMock()
    mock_db = MagicMock()
    mock_client = MagicMock()
    
    mock_db.__getitem__.return_value = mock_collection
    mock_client.__getitem__.return_value = mock_db
    
    with patch('get_account_details.MongoClient', return_value=mock_client):
        yield mock_client, mock_collection

def test_successful_account_retrieval(valid_event, mock_mongodb, mock_account_data):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find_one.return_value = mock_account_data
    
    # Act
    response = handler(valid_event, {})
    
    # Assert
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    
    # Check all required fields
    assert response_body['account_number'] == mock_account_data['account_number']
    assert response_body['name'] == mock_account_data['name']
    assert response_body['balance'] == mock_account_data['balance']
    assert response_body['currency'] == mock_account_data['currency']
    assert response_body['email_id'] == mock_account_data['email_id']
    assert response_body['account_type'] == mock_account_data['account_type']
    
    # Verify that sensitive fields are not included
    assert 'address' not in response_body
    assert 'govt_id_number' not in response_body
    assert '_id' not in response_body

def test_account_not_found(valid_event, mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find_one.return_value = None
    
    # Act
    response = handler(valid_event, {})
    
    # Assert
    assert response['statusCode'] == 404
    assert response['body'] == '{}'

def test_invalid_request_body(mock_mongodb):
    # Arrange
    invalid_event = {
        'body': 'invalid json'
    }
    
    # Act
    response = handler(invalid_event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_missing_account_number(mock_mongodb):
    # Arrange
    event = {
        'body': json.dumps({})  # Missing account_number
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_mongodb_connection_error(valid_event):
    # Arrange
    with patch('get_account_details.get_mongodb_client') as mock_get_client:
        mock_get_client.side_effect = Exception('Connection error')
        
        # Act
        response = handler(valid_event, {})
        
        # Assert
        assert response['statusCode'] == 500
        response_body = json.loads(response['body'])
        assert 'error' in response_body
        assert 'Connection error' in response_body['error']