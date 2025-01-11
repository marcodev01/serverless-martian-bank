import os
import sys
import pytest
import json
from decimal import Decimal
from unittest.mock import MagicMock, patch

# Fügen Sie die Pfade für Lambda und Layers hinzu
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(current_dir, '../../..')
lambda_path = os.path.join(project_root, 'domains/accounts/application/handlers')
layers_path = os.path.join(project_root, 'lib/layers/python')

sys.path.append(lambda_path)
sys.path.append(layers_path)

from events.transaction_completed import TransactionCompletedEvent
from events.loan_granted import LoanGrantedEvent
from update_balance import handler

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {'DB_URL': 'mongodb://testdb:27017'}):
        yield

@pytest.fixture
def mock_mongodb(mocker):
    mock_collection = MagicMock()
    mock_db = MagicMock()
    mock_client = MagicMock()
    
    mock_db.__getitem__.return_value = mock_collection
    mock_client.__getitem__.return_value = mock_db
    
    with patch('update_balance.MongoClient', return_value=mock_client):
        yield mock_client, mock_collection

@pytest.fixture
def transaction_event():
    detail_data = {
        "fromAccount": "IBAN1234567890123456",
        "toAccount": "IBAN9876543210987654",
        "amount": 100.50,
        "reason": "test transaction"
    }
    return {
        'source': TransactionCompletedEvent.SOURCE,
        'detail-type': TransactionCompletedEvent.TYPE,
        'Detail': json.dumps(detail_data)
    }

@pytest.fixture
def loan_event():
    detail_data = {
        "accountNumber": "IBAN1234567890123456",
        "amount": 1000.00
    }
    return {
        'source': LoanGrantedEvent.SOURCE,
        'detail-type': LoanGrantedEvent.TYPE,
        'Detail': json.dumps(detail_data)
    }

def test_successful_transaction_update(mock_mongodb, transaction_event):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.update_one.return_value.modified_count = 1
    
    # Act
    response = handler(transaction_event, {})
    
    # Assert
    assert response['statusCode'] == 200
    
    # Verify MongoDB calls
    assert mock_collection.update_one.call_count == 2
    
    # Verify sender update
    mock_collection.update_one.assert_any_call(
        {"account_number": "IBAN1234567890123456"},
        {"$inc": {"balance": -100.50}}
    )
    
    # Verify receiver update
    mock_collection.update_one.assert_any_call(
        {"account_number": "IBAN9876543210987654"},
        {"$inc": {"balance": 100.50}}
    )

def test_failed_sender_update(mock_mongodb, transaction_event):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.update_one.return_value.modified_count = 0
    
    # Act
    response = handler(transaction_event, {})
    
    # Assert
    assert response['statusCode'] == 500

def test_successful_loan_update(mock_mongodb, loan_event):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.update_one.return_value.modified_count = 1
    
    # Act
    response = handler(loan_event, {})
    
    # Assert
    assert response['statusCode'] == 200
    mock_collection.update_one.assert_called_once_with(
        {"account_number": "IBAN1234567890123456"},
        {"$inc": {"balance": 1000.00}}
    )

def test_failed_loan_update(mock_mongodb, loan_event):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    mock_collection.update_one.return_value.modified_count = 0
    
    # Act
    response = handler(loan_event, {})
    
    # Assert
    assert response['statusCode'] == 500

def test_unknown_event_source(mock_mongodb):
    # Arrange
    mock_client, mock_collection = mock_mongodb
    event = {
        'source': 'unknown.source',
        'detail-type': 'UnknownEvent',
        'Detail': json.dumps({})
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    mock_collection.update_one.assert_not_called()

def test_mongodb_connection_error(transaction_event):
    # Arrange
    with patch('update_balance.get_mongodb_client') as mock_get_client:
        mock_get_client.side_effect = Exception('Connection error')
        
        # Act
        response = handler(transaction_event, {})
        
        # Assert
        assert response['statusCode'] == 500