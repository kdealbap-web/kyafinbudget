import {
  Component, inject, signal, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuditService } from '../../core/services/audit.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';
import { Transaction, TransactionType, CategoryType } from '../../domain/models/transaction.model';

interface ExcelRow {
  CONCEPTO?: string;
  INGRESOS?: number;
  GASTOS?: number;
  FECHA?: string | number | Date;
  OBSERVACIONES?: string;
}

interface PreviewRow extends ExcelRow {
  _payer: string | null;
  _type: TransactionType;
  _amount: number;
  _valid: boolean;
}

interface ImportResult {
  success: number;
  errors: number;
  errorDetails: string[];
}

@Component({
  selector: 'app-import-excel',
  standalone: true,
  imports: [CommonModule, CurrencyCopPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div class="max-w-4xl mx-auto">

        <div class="mb-8">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Importar Excel</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Columnas requeridas: CONCEPTO, INGRESOS, GASTOS, FECHA, OBSERVACIONES
          </p>
        </div>

        <!-- Drop Zone -->
        @if (!previewRows().length) {
          <div
            id="drop-zone"
            class="border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer"
            [class.border-blue-400]="isDragging()"
            [class.bg-blue-50]="isDragging()"
            [class.dark:bg-blue-950]="isDragging()"
            [class.border-gray-300]="!isDragging()"
            [class.dark:border-gray-700]="!isDragging()"
            (dragover)="onDragOver($event)"
            (dragleave)="isDragging.set(false)"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            <span class="text-5xl block mb-4">📊</span>
            <h2 class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Arrastra tu archivo Excel aquí
            </h2>
            <p class="text-sm text-gray-400 mb-4">o haz clic para seleccionar</p>
            <span class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium">
              Seleccionar .xlsx
            </span>
            <input #fileInput type="file" accept=".xlsx,.xls" class="hidden"
              (change)="onFileSelected($event)" />
          </div>
        }

        <!-- Preview -->
        @if (previewRows().length > 0 && !result()) {
          <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100
                      dark:border-gray-800 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between p-5 border-b
                        border-gray-100 dark:border-gray-800">
              <div>
                <h2 class="font-semibold text-gray-900 dark:text-white">
                  Vista previa — {{ previewRows().length }} filas detectadas
                </h2>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ validCount() }} válidas, {{ invalidCount() }} con errores
                </p>
              </div>
              <div class="flex gap-3">
                <button type="button"
                  (click)="reset()"
                  class="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                         text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50
                         dark:hover:bg-gray-800 transition-colors">
                  Cancelar
                </button>
                <button
                  id="import-btn"
                  type="button"
                  [disabled]="validCount() === 0 || isImporting()"
                  (click)="startImport()"
                  class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500
                         text-white text-sm font-medium transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed">
                  {{ isImporting() ? 'Importando...' : 'Importar ' + validCount() + ' filas' }}
                </button>
              </div>
            </div>

            <!-- Progress -->
            @if (isImporting()) {
              <div class="px-5 py-3 bg-blue-50 dark:bg-blue-950/50">
                <div class="flex justify-between text-xs text-blue-700 dark:text-blue-300 mb-1">
                  <span>Procesando...</span>
                  <span>{{ progress() }}%</span>
                </div>
                <div class="h-2 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
                  <div class="h-full bg-blue-600 rounded-full transition-all duration-300"
                    [style.width.%]="progress()"></div>
                </div>
              </div>
            }

            <!-- Table -->
            <div class="overflow-x-auto max-h-96">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-gray-50 dark:bg-gray-950">
                  <tr class="border-b border-gray-100 dark:border-gray-800">
                    <th class="text-left py-2 px-4 font-semibold text-gray-500">Estado</th>
                    <th class="text-left py-2 px-4 font-semibold text-gray-500">Concepto</th>
                    <th class="text-left py-2 px-4 font-semibold text-gray-500">Fecha</th>
                    <th class="text-left py-2 px-4 font-semibold text-gray-500">Tipo</th>
                    <th class="text-right py-2 px-4 font-semibold text-gray-500">Monto</th>
                    <th class="text-left py-2 px-4 font-semibold text-gray-500">Pagó</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of previewRows(); track $index) {
                    <tr [class]="row._valid
                      ? 'border-b border-gray-50 dark:border-gray-800/50'
                      : 'border-b bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900'">
                      <td class="py-2 px-4">
                        {{ row._valid ? '✅' : '❌' }}
                      </td>
                      <td class="py-2 px-4 text-gray-900 dark:text-white">
                        {{ row.CONCEPTO ?? '—' }}
                      </td>
                      <td class="py-2 px-4 text-gray-500">{{ row.FECHA }}</td>
                      <td class="py-2 px-4">
                        <span [class]="row._type === TransactionType.Income
                          ? 'text-emerald-600'
                          : 'text-red-600'">
                          {{ row._type === TransactionType.Income ? 'Ingreso' : 'Gasto' }}
                        </span>
                      </td>
                      <td class="py-2 px-4 text-right font-medium text-gray-900 dark:text-white">
                        {{ row._amount | currencyCop }}
                      </td>
                      <td class="py-2 px-4 text-gray-500">{{ row._payer ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Results -->
        @if (result()) {
          <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100
                      dark:border-gray-800 p-8 text-center shadow-sm">
            <div class="text-5xl mb-4">{{ result()!.errors === 0 ? '🎉' : '⚠️' }}</div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Importación completada
            </h2>
            <div class="flex justify-center gap-8 my-6">
              <div class="text-center">
                <p class="text-3xl font-bold text-emerald-600">{{ result()!.success }}</p>
                <p class="text-sm text-gray-500 mt-1">Exitosos</p>
              </div>
              <div class="text-center">
                <p class="text-3xl font-bold text-red-500">{{ result()!.errors }}</p>
                <p class="text-sm text-gray-500 mt-1">Errores</p>
              </div>
            </div>
            @if (result()!.errorDetails.length > 0) {
              <div class="text-left bg-red-50 dark:bg-red-950/30 rounded-xl p-4 mb-6">
                <p class="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">Detalles de errores:</p>
                @for (err of result()!.errorDetails; track err) {
                  <p class="text-xs text-red-600 dark:text-red-400">• {{ err }}</p>
                }
              </div>
            }
            <button type="button" (click)="reset()"
              class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                     text-white font-medium transition-colors">
              Nueva importación
            </button>
          </div>
        }

      </div>
    </div>
  `
})
export class ImportExcelComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly audit = inject(AuditService);
  private readonly toast = inject(ToastService);

  readonly TransactionType = TransactionType;

  readonly isDragging = signal<boolean>(false);
  readonly previewRows = signal<PreviewRow[]>([]);
  readonly isImporting = signal<boolean>(false);
  readonly progress = signal<number>(0);
  readonly result = signal<ImportResult | null>(null);

  readonly validCount = () => this.previewRows().filter(r => r._valid).length;
  readonly invalidCount = () => this.previewRows().filter(r => !r._valid).length;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
  }

  private processFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);
        this.previewRows.set(rows.map(r => this.mapRow(r)));
      } catch {
        this.toast.error('Error al leer el archivo. Verifica que sea un .xlsx válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private mapRow(row: ExcelRow): PreviewRow {
    const income = Number(row.INGRESOS ?? 0);
    const expense = Number(row.GASTOS ?? 0);
    const amount = income > 0 ? income : expense;
    const type = income > 0 ? TransactionType.Income : TransactionType.Expense;
    const obs = row.OBSERVACIONES ?? '';
    const payer = obs.includes('PAGÓ_KEVIN') ? 'Kevin'
      : obs.includes('PAGÓ_ANGELY') ? 'Angely' : null;

    return {
      ...row,
      _payer: payer,
      _type: type,
      _amount: amount,
      _valid: !!(row.CONCEPTO && amount > 0 && row.FECHA),
    };
  }

  async startImport(): Promise<void> {
    const validRows = this.previewRows().filter(r => r._valid);
    const userId = this.supabase.currentUser()?.id ?? '';
    const errorDetails: string[] = [];
    let successCount = 0;

    this.isImporting.set(true);
    this.progress.set(0);

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const dateRaw = row.FECHA;
        const date = dateRaw instanceof Date
          ? dateRaw.toISOString().split('T')[0]
          : String(dateRaw);

        const payload: Partial<Transaction> = {
          user_id: userId,
          concept: row.CONCEPTO ?? '',
          amount: row._amount,
          type: row._type,
          category: CategoryType.Other,
          date,
          notes: row.OBSERVACIONES ?? null,
          portfolio_id: '',
          is_scheduled: false,
          receipt_url: null,
        };

        const [created] = await this.supabase.insert<Transaction>('transactions', payload);
        await this.audit.logAction('IMPORT', 'transactions', created.id, undefined, payload as Record<string, unknown>);
        successCount++;
      } catch {
        errorDetails.push(`Fila ${i + 1}: ${row.CONCEPTO ?? 'Sin concepto'} — error al insertar.`);
      }

      this.progress.set(Math.round(((i + 1) / validRows.length) * 100));
    }

    this.isImporting.set(false);
    this.result.set({ success: successCount, errors: errorDetails.length, errorDetails });
  }

  reset(): void {
    this.previewRows.set([]);
    this.result.set(null);
    this.progress.set(0);
  }
}
