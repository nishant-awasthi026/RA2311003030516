require('dotenv').config({ path: '../.env' });
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../logging_middleware/index');

const app = express();
app.use(logger);

const API_BASE_URL = process.env.API_BASE_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

async function fetchDepots() {
    try {
        const response = await axios.get(`${API_BASE_URL}/depots`, {
            headers: { 'client-id': CLIENT_ID, 'client-secret': CLIENT_SECRET }
        });
        return response.data.depots;
    } catch (error) {
        process.stdout.write(`Failed to fetch depots: ${error.message}\n`);
        throw new Error('API failed to fetch depots: ' + error.message);
    }
}

async function fetchVehicles() {
    try {
        const response = await axios.get(`${API_BASE_URL}/vehicles`, {
            headers: { 'client-id': CLIENT_ID, 'client-secret': CLIENT_SECRET }
        });
        return response.data.vehicles;
    } catch (error) {
        process.stdout.write(`Failed to fetch vehicles: ${error.message}\n`);
        throw new Error('API failed to fetch vehicles: ' + error.message);
    }
}

app.get('/schedule', async (req, res) => {
    try {
        const depots = await fetchDepots();
        const vehicles = await fetchVehicles();

// multi knapsack greedy 
// 1. primary sort then secondary sort
    const tasks = [...vehicles].sort((a, b) => {
        const ratioA = a.Impact / a.Duration;
        const ratioB = b.Impact / b.Duration;
        if (ratioB !== ratioA) return ratioB - ratioA;
        return b.Impact - a.Impact;
    });

    const depotCapacities = depots.map(d => ({ ...d, UsedHours: 0, AssignedTasks: [] }));
    let totalImpact = 0;
    let totalAssignedHours = 0;
    const selectedTasks = [];

// 2. assign task → depot w/ max free cap
    for (const task of tasks) {
        let bestDepot = null;
        let maxRemaining = -1;

        for (const depot of depotCapacities) {
            const remaining = depot.MechanicHours - depot.UsedHours;
            if (remaining >= task.Duration && remaining > maxRemaining) {
                maxRemaining = remaining;
                bestDepot = depot;
            }
        }

        if (bestDepot) {
            bestDepot.UsedHours += task.Duration;
            bestDepot.AssignedTasks.push(task);
            selectedTasks.push(task);
            totalImpact += task.Impact;
            totalAssignedHours += task.Duration;
        }
    }

    const output = {
        summary: {
            totalSelectedTasks: selectedTasks.length,
            totalImpactScore: totalImpact,
            totalAssignedHours: totalAssignedHours,
            totalAvailableHours: depots.reduce((sum, d) => sum + d.MechanicHours, 0)
        },
        depots: depotCapacities.map(d => ({
            depotID: d.ID,
            assignedHours: d.UsedHours,
            totalHours: d.MechanicHours,
            assignedTasksCount: d.AssignedTasks.length
        }))
    };

    res.json(output);
    } catch (error) {
        res.status(500).json({ error: "Failed to schedule maintenance", message: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    process.stdout.write(`Vehicle Maintenance Scheduler Microservice is running on port ${PORT}\n`);
});
