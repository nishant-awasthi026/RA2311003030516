require('dotenv').config({ path: '../.env' });
const express = require('express');
const axios = require('axios');
const logger = require('../logging_middleware/index');

const app = express();
app.use(logger);

const API_BASE_URL = process.env.API_BASE_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

app.get('/priority-inbox', async (req, res) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/notifications`, {
            headers: { 'client-id': CLIENT_ID, 'client-secret': CLIENT_SECRET }
        });
        
        let notifications = response.data.notifications;

        // Weight mapping: Placement > Result > Event
        const weightMap = {
            'Placement': 3,
            'Result': 2,
            'Event': 1
        };

        // Sort by Weight descending, then Timestamp descending (recency)
        notifications.sort((a, b) => {
            const weightA = weightMap[a.Type] || 0;
            const weightB = weightMap[b.Type] || 0;

            if (weightA !== weightB) {
                return weightB - weightA; // higher weight comes first
            }

            // If weights are same, sort by Timestamp descending (more recent comes first)
            const timeA = new Date(a.Timestamp).getTime();
            const timeB = new Date(b.Timestamp).getTime();
            return timeB - timeA;
        });

        // Slice top 10
        const top10 = notifications.slice(0, 10);

        res.json({ topNotifications: top10 });
    } catch (error) {
        process.stdout.write(`API Error: ${error.message}\n`);
        res.status(500).json({ error: "Failed to fetch priority notifications", message: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    process.stdout.write(`Notification App Microservice running on port ${PORT}\n`);
});
