import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';

interface DiagResult {
    table: string;
    count: number;
    error: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sample: any[] | null;
}

@Component({
    selector: 'app-debug',
    standalone: true,
    imports: [CommonModule],
    template: `
<div style="font-family:monospace;padding:24px;background:#0f172a;color:#e2e8f0;min-height:100vh">
  <h1 style="color:#60a5fa;font-size:20px;margin-bottom:16px">🩺 Diagnóstico Supabase</h1>

  <section style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:16px">
    <h2 style="color:#94a3b8;font-size:12px;text-transform:uppercase;margin-bottom:8px">Sesión activa</h2>
    @if (userId()) {
      <p style="color:#34d399"><strong>✅ Autenticado</strong></p>
      <p style="margin-top:4px">auth.uid() = <span style="color:#fbbf24">{{ userId() }}</span></p>
      <p style="margin-top:4px">email = <span style="color:#fbbf24">{{ userEmail() }}</span></p>
    } @else {
      <p style="color:#f87171"><strong>❌ Sin sesión activa</strong></p>
    }
  </section>

  @if (loading()) {
    <p style="color:#60a5fa">⏳ Ejecutando consultas...</p>
  }

  @for (r of results(); track r.table) {
    <section style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:12px">
      <h2 style="color:#94a3b8;font-size:12px;text-transform:uppercase;margin-bottom:8px">
        Tabla: <span style="color:#60a5fa">{{ r.table }}</span>
      </h2>
      @if (r.error) {
        <p style="color:#f87171">❌ Error: {{ r.error }}</p>
      } @else {
        <p style="color:#34d399">✅ Registros devueltos: <strong>{{ r.count }}</strong></p>
        @if (r.sample && r.sample.length > 0) {
          <details style="margin-top:8px">
            <summary style="color:#94a3b8;cursor:pointer">Ver primer registro</summary>
            <pre style="margin-top:8px;background:#0f172a;padding:8px;border-radius:4px;font-size:11px;overflow:auto;color:#fbbf24">{{ r.sample[0] | json }}</pre>
          </details>
        } @else {
          <p style="color:#f87171;font-size:12px;margin-top:4px">
            ⚠️ Sin datos — RLS puede estar bloqueando o la tabla está vacía para este usuario
          </p>
        }
      }
    </section>
  }

  @if (results().length > 0) {
    <section style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:12px">
      <h2 style="color:#94a3b8;font-size:12px;text-transform:uppercase;margin-bottom:8px">
        Verificación user_id
      </h2>
      @for (r of results(); track r.table) {
        @if (r.sample && r.sample.length > 0 && r.sample[0].user_id) {
          <p style="margin-bottom:4px">
            <span style="color:#94a3b8">{{ r.table }}[0].user_id =</span>
            <span [style.color]="r.sample[0].user_id === userId() ? '#34d399' : '#f87171'">
              {{ r.sample[0].user_id }}
              {{ r.sample[0].user_id === userId() ? ' ✅ coincide' : ' ❌ NO coincide con auth.uid()' }}
            </span>
          </p>
        }
      }
    </section>
  }

  <button (click)="runDiag()" style="background:#2563eb;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:monospace">
    🔄 Volver a ejecutar
  </button>
</div>
    `,
})
export class DebugComponent implements OnInit {
    private readonly supabase = inject(SupabaseService);

    userId = signal<string | null>(null);
    userEmail = signal<string | null>(null);
    loading = signal(false);
    results = signal<DiagResult[]>([]);

    async ngOnInit(): Promise<void> {
        const { data } = await this.supabase.client.auth.getSession();
        this.userId.set(data.session?.user?.id ?? null);
        this.userEmail.set(data.session?.user?.email ?? null);
        await this.runDiag();
    }

    async runDiag(): Promise<void> {
        this.loading.set(true);
        const tables = ['accounts', 'transactions', 'profiles', 'portfolios', 'scheduled_payments'];
        const results: DiagResult[] = [];

        for (const table of tables) {
            const { data, error } = await this.supabase.client
                .from(table)
                .select('*')
                .limit(1);
            results.push({
                table,
                count: data?.length ?? 0,
                error: error?.message ?? null,
                sample: data ?? null,
            });
        }

        this.results.set(results);
        this.loading.set(false);
    }
}
