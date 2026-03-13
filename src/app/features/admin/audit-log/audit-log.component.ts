import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../shared/components/toast/toast.service';

interface AuditLog {
  readonly id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Historial de acciones del sistema
        </p>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-6">
        <select
          id="audit-filter-table"
          [(ngModel)]="filterTable"
          (ngModelChange)="applyFilter()"
          class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white
                 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las tablas</option>
          <option value="transactions">Transacciones</option>
          <option value="profiles">Usuarios</option>
          <option value="scheduled_payments">Pagos prog.</option>
        </select>

        <select
          id="audit-filter-action"
          [(ngModel)]="filterAction"
          (ngModelChange)="applyFilter()"
          class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white
                 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las acciones</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="IMPORT">IMPORT</option>
        </select>
      </div>

      <!-- Table -->
      <div
        class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100
                  dark:border-gray-800 shadow-sm overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <th class="text-left py-3 px-4 font-semibold text-gray-500">Fecha</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-500">Acción</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-500">Tabla</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-500">Usuario</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-500">Cambios</th>
              </tr>
            </thead>
            <tbody>
              @for (log of filteredLogs(); track log.id) {
                <tr
                  class="border-b border-gray-50 dark:border-gray-800/50
                           hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td class="py-3 px-4 text-gray-500 whitespace-nowrap">
                    {{ formatDate(log.created_at) }}
                  </td>
                  <td class="py-3 px-4">
                    <span
                      [class]="getActionClass(log.action)"
                      class="px-2 py-0.5 rounded-full font-semibold"
                    >
                      {{ log.action }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-gray-700 dark:text-gray-300 font-mono">
                    {{ log.table_name }}
                  </td>
                  <td class="py-3 px-4 text-gray-500 font-mono">
                    {{ log.user_id.slice(0, 8) }}...
                  </td>
                  <td class="py-3 px-4">
                    @if (log.old_data || log.new_data) {
                      <button
                        type="button"
                        [id]="'view-diff-' + log.id"
                        (click)="viewDiff(log)"
                        class="text-blue-500 hover:text-blue-600 underline-offset-2
                               hover:underline transition-colors"
                      >
                        Ver diff
                      </button>
                    } @else {
                      <span class="text-gray-400">—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="py-12 text-center text-gray-400">
                    Sin registros de auditoría
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Diff Viewer Modal -->
      @if (selectedLog()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            class="absolute inset-0 bg-black/60 backdrop-blur-sm"
            (click)="selectedLog.set(null)"
          ></div>
          <div
            class="relative bg-white dark:bg-gray-900 rounded-2xl p-6
                      w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-gray-700
                      max-h-[80vh] overflow-auto"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-bold text-gray-900 dark:text-white">
                Diff — {{ selectedLog()!.action }} on {{ selectedLog()!.table_name }}
              </h2>
              <button
                type="button"
                (click)="selectedLog.set(null)"
                class="text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs font-semibold text-red-600 mb-2">ANTERIOR</p>
                <pre
                  class="text-xs bg-red-50 dark:bg-red-950/30 rounded-xl p-3
                            text-red-800 dark:text-red-300 overflow-auto max-h-64
                            whitespace-pre-wrap"
                  >{{ jsonPretty(selectedLog()!.old_data) }}</pre
                >
              </div>
              <div>
                <p class="text-xs font-semibold text-emerald-600 mb-2">NUEVO</p>
                <pre
                  class="text-xs bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3
                            text-emerald-800 dark:text-emerald-300 overflow-auto max-h-64
                            whitespace-pre-wrap"
                  >{{ jsonPretty(selectedLog()!.new_data) }}</pre
                >
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AuditLogComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  readonly logs = signal<AuditLog[]>([]);
  readonly filteredLogs = signal<AuditLog[]>([]);
  readonly selectedLog = signal<AuditLog | null>(null);

  filterTable = '';
  filterAction = '';

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.supabase.select<AuditLog>('audit_logs', (q) =>
        q.order('created_at', { ascending: false }).limit(200),
      );
      this.logs.set(data);
      this.filteredLogs.set(data);
    } catch {
      this.toast.error('Error al cargar los logs de auditoría.');
    }
  }

  applyFilter(): void {
    let result = this.logs();
    if (this.filterTable) result = result.filter((l) => l.table_name === this.filterTable);
    if (this.filterAction) result = result.filter((l) => l.action === this.filterAction);
    this.filteredLogs.set(result);
  }

  viewDiff(log: AuditLog): void {
    this.selectedLog.set(log);
  }

  getActionClass(action: string): string {
    const map: Record<string, string> = {
      INSERT: 'bg-emerald-100 text-emerald-700',
      UPDATE: 'bg-blue-100 text-blue-700',
      DELETE: 'bg-red-100 text-red-700',
      IMPORT: 'bg-purple-100 text-purple-700',
    };
    return map[action] ?? 'bg-gray-100 text-gray-700';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  jsonPretty(data: Record<string, unknown> | null): string {
    return data ? JSON.stringify(data, null, 2) : 'null';
  }
}
