// Supabase Edge Function: admin-update-user
// Actualiza un perfil (rol/estado/partner_id) desde la UI de Super Admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AppRole = 'superadmin' | 'partner' | 'user';

interface UpdateUserBody {
  id: string;
  role?: AppRole;
  partner_id?: string | null;
  is_active?: boolean;
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Variables de entorno de Supabase no configuradas.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'No autorizado.' }, 401);

  let body: UpdateUserBody | null = null;
  try {
    body = (await req.json()) as UpdateUserBody;
  } catch {
    return json({ error: 'Body inválido.' }, 400);
  }

  const id = (body.id ?? '').trim();
  if (!id || !isUuid(id)) return json({ error: 'ID de usuario inválido.' }, 400);

  const role = body.role;
  const partnerId = body.partner_id ?? null;
  const hasRole = typeof role !== 'undefined';
  const hasActive = typeof body.is_active !== 'undefined';
  const hasPartnerId = typeof body.partner_id !== 'undefined';

  if (!hasRole && !hasActive && !hasPartnerId) {
    return json({ error: 'No hay cambios para aplicar.' }, 400);
  }

  if (hasRole && !['superadmin', 'partner', 'user'].includes(role as string)) {
    return json({ error: 'Rol inválido.' }, 400);
  }

  // 1) Validar que el caller sea superadmin activo
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !authData?.user) return json({ error: 'No autorizado.' }, 401);

  const { data: callerProfile, error: callerError } = await supabaseUser
    .from('profiles')
    .select('role,is_active')
    .eq('id', authData.user.id)
    .single();

  if (callerError || !callerProfile) return json({ error: 'No autorizado.' }, 401);
  if (!callerProfile.is_active || callerProfile.role !== 'superadmin') {
    return json({ error: 'No tienes permisos para actualizar usuarios.' }, 403);
  }

  // 2) Aplicar cambios con service role
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const updates: Record<string, unknown> = {};

  if (hasRole) updates.role = role;
  if (hasActive) updates.is_active = Boolean(body.is_active);

  if (hasRole) {
    // Mantener consistencia: si no es partner, limpiar partner_id
    if (role !== 'partner') {
      updates.partner_id = null;
    } else if (hasPartnerId) {
      updates.partner_id = partnerId;
    }
  } else if (hasPartnerId) {
    updates.partner_id = partnerId;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) return json({ error: updateError.message }, 400);

  return json({ profile: updated });
});