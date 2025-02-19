from locust import HttpUser, task, SequentialTaskSet, between
import os
from dotenv import load_dotenv 

load_dotenv()


class AtmUser(HttpUser):
    host = os.getenv("ATM_URL")

    @task
    class AtmUserTasks(SequentialTaskSet):
        wait_time = between(2, 3)

        @task
        def get_all_atms(self):
            response = self.client.post("/")
            self.atm_data = response.json()

        @task
        def get_atm_details(self):
            for atm in self.atm_data:
                self.client.get(f"/{atm['_id']}")
