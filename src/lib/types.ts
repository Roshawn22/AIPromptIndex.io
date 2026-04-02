export interface PromptVariable {
  name: string;
  description: string;
  example: string;
}

export interface Prompt {
  title: string;
  slug: string;
  promptText: string;
  description: string;
  tool: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  promptType: 'text' | 'image' | 'code';
  variables: PromptVariable[];
  tips: string[];
  exampleOutput?: string;
  isFeatured: boolean;
  dateAdded: string;
  lastUpdated?: string;
  metaTitle: string;
  metaDescription: string;
}

export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  websiteUrl: string;
  logoIcon: string;
  color: string;
  order: number;
  affiliateUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  order: number;
}

export interface SearchItem {
  name: string;
  description: string;
  url: string;
  type: 'prompt' | 'guide' | 'blog';
  category?: string;
  tags?: string[];
}
