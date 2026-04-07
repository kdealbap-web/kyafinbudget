// Supabase Edge Function: wedding-ai
// Proxy seguro para IA (no expone API keys al frontend).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AiAction = 'recommendations' | 'analysis';

type LuxuryLevel = 'economy' | 'standard' | 'luxury' | 'ultra-luxury';

type AIRecommendationPriority = 'high' | 'medium' | 'low';

interface AIRecommendation {
  category: string;
  estimatedBudget: number;
  priority: AIRecommendationPriority;
  tips: string[];
  riskFactors: string[];
}

interface AnalyzeResult {
  analysis: string;
  suggestions: string[];
  riskAlert?: string | null;
}

interface WeddingAiBody {
  action: AiAction;

  // recommendations
  totalBudget?: number;
  eventDate?: string; // ISO yyyy-mm-dd
  preferences?: {
    priorityCategories?: string[];
    luxuryLevel?: LuxuryLevel;
    guestCount?: number;
  };

  // analysis
  expenses?: Array<{
    category?: string | null;
    provider_name?: string | null;
    amount?: number | null;
    paid_amount?: number | null;
    remaining?: number | null;
    status?: string | null;
  }>;

  // optional tuning
  model?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

function buildRecommendationsPrompt(body: WeddingAiBody): { system: string; user: string } {
  const totalBudget = Number(body.totalBudget ?? 0);
  const eventDate = body.eventDate ?? '';
  const prefs = body.preferences ?? {};

  const daysUntilEvent = (() => {
    if (!eventDate) return null;
    const d = new Date(eventDate);
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  })();

  const system =
    "Eres un experto en planificación de bodas en Colombia (pesos COP). " +
    'Proporcionas recomendaciones realistas basadas en datos de mercado. ' +
    'Responde SIEMPRE en JSON válido, sin markdown.';

  const user = [
    `Presupuesto total: ${totalBudget} COP`,
    daysUntilEvent !== null ? `Días hasta la boda: ${daysUntilEvent}` : 'Días hasta la boda: no especificado',
    `Nivel de lujo: ${prefs.luxuryLevel ?? 'standard'}`,
    `Invitados: ${prefs.guestCount ?? 'no especificado'}`,
    `Categorías prioritarias: ${(prefs.priorityCategories ?? []).join(', ') || 'todas'}`,
    '',
    'Genera recomendaciones de asignación presupuestaria por categoría.',
    'Formato JSON EXACTO (array):',
    '[',
    '  {',
    '    "category": "Fotografía",',
    '    "estimatedBudget": 2000000,',
    '    "priority": "high",',
    '    "tips": ["..."],',
    '    "riskFactors": ["..."]',
    '  }',
    ']',
  ].join('\n');

  return { system, user };
}

function buildAnalysisPrompt(expenses: WeddingAiBody['expenses']): { system: string; user: string } {
  const system =
    'Eres un asesor financiero especializado en bodas. ' +
    'Analiza gastos y sugiere optimizaciones realistas. ' +
    'Responde SIEMPRE en JSON válido, sin markdown.';

  const summary = (expenses ?? [])
    .map((e) => {
      const cat = e.category ?? 'Otros';
      const amount = Number(e.amount ?? 0);
      const provider = e.provider_name ?? 'Proveedor';
      const status = e.status ?? '';
      return `${cat}: ${amount} (${provider}) ${status ? `[${status}]` : ''}`;
    })
    .join('\n');

  const user = [
    'Analiza estos gastos de boda:',
    summary || '(sin gastos)',
    '',
    'Proporciona:',
    '1. Análisis general',
    '2. 3-5 sugerencias de optimización',
    '3. Si hay riesgo de sobregasto, alerta',
    '',
    'Formato JSON EXACTO:',
    '{',
    '  "analysis": "...",',
    '  "suggestions": ["...", "..."],',
    '  "riskAlert": null',
    '}',
  ].join('\n');

  return { system, user };
}

async function callAnthropic(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': params.apiKey,
      // Anthropic API version header
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 1200,
      system: params.system,
      messages: [{ role: 'user', content: params.user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }

  const jsonRes = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = (jsonRes.content ?? [])
    .map((c) => (c.type === 'text' ? (c.text ?? '') : ''))
    .join('\n')
    .trim();

  if (!text) throw new Error('Respuesta vacía de IA');
  return text;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Variables de entorno de Supabase no configuradas.' }, 500);
  }
  if (!anthropicApiKey) {
    return json({ error: 'ANTHROPIC_API_KEY no configurada.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'No autorizado.' }, 401);

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !authData?.user) return json({ error: 'No autorizado.' }, 401);

  let body: WeddingAiBody | null = null;
  try {
    body = (await req.json()) as WeddingAiBody;
  } catch {
    return json({ error: 'Body inválido.' }, 400);
  }

  const action = body.action;
  if (action !== 'recommendations' && action !== 'analysis') {
    return json({ error: 'Acción inválida.' }, 400);
  }

  const model = (body.model ?? 'claude-3-5-sonnet-latest').trim();

  try {
    if (action === 'recommendations') {
      const prompts = buildRecommendationsPrompt(body);
      const text = await callAnthropic({
        apiKey: anthropicApiKey,
        model,
        system: prompts.system,
        user: prompts.user,
      });

      // Intentar parsear JSON
      let parsed: AIRecommendation[] | null = null;
      try {
        parsed = JSON.parse(text) as AIRecommendation[];
      } catch {
        parsed = null;
      }

      return json({ ok: true, data: parsed ?? text });
    }

    // analysis
    const prompts = buildAnalysisPrompt(body.expenses);
    const text = await callAnthropic({
      apiKey: anthropicApiKey,
      model,
      system: prompts.system,
      user: prompts.user,
    });

    let parsed: AnalyzeResult | null = null;
    try {
      parsed = JSON.parse(text) as AnalyzeResult;
    } catch {
      parsed = null;
    }

    return json({ ok: true, data: parsed ?? text });
  } catch (err) {
    console.error('wedding-ai error:', err);
    return json({ ok: false, error: (err as Error).message ?? 'Error generando IA' }, 500);
  }
});
