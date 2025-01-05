import json
from decimal import Decimal

class LoanGrantedEvent:
    SOURCE = 'martian-bank.loans'
    TYPE = 'loan.granted'
    
    def __init__(self, account_number: str, amount: Decimal):
        self.account_number = account_number
        self.amount = amount
    
    def to_eventbridge(self) -> dict:
        return {
            'Source': self.SOURCE,
            'DetailType': self.TYPE,
            'Detail': json.dumps({
                'accountNumber': self.account_number,
                'amount': float(self.amount)
            })
        }
        
    @classmethod
    def from_eventbridge(cls, event: dict) -> 'LoanGrantedEvent':
        detail = json.loads(event['Detail'])
        return cls(
            account_number=detail['accountNumber'],
            amount=Decimal(str(detail['amount']))
        )