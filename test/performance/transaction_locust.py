from locust import HttpUser, task, SequentialTaskSet, between
import random
from faker import Faker
import os
from dotenv import load_dotenv 

load_dotenv()

fake = Faker()


class TransactionUser(HttpUser):
    host = os.getenv("TRANSFER_URL")

    @task
    class TransactionUserTasks(SequentialTaskSet):
        wait_time = between(2, 3)

        def on_start(self):
            accounts_host = os.getenv("ACCOUNTS_URL")

            ##### FIRST USER #####

            # Create fake checking account data
            self.first_user = {
                "name": fake.unique.name(),
                "email_id": fake.unique.email(),
                "account_type": "Checking",
                "government_id_type": random.choice(
                    ["Driver's License", "Passport", "SSN"]
                ),
                "govt_id_number": fake.unique.ssn(),
                "address": fake.unique.address(),
            }
            self.client.post(
                f"{accounts_host}/create",
                data=self.first_user,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            # Create another fake account
            self.first_user["account_type"] = random.choice(
                ["Savings", "Money Market", "Investment"]
            )
            self.client.post(
                f"{accounts_host}/create",
                data=self.first_user,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            # Get all accounts
            response = self.client.post(
                f"{accounts_host}/allaccounts",
                data={"email_id": self.first_user["email_id"]},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            self.account_numbers = [
                account["account_number"] for account in response.json()["response"]
            ]

            ##### SECOND USER #####

            self.second_user = {
                "name": fake.unique.name(),
                "email_id": fake.unique.email(),
                "account_type": "Checking",
                "government_id_type": random.choice(
                    ["Driver's License", "Passport", "SSN"]
                ),
                "govt_id_number": fake.unique.ssn(),
                "address": fake.unique.address(),
            }
            self.client.post(
                f"{accounts_host}/create",
                data=self.second_user,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        @task(1)
        def internal_transfer(self):
            self.client.post(
                f"/",
                data={
                    "sender_account_number": self.account_numbers[0],
                    "receiver_account_number": self.account_numbers[1],
                    "amount": fake.random_int(min=1, max=3),
                    "reason": "Internal Transfer",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        @task(1)
        def external_transfer(self):
            self.client.post(
                f"/zelle/",
                data={
                    "sender_email": self.first_user["email_id"],
                    "receiver_email": self.second_user["email_id"],
                    "amount": fake.random_int(min=1, max=3),
                    "reason": "External Transfer",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        @task(3)
        def transaction_history(self):
            self.client.post(
                f"/history",
                data={"account_number": self.account_numbers[0]},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
