# Campus Hiring Evaluation - Backend Track

This repository contains the backend microservices developed for the Campus Hiring Evaluation. It includes solutions for the Vehicle Maintenance Scheduler (Multiple Knapsack Problem), Priority Notification Inbox, and a custom Logging Middleware.

## Repository Structure

- `vehicle_maintenance_scheduler/` - Express microservice that assigns vehicle maintenance tasks to depots using a greedy heuristic (Impact/Duration).
- `notification_app_be/` - Express microservice that sorts incoming notifications by Priority (Placement > Result > Event) and recency.
- `logging_middleware/` - Custom Express middleware that records HTTP request metrics (method, URL, status code, duration) to an `app.log` file without relying on built-in logging libraries.
- `notification_system_design.md` - System design documentation covering REST API contracts, database schemas, scaling strategies, and bulk notification logic (Stages 1-6).

## Environment Setup

Before running the microservices, ensure you have a `.env` file in the root of the project with your valid API credentials.

```env
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
API_BASE_URL=your_api_base_url
EMAIL=your_registered_email
NAME=your_name
ROLL_NO=your_roll_no
ACCESS_CODE=your_access_code
```
*(Note: The microservices are designed to securely exchange these credentials for a temporary Bearer token via the `/auth` API).*

## Installation

Install the required dependencies using NPM:

```bash
npm install
```

## Running the Microservices

The microservices can be run independently. They utilize `dotenv` with an absolute path resolution to guarantee they load the root `.env` file correctly, regardless of your current working directory.

### 1. Vehicle Maintenance Scheduler
Runs on port `3000`.

```bash
node vehicle_maintenance_scheduler/index.js
```
- **Test the Endpoint**: Send a `GET` request to `http://localhost:3000/schedule`

### 2. Priority Inbox
Runs on port `3001`.

```bash
node notification_app_be/index.js
```
- **Test the Endpoint**: Send a `GET` request to `http://localhost:3001/priority-inbox`

## Logging

All incoming HTTP requests to either microservice are intercepted by the custom logging middleware. The logs are appended manually to the `app.log` file located in the root of the project.

**Sample `app.log` Output:**
```text
[2026-05-02T07:07:05.092Z] GET /schedule 200 - 205ms
[2026-05-02T07:07:05.546Z] GET /priority-inbox 200 - 165ms
```

## Output Screenshots

### Vehicle Maintenance Scheduler Output
![Vehicle Scheduler Output](./Screenshot%202026-05-02%20123808.png)

### Priority Inbox Output
![Priority Inbox Output](./Screenshot%202026-05-02%20123827.png)
