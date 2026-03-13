// Supabase Edge Function: admin-create-user
// Crea/invita un usuario desde la UI de Super Admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AppRole = 'superadmin' | 'partner' | 'user';

interface CreateUserBody {
  email: string;
  full_name: string;
  role: AppRole;
  partner_id?: string | null;
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

  let body: CreateUserBody | null = null;
  try {
    body = (await req.json()) as CreateUserBody;
  } catch {
    return json({ error: 'Body inválido.' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const fullName = (body.full_name ?? '').trim();
  const role = body.role;
  const partnerId = body.partner_id ?? null;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: 'Correo inválido.' }, 400);
  }
  if (!fullName || fullName.length < 2) {
    return json({ error: 'Nombre inválido.' }, 400);
  }
  if (!role || !['superadmin', 'partner', 'user'].includes(role)) {
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
    return json({ error: 'No tienes permisos para crear usuarios.' }, 403);
  }

  // 2) Crear/invitar usuario con service role
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
  if (inviteError) return json({ error: inviteError.message }, 400);

  const createdId = invited.user?.id;
  if (!createdId) return json({ error: 'No se pudo crear el usuario.' }, 500);

  // 3) Upsert perfil (por si no existe trigger)
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: createdId,
    full_name: fullName,
    email,
    role,
    partner_id: role === 'partner' ? partnerId : null,
    avatar_url: null,
    is_active: true,
  });

  if (profileError) return json({ error: profileError.message }, 400);

  return json({ id: createdId });
});

