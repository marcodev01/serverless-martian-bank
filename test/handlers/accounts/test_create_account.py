import os
import sys
import pytest
import json
import datetime
from unittest.mock import MagicMock, patch
from bson.objectid import ObjectId

# Fügen Sie den Lambda-Code-Pfad zum Python-Path hinzu
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../domains/accounts/application/handlers'))

from create_account import handler, generate_account_number

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {'DB_URL': 'mongodb://testdb:27017'}):
        yield

@pytest.fixture
def valid_event():
    return {
        'body': json.dumps({
            'email_id': 'test@example.com',
            'account_type': 'savings',
            'address': '123 Test St',
            'govt_id_number': 'ABC123456',
            'government_id_type': 'passport',
            'name': 'Test User'
        })
    }

@pytest.fixture
def mock_mongodb_client():
    with patch('create_account.MongoClient') as mock_client:
        # Create mock collection
        mock_collection = MagicMock()
        
        # Setup the mock database and collection
        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection
        mock_client.return_value.__getitem__.return_value = mock_db
        
        yield mock_client, mock_collection

def test_successful_account_creation(valid_event, mock_mongodb_client):
    # Arrange
    mock_client, mock_collection = mock_mongodb_client
    mock_collection.count_documents.return_value = 0
    
    # Mock datetime
    mock_datetime = datetime.datetime(2024, 1, 10, 12, 0, 0)
    with patch('create_account.datetime') as mock_dt:
        mock_dt.datetime.now.return_value = mock_datetime
        
        # Mock generate_account_number
        with patch('create_account.generate_account_number') as mock_gen:
            mock_gen.return_value = 'IBAN1234567890123456'
            
            # Act
            response = handler(valid_event, {})
            
            # Assert
            assert response['statusCode'] == 201
            response_body = json.loads(response['body'])
            assert response_body['success'] is True
            assert response_body['account_number'] == 'IBAN1234567890123456'
            
            # Verify MongoDB interactions
            mock_collection.insert_one.assert_called_once()
            insert_call_args = mock_collection.insert_one.call_args[0][0]
            assert insert_call_args['email_id'] == 'test@example.com'
            assert insert_call_args['account_type'] == 'savings'
            assert insert_call_args['balance'] == 100
            assert insert_call_args['currency'] == 'USD'
            assert insert_call_args['created_at'] == mock_datetime

def test_duplicate_account(valid_event, mock_mongodb_client):
    # Arrange
    mock_client, mock_collection = mock_mongodb_client
    mock_collection.count_documents.return_value = 1
    
    # Act
    response = handler(valid_event, {})
    
    # Assert
    assert response['statusCode'] == 400
    response_body = json.loads(response['body'])
    assert response_body['success'] is False
    assert response_body['message'] == 'Account already exists'
    mock_collection.insert_one.assert_not_called()

def test_invalid_request_body():
    # Arrange
    invalid_event = {
        'body': 'invalid json'
    }
    
    # Act
    response = handler(invalid_event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert response_body['success'] is False
    assert 'error' in response_body

def test_missing_required_fields(mock_mongodb_client):
    # Arrange
    mock_client, mock_collection = mock_mongodb_client
    incomplete_event = {
        'body': json.dumps({
            'email_id': 'test@example.com',
            # missing other required fields
        })
    }
    
    # Act
    response = handler(incomplete_event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert response_body['success'] is False
    assert 'error' in response_body

def test_mongodb_connection_error():
    # Arrange
    with patch('create_account.get_mongodb_client') as mock_get_client:
        mock_get_client.side_effect = Exception('Connection error')
        
        # Act
        response = handler({'body': '{}'}, {})
        
        # Assert
        assert response['statusCode'] == 500
        response_body = json.loads(response['body'])
        assert response_body['success'] is False
        assert 'error' in response_body

def test_generate_account_number():
    # Act
    account_number = generate_account_number()
    
    # Assert
    assert account_number.startswith('IBAN')
    assert len(account_number) == 20  # 'IBAN' + 16 digits
    assert account_number[4:].isdigit()

def test_environment_variables():
    # Act
    from create_account import get_mongodb_client
    
    # Assert
    assert os.environ.get('DB_URL') == 'mongodb://testdb:27017'