import fs from 'fs';
import path from 'path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
const server = new McpServer({
    name: 'budget-mcp',
    version: '1.0.0',
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});
server.registerTool('create-user', {
    title: 'Create a new user',
    description: 'Create a new user with the given name, email, address, and phone number',
    inputSchema: {
        name: z.string(),
        email: z.string().email(),
        address: z.string(),
        phone: z.string(),
    },
}, async (args) => {
    try {
        const id = await createUser(args);
        return {
            content: [
                {
                    type: 'text',
                    text: `User ${id} created with email.`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error creating user: ${error}`,
                },
            ],
        };
    }
});
function createUser(args: {
  name: string;
  email: string;
  address: string;
  phone: string;
}) {
  const usersPath = path.join(__dirname, '../data/users.json');
  
  // Read existing users
  let users = [];
  try {
    const usersData = fs.readFileSync(usersPath, 'utf8');
    users = JSON.parse(usersData);
  } catch (error) {
    // File doesn't exist or is empty, start with empty array
    users = [];
  }
  
  const id = users.length + 1;
  users.push({
    ...args,
    id,
  });

  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

  return id;
}
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
