import os
import sys
import pytest
import json
from unittest.mock import MagicMock, patch
from bson import ObjectId
from datetime import datetime

# Pfad zur Lambda-Funktion
current_dir = os.path.dirname(os.path.abspath(__file__))
lambda_path = os.path.join(current_dir, '../../../domains/loans/application/handlers')
sys.path.append(lambda_path)

from get_loan_history import handler

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {'DB_URL': 'mongodb://testdb:27017'}):
        yield

@pytest.fixture
def mock_loan_data():
    return {
        "_id": ObjectId(),
        "name": "Max Mustermann",
        "email": "max@example.com",
        "account_type": "Savings",
        "account_number": "1234567890",
        "govt_id_type": "ID Card",
        "govt_id_number": "AB123456",
        "loan_type": "Personal",
        "loan_amount": 10000,
        "interest_rate": 5.5,
        "time_period": 12,
        "status": "Active",
        "timestamp": datetime.now()
    }

@pytest.fixture
def mock_mongodb(mocker):
    mock_collection = MagicMock()
    mock_db = MagicMock()
    mock_client = MagicMock()
    
    mock_db.__getitem__.return_value = mock_collection
    mock_client.__getitem__.return_value = mock_db
    
    with patch('get_loan_history.get_mongodb_client', return_value=mock_client):
        yield mock_client, mock_collection

def test_successful_loan_history_retrieval(mock_mongodb, mock_loan_data):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find.return_value = [mock_loan_data]
    
    event = {
        'body': json.dumps({"email": "max@example.com"})
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    assert len(response_body) == 1
    assert response_body[0]['email'] == "max@example.com"
    assert response_body[0]['name'] == "Max Mustermann"
    assert 'timestamp' in response_body[0]
    
    # Verify MongoDB query
    mock_collection.find.assert_called_once_with({"email": "max@example.com"})

def test_empty_loan_history(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find.return_value = []
    
    event = {
        'body': json.dumps({"email": "nobody@example.com"})
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    assert len(response_body) == 0

def test_invalid_request_body(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    event = {
        'body': 'invalid json'
    }
    
    # Act
    with patch('get_loan_history.get_mongodb_client') as mock_get_client:
        response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_missing_email_field(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    event = {
        'body': json.dumps({})  # Fehlendes email-Feld
    }
    
    # Act
    with patch('get_loan_history.get_mongodb_client') as mock_get_client:
        response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_mongodb_connection_error():
    # Arrange
    with patch('get_loan_history.get_mongodb_client') as mock_get_client:
        mock_get_client.side_effect = Exception('MongoDB connection error')
        
        event = {
            'body': json.dumps({
                'email': 'max@example.com'
            })
        }
        
        # Act
        response = handler(event, {})
        
        # Assert
        assert response['statusCode'] == 500
        response_body = json.loads(response['body'])
        assert 'error' in response_body
        assert 'MongoDB connection error' in response_body['error']