import json
from decimal import Decimal

class TransactionCompletedEvent:
    SOURCE = 'martian-bank.transactions'
    TYPE = 'transaction.completed'
    
    def __init__(self, from_account: str, to_account: str, amount: Decimal, reason: str):
        self.from_account = from_account
        self.to_account = to_account
        self.amount = amount
        self.reason = reason
    
    def to_eventbridge(self) -> dict:
        return {
            'Source': self.SOURCE,
            'DetailType': self.TYPE,
            'Detail': json.dumps({
                'fromAccount': self.from_account,
                'toAccount': self.to_account,
                'amount': float(self.amount),
                'reason': self.reason
            })
        }
        
    @classmethod
    def from_eventbridge(cls, event: dict) -> 'TransactionCompletedEvent':
        detail = json.loads(event['Detail'])
        return cls(
            from_account=detail['fromAccount'],
            to_account=detail['toAccount'],
            amount=Decimal(str(detail['amount'])),
            reason=detail['reason']
        )