import * as fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';


const SOURCE_FOLDER = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({path: `${path.dirname(fileURLToPath(import.meta.url))}/.env`});

export const logToFile = (message) => {
    const logEntry = `${message}\n`;
    const fileName= process.env.LOG_PATH || (SOURCE_FOLDER + "radius_mcp_app.log")

    fs.appendFile(fileName, logEntry, (err) => {
        if (err) {
            console.error('Failed to write to log file:', err);
        }
    });
    if (process.env.LOG_TO_CONSOLE === 'true') {
        console.log(message);
    }
};
