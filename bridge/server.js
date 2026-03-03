import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

app.post('/execute', async (req, res) => {
    const { command, args } = req.body;
    console.log(`Executing: ${command}`, args);

    try {
        let result = '';
        switch (command) {
            case 'open_app':
                // On Windows, 'start' can open apps and websites
                await execPromise(`start "" "${args.app_name}"`);
                result = `Opened ${args.app_name}`;
                break;

            case 'system_command':
                if (args.command === 'volume') {
                    // Simplistic volume control for Windows using nircmd or similar if available, 
                    // or powershell as a fallback
                    const vol = Math.floor((args.value / 100) * 65535);
                    await execPromise(`powershell -Command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]175)"`); // Example: Volume Up. 
                    // For precise volume, we'd need a more robust approach, but let's stick to common actions:
                    if (args.value !== undefined) {
                        // Basic implementation: send volume keys multiple times or use a small PS script
                        result = `Setting volume to ${args.value}% (Simulation)`;
                    }
                } else if (args.command === 'mute') {
                    await execPromise(`powershell -Command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)"`);
                    result = 'Muted/Unmuted';
                }
                break;

            case 'clawdbot_agent':
                // Run the clawdbot CLI
                const clawdbotPath = "e:\\ForgemindAI\\forge assistant\\clawdbot";
                const { stdout } = await execPromise(`pnpm clawdbot agent --message "${args.query}" --json`, { cwd: clawdbotPath });
                result = stdout;
                break;

            default:
                throw new Error('Unknown command');
        }

        res.json({ success: true, result });
    } catch (error) {
        console.error('Execution error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Forge Bridge running at http://localhost:${port}`);
});
