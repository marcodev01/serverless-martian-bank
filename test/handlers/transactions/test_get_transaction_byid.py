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

from get_transaction_by_id import handler

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {'MONGODB_URI': 'mongodb://testdb:27017'}):
        yield

@pytest.fixture
def sample_transaction():
    return {
        "_id": ObjectId(),
        "receiver": "1234567890",
        "amount": 100.50,
        "reason": "Test transfer",
        "time_stamp": datetime.now(),
        "type": "credit"
    }

@pytest.fixture
def mock_mongodb(mocker):
    mock_collection = MagicMock()
    mock_db = MagicMock()
    mock_client = MagicMock()
    
    # Setup MongoDB mock returns
    mock_db.__getitem__.return_value = mock_collection
    mock_client.__getitem__.return_value = mock_db
    
    with patch('get_transaction_by_id.MongoClient', return_value=mock_client) as mock:
        yield mock_client, mock_collection

def test_successful_transaction_retrieval(mock_mongodb, sample_transaction):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find_one.return_value = sample_transaction
    
    event = {
        'body': json.dumps({
            'transaction_id': str(sample_transaction['_id'])
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    
    assert response_body['account_number'] == sample_transaction['receiver']
    assert response_body['amount'] == sample_transaction['amount']
    assert response_body['reason'] == sample_transaction['reason']
    assert 'time_stamp' in response_body
    assert response_body['type'] == 'credit'
    assert response_body['transaction_id'] == str(sample_transaction['_id'])
    
    # Verify MongoDB query
    mock_collection.find_one.assert_called_once_with(
        {"_id": ObjectId(str(sample_transaction['_id']))}
    )

def test_transaction_not_found(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.find_one.return_value = None
    
    event = {
        'body': json.dumps({
            'transaction_id': str(ObjectId())
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 404
    assert response['body'] == '{}'

def test_invalid_transaction_id(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    
    event = {
        'body': json.dumps({
            'transaction_id': 'invalid_id'
        })
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_invalid_request_body():
    # Arrange
    event = {
        'body': 'invalid json'
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_missing_transaction_id():
    # Arrange
    event = {
        'body': json.dumps({})  # Missing transaction_id
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body

def test_mongodb_connection_error():
    # Arrange
    with patch('get_transaction_by_id.MongoClient') as mock_client:
        mock_client.side_effect = Exception('MongoDB connection error')
        
        event = {
            'body': json.dumps({
                'transaction_id': str(ObjectId())
            })
        }
        
        # Act
        response = handler(event, {})
        
        # Assert
        assert response['statusCode'] == 500
        response_body = json.loads(response['body'])
        assert 'error' in response_body
        assert 'MongoDB connection error' in str(response_body['error'])