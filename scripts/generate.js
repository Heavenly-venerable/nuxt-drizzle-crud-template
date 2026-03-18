import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import chalk from 'chalk';
import { execSync } from 'child_process';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  schemaPath: 'server/database/schema',
  modelsPath: 'server/models',
  servicesPath: 'server/services',
  controllersPath: 'server/controllers',
  apiPath: 'server/api',
  typesPath: 'types',
  middlewarePath: 'server/middleware',
  utilsPath: 'server/utils',
  zodPath: 'server/utils/validation',
  configPath: 'server/config'
};

// Helper functions
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function pluralize(str) {
  // Simple pluralization rules
  if (str.endsWith('y') && !str.endsWith('ay') && !str.endsWith('ey') && !str.endsWith('oy') && !str.endsWith('uy')) {
    return str.slice(0, -1) + 'ies';
  }
  if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
    return str + 'es';
  }
  return str + 's';
}

function singularize(str) {
  // Simple singularization rules
  if (str.endsWith('ies')) {
    return str.slice(0, -3) + 'y';
  }
  if (str.endsWith('es')) {
    return str.slice(0, -2);
  }
  if (str.endsWith('s') && !str.endsWith('ss')) {
    return str.slice(0, -1);
  }
  return str;
}

// Templates
const templates = {
  schema: (name, singularName, fields) => `import { pgTable, serial, varchar, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';

export const ${name} = pgTable('${name}', {
  id: serial('id').primaryKey(),
  ${fields.filter(f => f.name !== 'id').map(f => {
    let fieldDef = `${f.name}: `;

    switch (f.type) {
      case 'string':
        fieldDef += f.maxLength ? `varchar('${f.name}', { length: ${f.maxLength} })` : `text('${f.name}')`;
        break;
      case 'text':
        fieldDef += `text('${f.name}')`;
        break;
      case 'number':
        fieldDef += `integer('${f.name}')`;
        break;
      case 'boolean':
        fieldDef += `boolean('${f.name}')`;
        break;
      case 'json':
        fieldDef += `jsonb('${f.name}')`;
        break;
      case 'date':
        fieldDef += `timestamp('${f.name}')`;
        break;
      default:
        fieldDef += `text('${f.name}')`;
    }

    if (!f.nullable) fieldDef += '.notNull()';
    if (f.default !== undefined && f.default !== '') {
      if (typeof f.default === 'string') {
        fieldDef += `.default('${f.default}')`;
      } else if (typeof f.default === 'boolean') {
        fieldDef += `.default(${f.default})`;
      } else if (typeof f.default === 'number') {
        fieldDef += `.default(${f.default})`;
      }
    }
    if (f.unique) fieldDef += '.unique()';

    return fieldDef;
  }).join(',\n  ')}${fields.some(f => f.name === 'createdAt') ? '' : ',\n  createdAt: timestamp(\'created_at\').defaultNow()'}${fields.some(f => f.name === 'updatedAt') ? '' : ',\n  updatedAt: timestamp(\'updated_at\').defaultNow()'}
});

// Types
export type ${capitalize(singularName)} = typeof ${name}.$inferSelect;
export type New${capitalize(singularName)} = typeof ${name}.$inferInsert;
`,

  zodSchema: (name, singularName, fields) => `import { z } from 'zod';

// Base schema
export const ${singularName}Schema = z.object({
  ${fields.filter(f => f.name !== 'id' && f.name !== 'createdAt' && f.name !== 'updatedAt').map(f => {
    let zodType = '';

    switch (f.type) {
      case 'string':
        zodType = 'z.string()';
        if (f.maxLength) zodType += `.max(${f.maxLength}, 'Maximum ${f.maxLength} characters')`;
        if (f.minLength) zodType += `.min(${f.minLength}, 'Minimum ${f.minLength} characters')`;
        if (f.email) zodType += '.email()';
        if (f.regex) zodType += `.regex(/${f.regex}/)`;
        break;
      case 'text':
        zodType = 'z.string()';
        break;
      case 'number':
        zodType = 'z.number()';
        if (f.min !== undefined) zodType += `.min(${f.min})`;
        if (f.max !== undefined) zodType += `.max(${f.max})`;
        if (f.integer) zodType += '.int()';
        break;
      case 'boolean':
        zodType = 'z.boolean()';
        break;
      case 'date':
        zodType = 'z.date()';
        break;
      case 'json':
        zodType = 'z.record(z.unknown())';
        break;
      default:
        zodType = 'z.string()';
    }

    if (f.nullable) zodType += '.nullable()';
    if (f.default !== undefined && f.default !== '') {
      if (typeof f.default === 'string') {
        zodType += `.default('${f.default}')`;
      } else {
        zodType += `.default(${f.default})`;
      }
    } else if (f.nullable) {
      zodType += '.optional()';
    }

    return `${f.name}: ${zodType}`;
  }).join(',\n  ')}
});

// Create schema (omits id, createdAt, updatedAt)
export const create${capitalize(singularName)}Schema = ${singularName}Schema;

// Update schema (all fields optional)
export const update${capitalize(singularName)}Schema = ${singularName}Schema.partial();

// Types
export type ${capitalize(singularName)}Input = z.infer<typeof ${singularName}Schema>;
export type Create${capitalize(singularName)}Input = z.infer<typeof create${capitalize(singularName)}Schema>;
export type Update${capitalize(singularName)}Input = z.infer<typeof update${capitalize(singularName)}Schema>;
`,

  model: (name, singularName) => `import { eq } from 'drizzle-orm';
import { db } from '~/server/utils/db';
import { ${name}, type New${capitalize(singularName)}, type ${capitalize(singularName)} } from '~/server/database/schema/${name}';

export class ${capitalize(singularName)}Model {
  async findAll(): Promise<${capitalize(singularName)}[]> {
    try {
      return await db.select().from(${name});
    } catch (error) {
      console.error('Error fetching ${name}:', error);
      return [];
    }
  }

  async findById(id: number): Promise<${capitalize(singularName)} | undefined> {
    try {
      const result = await db.select().from(${name}).where(eq(${name}.id, id));
      return result[0];
    } catch (error) {
      console.error('Error finding ${singularName} by id:', error);
      return undefined;
    }
  }

  async create(data: New${capitalize(singularName)}): Promise<${capitalize(singularName)} | undefined> {
    try {
      const result = await db.insert(${name}).values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating ${singularName}:', error);
      return undefined;
    }
  }

  async update(id: number, data: Partial<New${capitalize(singularName)}>): Promise<${capitalize(singularName)} | undefined> {
    try {
      const result = await db.update(${name})
        .set({ ...data, updatedAt: new Date() })
        .where(eq(${name}.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating ${singularName}:', error);
      return undefined;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const result = await db.delete(${name}).where(eq(${name}.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting ${singularName}:', error);
      return false;
    }
  }

  async findOne(condition: Partial<${capitalize(singularName)}>): Promise<${capitalize(singularName)} | undefined> {
    try {
      // Simplified - in production you'd build dynamic where clause
      const all = await this.findAll();
      return all.find(item =>
        Object.entries(condition).every(([key, value]) => item[key as keyof ${capitalize(singularName)}] === value)
      );
    } catch (error) {
      console.error('Error finding ${singularName}:', error);
      return undefined;
    }
  }
}
`,

  service: (name, singularName) => `import { ${capitalize(singularName)}Model } from '~/server/models/${capitalize(singularName)}Model';
import type { New${capitalize(singularName)} } from '~/server/database/schema/${name}';
import { create${capitalize(singularName)}Schema, update${capitalize(singularName)}Schema } from '~/server/utils/validation/${singularName}Schema';
import type { Create${capitalize(singularName)}Input, Update${capitalize(singularName)}Input } from '~/server/utils/validation/${singularName}Schema';

export class ${capitalize(singularName)}Service {
  private model = new ${capitalize(singularName)}Model();

  async getAll() {
    try {
      const items = await this.model.findAll();
      return {
        success: true,
        data: items
      };
    } catch (error) {
      console.error('Error in getAll ${name}:', error);
      return {
        success: false,
        message: 'Failed to fetch ${name}'
      };
    }
  }

  async getById(id: number) {
    try {
      const item = await this.model.findById(id);

      if (!item) {
        return {
          success: false,
          message: '${capitalize(singularName)} not found'
        };
      }

      return {
        success: true,
        data: item
      };
    } catch (error) {
      console.error('Error in getById ${singularName}:', error);
      return {
        success: false,
        message: 'Failed to fetch ${singularName}'
      };
    }
  }

  async create(data: Create${capitalize(singularName)}Input) {
    try {
      // Validate with Zod
      const validated = create${capitalize(singularName)}Schema.parse(data);

      const newItem = await this.model.create(validated as New${capitalize(singularName)});

      if (!newItem) {
        return {
          success: false,
          message: 'Failed to create ${singularName}'
        };
      }

      return {
        success: true,
        data: newItem,
        message: '${capitalize(singularName)} created successfully'
      };
    } catch (error: any) {
      console.error('Error in create ${singularName}:', error);
      
      if (error.errors) {
        return {
          success: false,
          message: 'Validation failed',
          errors: error.errors
        };
      }

      return {
        success: false,
        message: 'Failed to create ${singularName}'
      };
    }
  }

  async update(id: number, data: Update${capitalize(singularName)}Input) {
    try {
      const existing = await this.model.findById(id);

      if (!existing) {
        return {
          success: false,
          message: '${capitalize(singularName)} not found'
        };
      }

      // Validate with Zod
      const validated = update${capitalize(singularName)}Schema.parse(data);

      const updated = await this.model.update(id, validated as Partial<New${capitalize(singularName)}>);

      return {
        success: true,
        data: updated,
        message: '${capitalize(singularName)} updated successfully'
      };
    } catch (error: any) {
      console.error('Error in update ${singularName}:', error);
      
      if (error.errors) {
        return {
          success: false,
          message: 'Validation failed',
          errors: error.errors
        };
      }

      return {
        success: false,
        message: 'Failed to update ${singularName}'
      };
    }
  }

  async delete(id: number) {
    try {
      const existing = await this.model.findById(id);

      if (!existing) {
        return {
          success: false,
          message: '${capitalize(singularName)} not found'
        };
      }

      const deleted = await this.model.delete(id);

      return {
        success: deleted,
        message: deleted ? '${capitalize(singularName)} deleted successfully' : 'Failed to delete ${singularName}'
      };
    } catch (error) {
      console.error('Error in delete ${singularName}:', error);
      return {
        success: false,
        message: 'Failed to delete ${singularName}'
      };
    }
  }
}
`,

  controller: (name, singularName) => `import { ${capitalize(singularName)}Service } from '~/server/services/${capitalize(singularName)}Service';
import type { H3Event } from 'h3';

const service = new ${capitalize(singularName)}Service();

// GET /api/${name}
export const index = async (event: H3Event) => {
  try {
    const result = await service.getAll();

    if (!result.success) {
      throw createError({
        statusCode: 500,
        message: result.message
      });
    }

    return result;
  } catch (error: any) {
    console.error('Error in ${name} index:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// GET /api/${name}/:id
export const show = async (event: H3Event) => {
  try {
    const id = parseInt(event.context.params?.id as string);

    if (isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid ID'
      });
    }

    const result = await service.getById(id);

    if (!result.success) {
      throw createError({
        statusCode: 404,
        message: result.message
      });
    }

    return result;
  } catch (error: any) {
    console.error('Error in ${singularName} show:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// POST /api/${name}
export const store = async (event: H3Event) => {
  try {
    const body = await readBody(event);
    const result = await service.create(body);

    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: result.message,
        data: result.errors
      });
    }

    return result;
  } catch (error: any) {
    console.error('Error in ${singularName} store:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// PUT /api/${name}/:id
export const update = async (event: H3Event) => {
  try {
    const id = parseInt(event.context.params?.id as string);
    const body = await readBody(event);

    if (isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid ID'
      });
    }

    const result = await service.update(id, body);

    if (!result.success) {
      throw createError({
        statusCode: result.message.includes('not found') ? 404 : 400,
        message: result.message,
        data: result.errors
      });
    }

    return result;
  } catch (error: any) {
    console.error('Error in ${singularName} update:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// DELETE /api/${name}/:id
export const destroy = async (event: H3Event) => {
  try {
    const id = parseInt(event.context.params?.id as string);

    if (isNaN(id)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid ID'
      });
    }

    const result = await service.delete(id);

    if (!result.success) {
      throw createError({
        statusCode: result.message.includes('not found') ? 404 : 400,
        message: result.message
      });
    }

    return {
      success: true,
      message: result.message
    };
  } catch (error: any) {
    console.error('Error in ${singularName} destroy:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};
`,

  apiIndex: (name) => `import { index } from '~/server/controllers/${singularize(name)}Controller';

export default defineEventHandler(index);
`,

  apiId: (name, method) => `import { ${method} } from '~/server/controllers/${singularize(name)}Controller';

export default defineEventHandler(${method});
`,

  type: (singularName) => `export interface ${capitalize(singularName)} {
  id: number;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${capitalize(singularName)}Input {
  name: string;
  description?: string;
}

export interface Update${capitalize(singularName)}Input {
  name?: string;
  description?: string;
}
`,

  piniaStore: (name, singularName) => `import { defineStore } from 'pinia';
import type { ${capitalize(singularName)} } from '~/types';

interface ${capitalize(singularName)}State {
  items: ${capitalize(singularName)}[];
  currentItem: ${capitalize(singularName)} | null;
  loading: boolean;
  error: string | null;
}

export const use${capitalize(singularName)}Store = defineStore('${singularName}', {
  state: (): ${capitalize(singularName)}State => ({
    items: [],
    currentItem: null,
    loading: false,
    error: null
  }),

  getters: {
    getItems: (state) => state.items,
    getCurrentItem: (state) => state.currentItem,
    isLoading: (state) => state.loading
  },

  actions: {
    async fetchAll() {
      this.loading = true;
      this.error = null;

      try {
        const { data } = await $fetch<{ data: ${capitalize(singularName)}[] }>('/api/${name}');
        this.items = data;
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch ${name}';
        console.error('Error fetching ${name}:', error);
      } finally {
        this.loading = false;
      }
    },

    async fetchById(id: number) {
      this.loading = true;
      this.error = null;

      try {
        const { data } = await $fetch<{ data: ${capitalize(singularName)} }>(\`/api/${name}/\${id}\`);
        this.currentItem = data;
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch ${singularName}';
        console.error('Error fetching ${singularName}:', error);
      } finally {
        this.loading = false;
      }
    },

    async create(data: Partial<${capitalize(singularName)}>) {
      this.loading = true;
      this.error = null;

      try {
        const { data: newItem } = await $fetch<{ data: ${capitalize(singularName)} }>('/api/${name}', {
          method: 'POST',
          body: data
        });

        this.items.push(newItem);
        return newItem;
      } catch (error: any) {
        this.error = error.message || 'Failed to create ${singularName}';
        console.error('Error creating ${singularName}:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async update(id: number, data: Partial<${capitalize(singularName)}>) {
      this.loading = true;
      this.error = null;

      try {
        const { data: updatedItem } = await $fetch<{ data: ${capitalize(singularName)} }>(\`/api/${name}/\${id}\`, {
          method: 'PUT',
          body: data
        });

        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
          this.items[index] = updatedItem;
        }

        if (this.currentItem?.id === id) {
          this.currentItem = updatedItem;
        }

        return updatedItem;
      } catch (error: any) {
        this.error = error.message || 'Failed to update ${singularName}';
        console.error('Error updating ${singularName}:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async delete(id: number) {
      this.loading = true;
      this.error = null;

      try {
        await $fetch(\`/api/${name}/\${id}\`, {
          method: 'DELETE'
        });

        this.items = this.items.filter(item => item.id !== id);

        if (this.currentItem?.id === id) {
          this.currentItem = null;
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to delete ${singularName}';
        console.error('Error deleting ${singularName}:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async bulkDelete(ids: number[]) {
      this.loading = true;
      this.error = null;

      try {
        await Promise.all(ids.map(id =>
          $fetch(\`/api/${name}/\${id}\`, { method: 'DELETE' })
        ));

        this.items = this.items.filter(item => !ids.includes(item.id));
      } catch (error: any) {
        this.error = error.message || 'Failed to delete ${name}';
        console.error('Error bulk deleting ${name}:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
});
`,

  readme: (name, singularName, isPublic = true) => `# ${capitalize(singularName)} CRUD Generator

Generated CRUD for ${name} on ${new Date().toLocaleString()}
${!isPublic ? '\n🔐 **This CRUD requires authentication**' : '\n🌐 **This CRUD is public (no authentication required)**'}

## Structure Generated

- \`server/database/schema/${name}.ts\` - Database schema
- \`server/utils/validation/${singularName}Schema.ts\` - Zod validation schemas
- \`server/models/${capitalize(singularName)}Model.ts\` - Model for database operations
- \`server/services/${capitalize(singularName)}Service.ts\` - Service layer with business logic
- \`server/controllers/${singularName}Controller.ts\` - Controller with request handling
- \`server/api/${name}/index.get.ts\` - GET all endpoint
- \`server/api/${name}/[id].get.ts\` - GET single endpoint
- \`server/api/${name}/index.post.ts\` - POST create endpoint
- \`server/api/${name}/[id].put.ts\` - PUT update endpoint
- \`server/api/${name}/[id].delete.ts\` - DELETE endpoint
- \`types/${singularName}.ts\` - TypeScript interfaces
- \`stores/${singularName}.ts\` - Pinia store for state management

## API Endpoints

\`\`\`
GET    /api/${name}        - Get all items
GET    /api/${name}/:id    - Get single item
POST   /api/${name}        - Create new item
PUT    /api/${name}/:id    - Update item
DELETE /api/${name}/:id    - Delete item
\`\`\`

## Validation with Zod

This CRUD uses Zod for request validation. Validation schemas are in \`server/utils/validation/${singularName}Schema.ts\`.

## Usage Example

\`\`\`typescript
// In a component
import { use${capitalize(singularName)}Store } from '~/stores/${singularName}';

const store = use${capitalize(singularName)}Store();

// Fetch all
await store.fetchAll();

// Create new
await store.create({ name: 'New Item' });

// Update
await store.update(1, { name: 'Updated' });

// Delete
await store.delete(1);
\`\`\`
`,

  // Auth config file
  authConfig: `// server/config/auth.ts
// Configuration for authentication middleware

export interface AuthConfig {
  // Public API routes that don't require authentication
  publicApiRoutes: string[];
  
  // Public GET routes (useful for read-only APIs)
  publicGetRoutes: string[];
  
  // Routes that are always public (even for non-GET methods)
  alwaysPublicRoutes: string[];
}

export const authConfig: AuthConfig = {
  // API routes that are completely public (all methods)
  publicApiRoutes: [
    '/api/auth',
    '/api/public',
    '/api/health',
  ],
  
  // Routes where GET requests are public (but other methods require auth)
  publicGetRoutes: [
    '/api/posts',
    '/api/categories',
  ],
  
  // Routes that are always public regardless of method
  alwaysPublicRoutes: [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/verify',
    '/api/health'
  ]
};

// Helper function to check if a route is public
export function isPublicRoute(path: string, method: string): boolean {
  // Check always public routes first
  if (authConfig.alwaysPublicRoutes.some(route => path.startsWith(route))) {
    return true;
  }
  
  // Check if it's a public API route
  if (authConfig.publicApiRoutes.some(route => path.startsWith(route))) {
    return true;
  }
  
  // Check if it's a public GET route
  if (method === 'GET' && authConfig.publicGetRoutes.some(route => path.startsWith(route))) {
    return true;
  }
  
  return false;
}
`,

  // Auth middleware
  authMiddleware: `import jwt from 'jsonwebtoken';
import type { H3Event } from 'h3';
import { isPublicRoute } from '~/server/config/auth';

// Middleware to require authentication
export const requireAuth = (handler: Function) => {
  return async (event: H3Event) => {
    try {
      // Check if route is public
      const path = event.path || '';
      const method = event.method;
      
      if (isPublicRoute(path, method)) {
        return handler(event);
      }
      
      const session = await getUserSession(event);
      
      if (session?.user) {
        event.context.auth = { user: session.user };
        return handler(event);
      }

      const token = getCookie(event, 'token') ||
        event.headers.get('authorization')?.replace('Bearer ', '');

      if (!token) {
        throw createError({
          statusCode: 401,
          message: 'Unauthorized - No token provided'
        });
      }

      const config = useRuntimeConfig();
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as any;
        event.context.auth = { user: decoded };
        return handler(event);
      } catch (jwtError) {
        throw createError({
          statusCode: 401,
          message: 'Invalid or expired token'
        });
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.statusCode) {
        throw error;
      }
      throw createError({
        statusCode: 401,
        message: 'Authentication failed'
      });
    }
  };
};

// Main auth middleware for global use
export default defineEventHandler(async (event) => {
  const path = event.path || '';
  const method = event.method;

  // Check if route is public based on config
  if (isPublicRoute(path, method)) {
    return;
  }

  // PROTECTED ROUTES
  if (path.startsWith('/dashboard')) {
    try {
      const session = await getUserSession(event);
      if (!session?.user) {
        return sendRedirect(event, '/login');
      }
      event.context.auth = { user: session.user };
      return;
    } catch {
      return sendRedirect(event, '/login');
    }
  }

  // API routes protection
  if (path.startsWith('/api/')) {
    const token = getCookie(event, 'token') ||
      event.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized - No token provided'
      });
    }

    const config = useRuntimeConfig();
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      event.context.auth = { user: decoded };
      return;
    } catch (jwtError) {
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token'
      });
    }
  }
});
`
};

