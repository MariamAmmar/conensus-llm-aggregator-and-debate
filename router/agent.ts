import OpenAI from 'openai';
import type { RouterDecision, ModelMode, ProviderId } from '@/types';
import { ROUTING_RULES } from '@/config/routing';
import { MODEL_CONFIGS } from '@/config/models';
import { classifyPrompt } from './classifier';

const PROVIDER_DESCRIPTIONS = `
- openai (GPT-4o): general conversation, broad factual knowledge, summarization, coding, everyday questions
- anthropic (Claude): long-form document analysis, contract or legal review, safety-sensitive topics, nuanced multi-step instructions, dense technical writing
- gemini (Gemini 2.5 Flash): multimodal image+text tasks, Google product questions, multilingual queries, fast factual lookups
- perplexity (Sonar Pro): real-time web search, current events, live data, news, anything requiring citations
- grok (Grok-3): X/Twitter topics, social media trends, humor, edgy or controversial questions, breaking news
- llama (Llama 4): short simple questions, open-source software topics, lightweight or casual tasks
- o4mini (o4-mini): math, formal logic, step-by-step reasoning, structured proofs, puzzles, code debugging
- deepseek (DeepSeek R1): scientific research, deep technical problems, complex chain-of-thought over long contexts
`.trim();

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return client;
}

export async function routeWithAgent(prompt: string, mode: ModelMode): Promise<RouterDecision> {
  // Non-auto modes skip the agent entirely
  if (mode !== 'auto') {
    const providerMap: Partial<Record<ModelMode, ProviderId>> = {
      chatgpt: 'openai', claude: 'anthropic', gemini: 'gemini',
      perplexity: 'perplexity', grok: 'grok', llama: 'llama',
      o4mini: 'o4mini', deepseek: 'deepseek', image: 'openai-image',
    };
    const selectedModel = providerMap[mode] ?? 'openai';
    const modelConfig = MODEL_CONFIGS[mode];
    const primaryCategory = modelConfig.supportedCategories[0] ?? 'general';
    const rule = ROUTING_RULES[primaryCategory];
    return {
      category: primaryCategory, selectedModel, confidence: 1.0,
      reason: `User explicitly selected ${modelConfig.label} mode.`,
      fallbackModel: rule.fallbackModel,
      requiresWebGrounding: mode === 'perplexity',
      requiresImageGeneration: mode === 'image',
      escalateToDebate: mode === 'debate',
    };
  }

  try {
    const completion = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are an AI router. Given a user prompt, pick the single best AI provider to answer it.

Providers:
${PROVIDER_DESCRIPTIONS}

Respond with ONLY valid JSON — no markdown, no explanation:
{"provider": "<provider_id>", "reason": "<one sentence why>", "confidence": <0.0-1.0>}`,
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(raw);
    const providerId = parsed.provider as ProviderId;

    // Validate the provider is one we know
    const validProviders: ProviderId[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'grok', 'llama', 'o4mini', 'deepseek'];
    if (!validProviders.includes(providerId)) throw new Error(`Unknown provider: ${providerId}`);

    // Map provider back to a category for the rule lookup
    const providerToCategory: Partial<Record<ProviderId, string>> = {
      perplexity: 'research', o4mini: 'logic', deepseek: 'logic',
      openai: 'writing', anthropic: 'writing', grok: 'general',
      gemini: 'general', llama: 'general',
    };
    const category = (providerToCategory[providerId] ?? 'general') as keyof typeof ROUTING_RULES;
    const rule = ROUTING_RULES[category] ?? ROUTING_RULES['general'];

    return {
      category: category as never,
      selectedModel: providerId,
      confidence: parsed.confidence ?? 0.8,
      reason: parsed.reason ?? `Agent routed to ${providerId}.`,
      fallbackModel: rule.fallbackModel,
      requiresWebGrounding: providerId === 'perplexity',
      requiresImageGeneration: false,
      escalateToDebate: false,
    };
  } catch {
    // Fallback to keyword classifier if agent fails
    const classification = classifyPrompt(prompt);
    const rule = ROUTING_RULES[classification.category];
    return {
      category: classification.category,
      selectedModel: rule.primaryModel,
      confidence: classification.confidence,
      reason: `Fallback classifier: ${classification.category}`,
      fallbackModel: rule.fallbackModel,
      requiresWebGrounding: rule.requiresWebGrounding,
      requiresImageGeneration: rule.requiresImageGeneration,
      escalateToDebate: classification.confidence < rule.confidenceThreshold,
    };
  }
}
