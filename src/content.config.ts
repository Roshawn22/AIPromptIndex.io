import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const prompts = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/prompts' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    promptText: z.string(),
    description: z.string(),
    tool: z.string(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    promptType: z.enum(['text', 'image', 'code']).default('text'),
    variables: z.array(z.object({
      name: z.string(),
      description: z.string(),
      example: z.string(),
    })).default([]),
    tips: z.array(z.string()).default([]),
    exampleOutput: z.string().optional(),
    isFeatured: z.boolean().default(false),
    dateAdded: z.string(),
    lastUpdated: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
  }),
});

const tools = defineCollection({
  loader: file('./src/data/tools/tools.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    websiteUrl: z.string(),
    logoIcon: z.string(),
    color: z.string(),
    order: z.number(),
  }),
});

const categories = defineCollection({
  loader: file('./src/data/categories/categories.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    icon: z.string(),
    order: z.number(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  prompts,
  tools,
  categories,
  blog,
  guides,
};
