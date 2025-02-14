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
lambda_path = os.path.join(project_root, 'domains/loans/application/handlers')
events_path = os.path.join(project_root, 'lib/layers/python')  
sys.path.extend([lambda_path, events_path])

# Mock for LoanGrantedEvent
class MockLoanGrantedEvent:
    def __init__(self, account_number, amount):
        self.account_number = account_number
        self.amount = amount

    def to_eventbridge(self):
        return {
            'Source': 'martian-bank',
            'DetailType': 'LoanGranted',
            'Detail': json.dumps({
                'account_number': self.account_number,
                'amount': str(self.amount)
            })
        }

sys.modules['events.loan_granted'] = MagicMock()
sys.modules['events.loan_granted'].LoanGrantedEvent = MockLoanGrantedEvent

from process_loan import handler

@pytest.fixture(autouse=True)
def mock_env_vars():
    with patch.dict('os.environ', {
        'DB_URL': 'mongodb://testdb:27017',
        'EVENT_BUS_NAME': 'test-event-bus'
    }):
        yield

@pytest.fixture
def sample_loan_request():
    return {
        "name": "Max Mustermann",
        "email": "max@example.com",
        "govt_id_type": "ID Card",
        "govt_id_number": "AB123456",
        "loan_type": "Personal",
        "loan_amount": "10000",
        "interest_rate": "5.5",
        "time_period": 12
    }

@pytest.fixture
def sample_account():
    return {
        "account_type": "Savings",
        "account_number": "1234567890"
    }

@pytest.fixture
def mock_mongodb(mocker):
    mock_collection_loans = MagicMock()
    mock_db = MagicMock()
    mock_client = MagicMock()
    
    mock_db.__getitem__.side_effect = lambda x: {
        "loans": mock_collection_loans
    }[x]
    mock_client.__getitem__.return_value = mock_db
    
    with patch('process_loan.get_mongodb_client', return_value=mock_client):
        yield mock_client, mock_collection_loans

@pytest.fixture
def mock_eventbridge():
    with patch('boto3.client') as mock_boto3:
        mock_events = MagicMock()
        mock_boto3.return_value = mock_events
        yield mock_events

def test_successful_loan_processing(mock_mongodb, mock_eventbridge, sample_loan_request, sample_account):
    # Arrange
    mock_client, mock_loans = mock_mongodb
    inserted_id = ObjectId()
    mock_loans.insert_one.return_value = MagicMock(inserted_id=inserted_id)
    
    event = {
        'body': json.dumps(sample_loan_request),
        'accountDetails': sample_account
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    assert response_body['approved'] is True
    assert response_body['loanId'] == str(inserted_id)
    
    mock_loans.insert_one.assert_called_once()
    mock_eventbridge.put_events.assert_called_once()

def test_invalid_loan_amount(mock_mongodb, sample_loan_request):
    # Arrange
    sample_loan_request["loan_amount"] = "0"
    event = {'body': json.dumps(sample_loan_request)}
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 400
    assert json.loads(response['body'])['message'] == "Invalid loan amount"

def test_account_not_found(mock_mongodb, sample_loan_request):
    # Arrange
    event = {'body': json.dumps(sample_loan_request)}
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 404
    assert json.loads(response['body'])['message'] == "Account details not found"

def test_eventbridge_failure(mock_mongodb, mock_eventbridge, sample_loan_request, sample_account):
    # Arrange
    mock_client, mock_loans = mock_mongodb
    inserted_id = ObjectId()
    mock_loans.insert_one.return_value = MagicMock(inserted_id=inserted_id)
    mock_eventbridge.put_events.side_effect = Exception("EventBridge error")
    
    event = {
        'body': json.dumps(sample_loan_request),
        'accountDetails': sample_account
    }
    
    # Act
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 500
    assert "EventBridge error" in json.loads(response['body'])['error']

def test_invalid_request_body(mock_mongodb):
    # Arrange
    event = {'body': 'invalid json'}
    # Act
    response = handler(event, {})
    # Assert
    assert response['statusCode'] == 500

def test_missing_required_fields(mock_mongodb):
    # Arrange
    event = {'body': json.dumps({"loan_amount": "1000"})}
    # Act
    response = handler(event, {})
    # Assert
    assert response['statusCode'] == 404
