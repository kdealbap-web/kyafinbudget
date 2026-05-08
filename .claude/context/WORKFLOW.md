# Flujos de trabajo — K&A Dev Budget

## Cómo trabajar con Claude Code en este proyecto

### 1. Antes de cualquier cambio
```bash
# Verificar estado del repo
git status
git log --oneline -5

# Asegurarte de estar en la rama correcta
git checkout prod

# Sincronizar con remoto
git pull origin prod
```

### 2. Ciclo de desarrollo
```bash
# Servidor de desarrollo
ng serve

# Abrir en: http://localhost:4200
# DevTools abierto en la pestaña Console y Network
```

### 3. Antes de hacer push
```bash
# Verificar que compila sin errores
ng build --configuration production

# Si hay errores de presupuesto de bundle
# En angular.json → budgets → aumentar maximumError a "5mb"
```

### 4. Deploy a producción
```bash
git add .
git commit -m "tipo: descripción clara del cambio"
git push origin prod
# Vercel redespliega automáticamente en 2-4 minutos
```

### Tipos de commit
```
feat:  nueva funcionalidad
fix:   corrección de bug
style: cambios visuales sin lógica
refactor: reorganización de código
chore: configuración, dependencias
```

---

## Comandos frecuentes

### Angular
```bash
# Servidor desarrollo
ng serve

# Build producción
ng build --configuration production

# Generar componente standalone
ng generate component features/nuevo --standalone --skip-tests

# Generar servicio
ng generate service core/services/nuevo --skip-tests

# Verificar compilación TypeScript
npx tsc --noEmit
```

### Git
```bash
# Ver cambios
git diff

# Agregar solo archivos específicos
git add src/app/features/dashboard/

# Revertir cambio en un archivo
git checkout -- src/app/features/dashboard/dashboard.component.ts

# Ver historial visual
git log --oneline --graph -10
```

### Supabase
```bash
# Ver logs de auth (desde navegador)
# https://supabase.com/dashboard/project/lzwpfmrmoagnojfnthjo/auth/logs

# SQL Editor
# https://supabase.com/dashboard/project/lzwpfmrmoagnojfnthjo/sql/new
```

---

## Cómo debuggear problemas comunes

### Error de Supabase en consola
```typescript
// Siempre loggear el error completo
const { data, error } = await supabase.from('tabla').select('*');
if (error) {
  console.error('Supabase error:', error.code, error.message, error.details);
  throw error;
}
```

### Signal no actualiza la vista
```typescript
// Con ChangeDetectionStrategy.OnPush verificar:
// 1. Que el signal se actualiza con .set() o .update()
// 2. Que no se muta el array/objeto directamente
// ❌ MAL
this.items().push(newItem);
// ✅ BIEN
this.items.update(list => [...list, newItem]);
```

### Pipe currency falla
```typescript
// Verificar que locale está registrado en main.ts
// y LOCALE_ID en app.config.ts
// Ver FIX-01 en BUGS.md
```

### Dark mode no aplica
```typescript
// Verificar que HTML tiene la clase .dark
document.documentElement.classList.contains('dark') // debe ser true en dark mode

// Verificar localStorage
localStorage.getItem('f360-theme') // debe ser 'dark' o 'light'
```

### 404 en assets
```bash
# Verificar que el archivo existe
ls src/assets/img/banks/

# Verificar que angular.json incluye assets
# "assets": ["src/favicon.ico", "src/assets"]

# Probar URL directa
# http://localhost:4200/assets/img/banks/bancolombia.png
```

---

## Checklist antes de hacer commit

```
[ ] ng serve sin errores en consola
[ ] ng build --configuration production exitoso
[ ] Dark mode funciona correctamente
[ ] Mobile responsive (pb-24 en listas)
[ ] Sin window.alert() ni window.confirm()
[ ] progressBar en todas las peticiones async
[ ] Textos en español latinoamericano
[ ] Sin console.log() de debug en el código
[ ] Solo diffs — no archivos completos duplicados
```

---

## Variables de entorno

### Local (src/enviroments/enviroment.ts) — en .gitignore
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://lzwpfmrmoagnojfnthjo.supabase.co',
  supabaseAnonKey: 'tu_anon_key'
};
```

### Producción (Vercel)
```
SUPABASE_URL      = https://lzwpfmrmoagnojfnthjo.supabase.co
SUPABASE_ANON_KEY = tu_anon_key
```

El script `replace-env.js` inyecta estas variables en
`enviroment.placeholder.ts` durante el build de Vercel.

---

## Configuración de Vercel

```
Rama:             prod
Build Command:    node replace-env.js && npm run build -- --configuration production
Output Directory: dist/finanzas360/browser
Install Command:  npm install
```

**PROBLEMA CONOCIDO:** `kyafinbudget.vercel.app` apunta a `main` (vacío).
**SOLUCIÓN:** Vercel → Deployments → último deploy prod → Promote to Production.

---

## SMTP — Brevo

```
Host:     smtp-relay.brevo.com
Port:     587
Username: a5199c001@smtp-brevo.com
Sender:   kdealbap@gmail.com
```

**PROBLEMA:** emails van a spam sin dominio verificado.
**SOLUCIÓN PENDIENTE:** comprar dominio .site en Namecheap (~$1 USD)
y verificar en Brevo → `https://app.brevo.com/senders/domain/list`

---

## Cómo usar Claude Code efectivamente

### Para corregir un bug
```
1. Leer BUGS.md → identificar el FIX correspondiente
2. Abrir el archivo afectado en VS Code
3. Pedirle a Claude Code: "Aplica el FIX-XX de BUGS.md en este archivo"
4. Revisar el diff propuesto
5. Testear en http://localhost:4200
6. Hacer commit si funciona
```

### Para agregar un feature nuevo
```
1. Leer MODULES.md → ver el módulo pendiente
2. Ejecutar primero el SQL en Supabase
3. Pedirle a Claude Code: "Crea el servicio para saving-goals según MODULES.md"
4. Luego: "Crea el componente lista para saving-goals"
5. Luego: "Crea el formulario para saving-goals"
6. Agregar la ruta en app.routes.ts
7. Agregar al sidebar en sidebar.component.ts
```

### Para problemas visuales
```
1. Abrir el componente afectado
2. Referenciar DESIGN-SYSTEM.md
3. Pedirle: "Corrige el dark mode en este componente
   usando las clases del DESIGN-SYSTEM.md"
```

### Prompt base para Claude Code
```
Contexto del proyecto en CLAUDE.md.
Design system en DESIGN-SYSTEM.md.
Base de datos en SUPABASE.md.
Bugs en BUGS.md.
Módulos pendientes en MODULES.md.

[Tu solicitud específica aquí]

IMPORTANTE: mostrar solo diffs. No el archivo completo.
```