async function promptField() {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Field name:',
      validate: (input) => input ? true : 'Field name is required'
    },
    {
      type: 'list',
      name: 'type',
      message: 'Field type:',
      choices: ['string', 'text', 'number', 'boolean', 'date', 'json']
    },
    {
      type: 'confirm',
      name: 'nullable',
      message: 'Is this field nullable?',
      default: false
    },
    {
      type: 'confirm',
      name: 'unique',
      message: 'Is this field unique?',
      default: false,
      when: (answers) => answers.type === 'string' || answers.type === 'number'
    },
    {
      type: 'input',
      name: 'default',
      message: 'Default value (leave empty for none):',
      default: ''
    },
    {
      type: 'input',
      name: 'maxLength',
      message: 'Max length (for string fields):',
      default: '255',
      when: (answers) => answers.type === 'string'
    },
    {
      type: 'input',
      name: 'minLength',
      message: 'Min length (for string fields):',
      default: '',
      when: (answers) => answers.type === 'string'
    },
    {
      type: 'confirm',
      name: 'email',
      message: 'Is this an email field?',
      default: false,
      when: (answers) => answers.type === 'string' && answers.name.toLowerCase().includes('email')
    },
    {
      type: 'input',
      name: 'min',
      message: 'Minimum value (for number fields):',
      default: '',
      when: (answers) => answers.type === 'number'
    },
    {
      type: 'input',
      name: 'max',
      message: 'Maximum value (for number fields):',
      default: '',
      when: (answers) => answers.type === 'number'
    }
  ];

  return await inquirer.prompt(questions);
}

