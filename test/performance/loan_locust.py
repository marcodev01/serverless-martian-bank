from locust import HttpUser, task, SequentialTaskSet, between
import random
from faker import Faker
import os
from dotenv import load_dotenv 

load_dotenv()

fake = Faker()


class LoanUser(HttpUser):
    host = os.getenv("LOAN_URL")

    @task
    class LoanUserTasks(SequentialTaskSet):
        wait_time = between(2, 3)

        def on_start(self):
            account_host = os.getenv("ACCOUNTS_URL")
            # Create fake account data
            self.user_data = {
                "name": fake.unique.name(),
                "email_id": fake.unique.email(),
                "account_type": random.choice(
                    ["Checking", "Savings", "Money Market", "Investment"]
                ),
                "government_id_type": random.choice(
                    ["Driver's License", "Passport", "SSN"]
                ),
                "govt_id_number": fake.unique.ssn(),
                "address": fake.unique.address(),
            }

            # Create a new account
            self.client.post(
                f"{account_host}/create",
                json=self.user_data,
                headers={"Content-Type": "application/json"},
            )

            # Get all accounts
            response = self.client.post(
                f"{account_host}/allaccounts",
                json={"email_id": self.user_data["email_id"]},
                headers={"Content-Type": "application/json"},
            )
            self.account_number = response.json()["response"][0]["account_number"]

        @task(1)
        def apply(self):
            self.user_data["email"] = self.user_data["email_id"]
            self.user_data["govt_id_type"] = self.user_data["government_id_type"]
            self.user_data["account_number"] = self.account_number
            self.user_data["interest_rate"] = random.randint(1, 10)
            self.user_data["time_period"] = random.randint(1, 10)
            self.user_data["loan_amount"] = random.randint(1000, 10000)
            self.user_data["loan_type"] = random.choice(
                ["Base Camp", "Rover", "Potato Farming", "Ice Home", "Rocker"]
            )
            self.client.post(
                "/process",
                json=self.user_data,
                headers={"Content-Type": "application/json"},
            )

        @task(2)
        def history(self):
            self.client.post(
                "/history",
                json={"email": self.user_data["email_id"]},
                headers={"Content-Type": "application/json"},
            )
