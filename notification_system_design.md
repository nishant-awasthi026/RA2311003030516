# Notification System Design

## Stage 1
### REST API Design
The platform needs to support fetching notifications (real-time and historical) and marking them as read.

**1. Fetch Notifications**
- **Endpoint**: `GET /api/v1/notifications`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Query Params**: `?unreadOnly=true&limit=50&offset=0`
- **Response**:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "Placement",
      "message": "CSX Corporation hiring",
      "isRead": false,
      "timestamp": "2026-04-22T17:51:18Z"
    }
  ],
  "meta": { "total": 1, "unreadCount": 1 }
}
```

**2. Mark as Read**
- **Endpoint**: `PATCH /api/v1/notifications/:id/read`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

### Real-time Mechanism
To push notifications in real-time to logged-in users, I propose using **WebSockets** (e.g., via Socket.io) or **Server-Sent Events (SSE)**. SSE is a good fit since notifications flow unidirectionally from server to client. For bidirectional tracking (e.g., immediate read-receipts), WebSockets are preferred.

## Stage 2
### Database Storage
I suggest a **NoSQL database like MongoDB** or a wide-column store like **Cassandra** for storing notifications. 
**Why?**
1. Notifications are essentially log data that scales massively.
2. We rarely update old notifications (mostly append-only, except for `isRead`).
3. NoSQL handles high write-throughput better than traditional RDBMS.

**Schema (MongoDB)**
```json
{
  "_id": "ObjectId",
  "studentId": "String (Index)",
  "type": "String (Enum: Placement, Result, Event)",
  "message": "String",
  "isRead": "Boolean",
  "createdAt": "Date (Index, Descending)"
}
```

**Scalability Problems & Solutions**
- **Problem**: Table sizes grow exponentially, making queries slow.
- **Solution**: Time-based partitioning/sharding (e.g., archive notifications older than 6 months).
- **Problem**: Counting unread notifications becomes expensive.
- **Solution**: Maintain an `unreadCount` integer in the `Students` table and increment/decrement it, avoiding a `COUNT()` query on the massive notifications table.

## Stage 3
### SQL Query Analysis
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```
- **Is this accurate?** Yes, it functionally returns unread notifications.
- **Why is it slow?** Without a composite index, the database must scan millions of rows, filter them, and sort them in memory.
- **Would indexing every column help?** No. Indexing every column increases the cost of `INSERT`/`UPDATE` operations and wastes disk space. Indexes should be targeted.
- **What to change?** Add a Composite Index on `(studentID, isRead, createdAt DESC)`.

**Query for Placement in last 7 days:**
```sql
SELECT DISTINCT studentID 
FROM notifications
WHERE notificationType = 'Placement' 
  AND createdAt >= NOW() - INTERVAL 7 DAY;
```
*(Requires a composite index on `(notificationType, createdAt)`)*

## Stage 4
### Performance Improvements
Fetching notifications on every page load overwhelms the database.
**Suggested Solutions:**
1. **Caching (Redis)**: Store the latest 50 notifications and the unread count in Redis for active users. The DB is only queried on cache-miss.
   - *Tradeoff*: Memory cost, requires cache invalidation logic when new notifications arrive.
2. **WebSockets / SSE (Push instead of Pull)**: Instead of the client polling or fetching on every load, the client maintains a WebSocket connection. The server pushes the notification state upon connection and pushes new ones as they arrive.
   - *Tradeoff*: High number of concurrent connections to the server, requires scaling WebSocket servers (e.g., using Redis Pub/Sub).

## Stage 5
### Bulk Notification Redesign
**Shortcomings of the pseudocode:**
1. **Synchronous loop**: Processing 50,000 users sequentially in a loop will take too long and block the thread.
2. **Lack of fault tolerance**: If `send_email` fails midway (as it did for 200 students), the loop might crash or skip the remaining users. There is no retry mechanism.
3. **Tight Coupling**: DB insert, email, and push happen synchronously.

**Redesign Approach (Asynchronous Message Queues):**
No, DB insert and email should NOT happen synchronously together. Email sending is an external network call, which is slow and failure-prone. DB inserts are internal and fast. They should be decoupled using an Event-Driven Architecture (e.g., RabbitMQ, Kafka, or AWS SQS).

**Revised Pseudocode:**
```python
function notify_all(student_ids: array, message: string):
    # Step 1: Bulk insert into DB (Fast)
    bulk_save_to_db(student_ids, message)
    
    # Step 2: Publish events to message queues (Fast)
    for student_id in student_ids:
        publish_to_queue("email_queue", { student_id, message })
        publish_to_queue("push_queue", { student_id, message })

# Worker processes independently consume the queues
function process_email_queue(job):
    try:
        send_email(job.student_id, job.message)
    except Exception:
        # Automatically requeue for retry with exponential backoff
        job.retry()
```

## Stage 6
### Priority Inbox
The Priority Inbox has been implemented in Node.js (Express) under the `notification_app_be` directory. 
- It fetches notifications from the API.
- Applies a Weight Map (`Placement: 3`, `Result: 2`, `Event: 1`).
- Sorts first by Weight (Descending) and then by Timestamp (Descending) for recency.
- Extracts and returns the Top 10.

**Maintaining Top 10 efficiently with incoming notifications:**
In a production system, instead of fetching and sorting the entire history every time, we should:
1. Maintain a **Sorted Set in Redis** (`ZSET`) for each user's inbox.
2. The score for each item in the ZSET can be calculated as a composite float: `(Weight * 10000000000) + UnixTimestamp`.
3. When a new notification arrives, we just add it to the ZSET.
4. To get the Top 10, we simply run `ZREVRANGE user_inbox 0 9`. This operates in `O(log(N))` time.