async function promptFields() {
  const fields = [];
  let addMore = true;

  console.log(chalk.cyan('\n📝 Define your schema fields (minimum 1 field)\n'));

  while (addMore) {
    const field = await promptField();
    fields.push(field);

    if (fields.length >= 1) {
      const { continue: continueAdding } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Add another field?',
          default: false
        }
      ]);
      addMore = continueAdding;
    }
  }

  return fields;
}

async function ensureDir(dir) {
  await fs.ensureDir(path.join(process.cwd(), dir));
}

async function writeFile(filePath, content) {
  const fullPath = path.join(process.cwd(), filePath);
  await fs.ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, content);
  console.log(chalk.green(`✓ Created: ${filePath}`));
}

async function updateSchemaIndex(name) {
  const indexPath = path.join(process.cwd(), config.schemaPath, 'index.ts');

  if (await fs.pathExists(indexPath)) {
    let content = await fs.readFile(indexPath, 'utf-8');

    if (!content.includes(`export * from './${name}';`)) {
      content += `\nexport * from './${name}';`;
      await fs.writeFile(indexPath, content);
      console.log(chalk.green(`✓ Updated: ${config.schemaPath}/index.ts`));
    }
  } else {
    // Create index file if it doesn't exist
    const content = `export * from './${name}';\n`;
    await fs.writeFile(indexPath, content);
    console.log(chalk.green(`✓ Created: ${config.schemaPath}/index.ts`));
  }
}

