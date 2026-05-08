# K&A Dev Budget — Contexto para Claude Code

## Descripción del proyecto
App de finanzas personales para una pareja (Kevin y Angely).
Stack: Angular 17+ Standalone + Signals + Supabase + Tailwind CSS.

## Usuarios
- **Kevin**: `8864b0dd-7e9c-40e5-a691-b99e535eb2a4` — superadmin — kdealbap@gmail.com
- **Angely**: `88e8ae3b-7264-4a12-8b2a-b72dca73d74f` — partner — angelyacosta1011@gmail.com

## URLs
- **Producción**: https://kyafinbudget-git-prod-kdealbap-7963s-projects.vercel.app
- **Supabase**: https://lzwpfmrmoagnojfnthjo.supabase.co
- **GitHub**: kdealbap-web/kyafinbudget (rama prod)

## REGLAS ABSOLUTAS — NUNCA VIOLAR

1. **NO tocar**: `auth.service.ts`, `auth.guard.ts`, `supabase.service.ts`
2. **NO calcular balances** en Angular — hay triggers en Supabase
3. **Textos** en español latinoamericano
4. **Sin** `window.alert()` / `window.confirm()` — usar `ConfirmDialogService`
5. **Dark mode** obligatorio en todos los componentes
6. **progressBar** en toda petición async: `start()` / `complete()` / `error()`
7. **Sin emojis corruptos** — SVG icons o texto UTF-8
8. **Moneda**: `toLocaleString('es-CO')` — pesos COP
9. **OTP** es 8 dígitos
10. **Login**: email + contraseña simple (sin MFA por ahora)
11. **Mostrar solo diffs** — no archivos completos al modificar

## Stack técnico
```
Angular 17+ Standalone + Signals
Supabase (PostgreSQL + Auth + RLS + Edge Functions)
Tailwind CSS — dark mode clase-based (.dark en <html>)
Chart.js — gráficas
Vercel — despliegue (rama prod)
Brevo — SMTP
```

## Estructura de carpetas
```
src/
├── app/
│   ├── core/
│   │   ├── services/          ← servicios de negocio
│   │   └── guards/
│   ├── features/              ← módulos de la app
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── debts/
│   │   ├── scheduled/
│   │   ├── shared-expenses/
│   │   ├── wedding/
│   │   └── admin/
│   ├── shared/
│   │   ├── components/        ← toast, progress-bar, confirm-dialog
│   │   └── services/
│   └── domain/
│       └── models/
├── assets/
│   └── img/banks/             ← logos bancos {slug}.png
└── enviroments/               ← typo intencional (así está en supabase.service.ts)
    ├── enviroment.ts
    └── enviroment.prod.ts
```

## Patrón estándar de componente
```typescript
@Component({
  selector: 'app-ejemplo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './ejemplo.component.html',
})
export class EjemploComponent implements OnInit {
  private service     = inject(EjemploService);
  private toast       = inject(ToastService);
  private progressBar = inject(ProgressBarService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly items    = this.service.items;
  readonly isLoading = this.service.isLoading;

  async ngOnInit() { await this.service.load(); }

  async delete(id: string) {
    const ok = await this.confirmDialog.confirm({
      title: 'Eliminar', message: '¿Seguro?',
      type: 'danger', confirmLabel: 'Sí, eliminar'
    });
    if (!ok) return;
    this.progressBar.start();
    try {
      await this.service.delete(id);
      this.progressBar.complete();
      this.toast.success('Eliminado correctamente');
    } catch {
      this.progressBar.error();
      this.toast.error('Error al eliminar');
    }
  }
}
```

## Patrón estándar de servicio
```typescript
@Injectable({ providedIn: 'root' })
export class EjemploService {
  private supabase    = inject(SupabaseService);
  private progressBar = inject(ProgressBarService);
  private toast       = inject(ToastService);

  readonly items     = signal<Ejemplo[]>([]);
  readonly isLoading = signal(false);

  async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('tabla')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      this.items.set(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
```
