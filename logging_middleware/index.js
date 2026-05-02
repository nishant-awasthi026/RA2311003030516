const fs = require('fs');
const path = require('path');

// Ensure the log file is saved in the root of the project
const logFilePath = path.join(__dirname, '..', 'app.log');

const loggingMiddleware = (req, res, next) => {
    const start = Date.now();
    const method = req.method;
    const url = req.url;
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const timestamp = new Date().toISOString();
        
        const logEntry = `[${timestamp}] ${method} ${url} ${status} - ${duration}ms\n`;
        
        // Appending directly to a file, avoiding built-in loggers or console.log
        fs.appendFile(logFilePath, logEntry, (err) => {
            if (err) {
                process.stdout.write(`Failed to write to log file: ${err.message}\n`);
            }
        });
    });

    next();
};

module.exports = loggingMiddleware;