async function updateAuthConfigForRoute(name, isPublic) {
  if (!isPublic) return;

  const authConfigPath = path.join(process.cwd(), 'server/config/auth.ts');

  if (await fs.pathExists(authConfigPath)) {
    let content = await fs.readFile(authConfigPath, 'utf-8');

    const route = `/api/${name}`;
    if (!content.includes(`'${route}'`)) {
      // Try to add to publicApiRoutes
      const newContent = content.replace(
        /(publicApiRoutes: \[)([^\]]*)(\])/s,
        (match, p1, p2, p3) => {
          // Check if array is empty or has items
          const trimmedP2 = p2.trim();
          const separator = trimmedP2 && trimmedP2 !== '[' ? ',\n    ' : '';
          return p1 + p2 + separator + `'${route}'` + '\n  ' + p3;
        }
      );

      if (newContent !== content) {
        await fs.writeFile(authConfigPath, newContent);
        console.log(chalk.green(`✓ Updated auth config: added ${route} to public routes`));
      }
    }
  }
}

async function generateCRUD(singularName, fields = [], isPublic = true) {
  const name = pluralize(singularName);

  console.log(chalk.blue(`\n🚀 Generating CRUD for: ${name} (singular: ${singularName}) ${isPublic ? '(Public)' : '(Protected)'}\n`));

  // Create directories
  await ensureDir(config.schemaPath);
  await ensureDir(config.modelsPath);
  await ensureDir(config.servicesPath);
  await ensureDir(config.controllersPath);
  await ensureDir(config.apiPath);
  await ensureDir(config.typesPath);
  await ensureDir(config.zodPath);
  await ensureDir('stores');
  await ensureDir('generated');

  // Generate files
  const files = [
    {
      path: `${config.schemaPath}/${name}.ts`,
      content: templates.schema(name, singularName, fields)
    },
    {
      path: `${config.zodPath}/${singularName}Schema.ts`,
      content: templates.zodSchema(name, singularName, fields)
    },
    {
      path: `${config.modelsPath}/${capitalize(singularName)}Model.ts`,
      content: templates.model(name, singularName)
    },
    {
      path: `${config.servicesPath}/${capitalize(singularName)}Service.ts`,
      content: templates.service(name, singularName)
    },
    {
      path: `${config.controllersPath}/${singularName}Controller.ts`,
      content: templates.controller(name, singularName)
    },
    {
      path: `server/api/${name}/index.get.ts`,
      content: templates.apiIndex(name)
    },
    {
      path: `server/api/${name}/[id].get.ts`,
      content: templates.apiId(name, 'show')
    },
    {
      path: `server/api/${name}/index.post.ts`,
      content: templates.apiId(name, 'store')
    },
    {
      path: `server/api/${name}/[id].put.ts`,
      content: templates.apiId(name, 'update')
    },
    {
      path: `server/api/${name}/[id].delete.ts`,
      content: templates.apiId(name, 'destroy')
    },
    {
      path: `${config.typesPath}/${singularName}.ts`,
      content: templates.type(singularName)
    },
    {
      path: `stores/${singularName}.ts`,
      content: templates.piniaStore(name, singularName)
    },
    {
      path: `generated/${singularName}-README.md`,
      content: templates.readme(name, singularName, isPublic)
    }
  ];

  // Write all files
  for (const file of files) {
    await writeFile(file.path, file.content);
  }

  // Update schema index
  await updateSchemaIndex(name);

  // Update auth config if public
  await updateAuthConfigForRoute(name, isPublic);

  console.log(chalk.green(`\n✅ CRUD for ${name} generated successfully!`));
  console.log(chalk.yellow(`\n📁 Files created:`));
  console.log(chalk.cyan(`  - Database schema: ${config.schemaPath}/${name}.ts`));
  console.log(chalk.cyan(`  - Zod validation: ${config.zodPath}/${singularName}Schema.ts`));
  console.log(chalk.cyan(`  - Model: ${config.modelsPath}/${capitalize(singularName)}Model.ts`));
  console.log(chalk.cyan(`  - Service: ${config.servicesPath}/${capitalize(singularName)}Service.ts`));
  console.log(chalk.cyan(`  - Controller: ${config.controllersPath}/${singularName}Controller.ts`));
  console.log(chalk.cyan(`  - API endpoints: server/api/${name}/ (5 files)`));
  console.log(chalk.cyan(`  - Types: ${config.typesPath}/${singularName}.ts`));
  console.log(chalk.cyan(`  - Pinia store: stores/${singularName}.ts`));

  if (isPublic) {
    console.log(chalk.green(`\n🌐 This CRUD is PUBLIC - no authentication required`));
  } else {
    console.log(chalk.yellow(`\n🔐 This CRUD is PROTECTED - requires authentication`));
  }

  console.log(chalk.yellow(`\n📋 Next steps:`));
  console.log(chalk.white(`  1. Run database migration: npm run db:push`));
  console.log(chalk.white(`  2. Import the store in your components:`));
  console.log(chalk.white(`     import { use${capitalize(singularName)}Store } from '~/stores/${singularName}'`));
  console.log(chalk.white(`  3. Check generated/${singularName}-README.md for usage`));
}

async function generateAuth() {
  console.log(chalk.blue(`\n🔐 Generating Authentication System...\n`));

  // Create directories
  await ensureDir('server/models');
  await ensureDir('server/services');
  await ensureDir('server/controllers');
  await ensureDir('server/api/auth');
  await ensureDir('server/middleware');
  await ensureDir('server/utils');
  await ensureDir('server/config');
  await ensureDir('server/database/schema');
  await ensureDir('types');
  await ensureDir('stores');

  // Auth templates
  const authTemplates = {
    userSchema: `import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;`,

    userModel: `import { eq } from 'drizzle-orm';
import { db } from '~/server/utils/db';
import { users, type NewUser, type User } from '~/server/database/schema/users';

export class UserModel {
  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email));
      return result[0];
    } catch (error) {
      console.error('Error finding user by email:', error);
      return undefined;
    }
  }

  async findById(id: number): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      console.error('Error finding user by id:', error);
      return undefined;
    }
  }

  async create(data: NewUser): Promise<User | undefined> {
    try {
      const result = await db.insert(users).values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating user:', error);
      return undefined;
    }
  }

  async update(id: number, data: Partial<NewUser>): Promise<User | undefined> {
    try {
      const result = await db.update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async getAll(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }
}`,

    authService: `import { UserModel } from '~/server/models/UserModel';
import jwt from 'jsonwebtoken';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
}

export class AuthService {
  private userModel = new UserModel();
  private readonly jwtSecret: string;

  constructor() {
    const config = useRuntimeConfig();
    this.jwtSecret = config.jwtSecret as string;

    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET is not defined in runtime config');
    }
  }

  async login(credentials: LoginCredentials) {
    const { email, password } = credentials;

    const user = await this.userModel.findByEmail(email);

    if (!user) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    const isValid = await this.verifyPassword(user.password, password);

    if (!isValid) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    };
  }

  async register(data: RegisterData) {
    const { email, password, name } = data;

    const existingUser = await this.userModel.findByEmail(email);

    if (existingUser) {
      return {
        success: false,
        message: 'User with this email already exists'
      };
    }

    const hashedPassword = await this.hashPassword(password);

    const newUser = await this.userModel.create({
      email,
      password: hashedPassword,
      name,
      role: 'user'
    });

    if (!newUser) {
      return {
        success: false,
        message: 'Failed to create user'
      };
    }

    const token = this.generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      },
      token
    };
  }

  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  private generateToken(payload: JwtPayload): string {
    return jwt.sign(
      payload,
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  async validateToken(token: string) {
    const payload = await this.verifyToken(token);

    if (!payload) {
      return { valid: false };
    }

    const user = await this.userModel.findById(payload.id);

    if (!user) {
      return { valid: false };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }
}`,

    authController: `import { AuthService } from '~/server/services/AuthService';
import type { H3Event } from 'h3';

const authService = new AuthService();

export const login = async (event: H3Event) => {
  try {
    const body = await readBody(event);

    if (!body.email || !body.password) {
      throw createError({
        statusCode: 400,
        message: 'Email and password are required'
      });
    }

    const result = await authService.login(body);

    if (!result.success) {
      throw createError({
        statusCode: 401,
        message: result.message
      });
    }

    await setUserSession(event, {
      user: result.user,
      loggedInAt: Date.now()
    });

    setCookie(event, 'token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    return {
      success: true,
      user: result.user
    };
  } catch (error: any) {
    console.error('Login error:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

export const register = async (event: H3Event) => {
  try {
    const body = await readBody(event);

    if (!body.email || !body.password || !body.name) {
      throw createError({
        statusCode: 400,
        message: 'Name, email and password are required'
      });
    }

    const result = await authService.register(body);

    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: result.message
      });
    }

    return {
      success: true,
      user: result.user
    };
  } catch (error: any) {
    console.error('Register error:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

export const logout = async (event: H3Event) => {
  try {
    await clearUserSession(event);
    deleteCookie(event, 'token');

    return {
      success: true,
      message: 'Logged out successfully'
    };
  } catch (error: any) {
    console.error('Logout error:', error);
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

export const getMe = async (event: H3Event) => {
  try {
    const session = await getUserSession(event);

    if (!session.user) {
      throw createError({
        statusCode: 401,
        message: 'Not authenticated'
      });
    }

    return {
      success: true,
      user: session.user
    };
  } catch (error: any) {
    console.error('Get me error:', error);
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

export const verifyToken = async (event: H3Event) => {
  try {
    const token = getCookie(event, 'token') || event.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return { valid: false };
    }

    const result = await authService.validateToken(token);
    return result;
  } catch (error) {
    return { valid: false };
  }
};`,

    authTypes: `export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}`,

    authStore: `import { defineStore } from 'pinia';
import type { User, LoginCredentials, RegisterData } from '~/types/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    loading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    currentUser: (state) => state.user,
    isAdmin: (state) => state.user?.role === 'admin'
  },

  actions: {
    async login(credentials: LoginCredentials) {
      this.loading = true;
      this.error = null;

      try {
        const { user, token } = await $fetch('/api/auth/login', {
          method: 'POST',
          body: credentials
        });

        this.user = user;
        this.token = token;

        return { success: true };
      } catch (error: any) {
        this.error = error.data?.message || 'Login failed';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async register(data: RegisterData) {
      this.loading = true;
      this.error = null;

      try {
        const { user } = await $fetch('/api/auth/register', {
          method: 'POST',
          body: data
        });

        return { success: true };
      } catch (error: any) {
        this.error = error.data?.message || 'Registration failed';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await $fetch('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        this.user = null;
        this.token = null;
      }
    },

    async fetchUser() {
      this.loading = true;

      try {
        const { user } = await $fetch('/api/auth/me');
        this.user = user;
      } catch (error) {
        this.user = null;
      } finally {
        this.loading = false;
      }
    },

    async verifyToken() {
      try {
        const { valid, user } = await $fetch('/api/auth/verify');
        if (valid && user) {
          this.user = user;
        }
        return valid;
      } catch (error) {
        return false;
      }
    }
  }
});`
  };

  const authFiles = [
    { path: 'server/database/schema/users.ts', content: authTemplates.userSchema },
    { path: 'server/database/schema/index.ts', content: `export * from './users';\n` },
    { path: 'server/models/UserModel.ts', content: authTemplates.userModel },
    { path: 'server/services/AuthService.ts', content: authTemplates.authService },
    { path: 'server/controllers/authController.ts', content: authTemplates.authController },
    { path: 'server/api/auth/login.post.ts', content: `import { login } from '~/server/controllers/authController';\nexport default defineEventHandler(login);` },
    { path: 'server/api/auth/register.post.ts', content: `import { register } from '~/server/controllers/authController';\nexport default defineEventHandler(register);` },
    { path: 'server/api/auth/logout.post.ts', content: `import { logout } from '~/server/controllers/authController';\nexport default defineEventHandler(logout);` },
    { path: 'server/api/auth/me.get.ts', content: `import { getMe } from '~/server/controllers/authController';\nexport default defineEventHandler(getMe);` },
    { path: 'server/api/auth/verify.get.ts', content: `import { verifyToken } from '~/server/controllers/authController';\nexport default defineEventHandler(verifyToken);` },
    { path: 'server/config/auth.ts', content: templates.authConfig },
    { path: 'server/middleware/auth.ts', content: templates.authMiddleware },
    { path: 'types/auth.ts', content: authTemplates.authTypes },
    { path: 'stores/auth.ts', content: authTemplates.authStore }
  ];

  for (const file of authFiles) {
    await writeFile(file.path, file.content);
  }

  console.log(chalk.green(`\n✅ Authentication system generated successfully!`));
  console.log(chalk.yellow(`\n📁 Auth files created:`));
  console.log(chalk.cyan(`  - Database schema: server/database/schema/users.ts`));
  console.log(chalk.cyan(`  - Model: server/models/UserModel.ts`));
  console.log(chalk.cyan(`  - Service: server/services/AuthService.ts`));
  console.log(chalk.cyan(`  - Controller: server/controllers/authController.ts`));
  console.log(chalk.cyan(`  - API endpoints: server/api/auth/ (5 files)`));
  console.log(chalk.cyan(`  - Config: server/config/auth.ts`));
  console.log(chalk.cyan(`  - Middleware: server/middleware/auth.ts`));
  console.log(chalk.cyan(`  - Types: types/auth.ts`));
  console.log(chalk.cyan(`  - Store: stores/auth.ts`));

  console.log(chalk.yellow(`\n📋 Next steps:`));
  console.log(chalk.white(`  1. Install required packages:`));
  console.log(chalk.white(`     npm install jsonwebtoken argon2`));
  console.log(chalk.white(`  2. Add JWT_SECRET to your .env file`));
  console.log(chalk.white(`  3. Run database migration: npm run db:push`));
  console.log(chalk.white(`  4. Import useAuthStore() in your components`));
}

async function generateUser() {
  console.log(chalk.blue(`\n👤 Generating User Management System...\n`));

  const userFields = [
    { name: 'email', type: 'string', maxLength: 255, nullable: false, unique: true, email: true },
    { name: 'password', type: 'string', maxLength: 255, nullable: false, minLength: 6 },
    { name: 'name', type: 'string', maxLength: 100, nullable: false, minLength: 2 },
    { name: 'role', type: 'string', maxLength: 50, default: 'user' },
    { name: 'avatar', type: 'string', maxLength: 500, nullable: true },
    { name: 'isActive', type: 'boolean', default: true },
    { name: 'lastLogin', type: 'date', nullable: true }
  ];

  await generateCRUD('user', userFields, false);
}

// Main CLI
async function main() {
  console.log(chalk.bold.cyan('\n🚀 Nuxt Nitro CRUD Generator with Interactive Field Builder\n'));

  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(chalk.yellow('Usage:'));
    console.log(chalk.white('  node generate.js crud <name> [--public|--protected]  - Generate CRUD with interactive fields'));
    console.log(chalk.white('  node generate.js auth                                 - Generate authentication system'));
    console.log(chalk.white('  node generate.js user                                 - Generate user management (protected)'));
    console.log(chalk.white('  node generate.js all                                  - Generate everything'));
    console.log();
    return;
  }

  switch (command) {
    case 'crud':
      const singularName = args[1];
      if (!singularName) {
        console.log(chalk.red('Error: Please specify a name for the CRUD'));
        console.log(chalk.white('Example: node generate.js crud post --public'));
        console.log(chalk.white('Example: node generate.js crud post --protected'));
        return;
      }

      const isPublic = !args.includes('--protected');

      // Interactive field definition
      const fields = await promptFields();

      await generateCRUD(singularName, fields, isPublic);
      break;

    case 'auth':
      await generateAuth();
      break;

    case 'user':
      await generateUser();
      break;

    case 'all':
      console.log(chalk.blue('\n📦 Generating all components...\n'));
      await generateAuth();
      await generateUser();

      // Generate example CRUD with default fields
      const postFields = [
        { name: 'title', type: 'string', maxLength: 255, nullable: false },
        { name: 'content', type: 'text', nullable: true },
        { name: 'published', type: 'boolean', default: false },
        { name: 'views', type: 'number', default: 0 }
      ];
      await generateCRUD('post', postFields, true);

      const categoryFields = [
        { name: 'name', type: 'string', maxLength: 100, nullable: false, unique: true },
        { name: 'slug', type: 'string', maxLength: 100, nullable: false, unique: true },
        { name: 'description', type: 'text', nullable: true }
      ];
      await generateCRUD('category', categoryFields, true);
      break;

    default:
      console.log(chalk.red(`Unknown command: ${command}`));
  }
}

// Run the generator
main().catch(console.error);
