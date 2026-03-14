const fs = require('fs');

// Leer el placeholder que SÍ está en el repo
let content = fs.readFileSync('./src/enviroments/enviroment.placeholder.ts', 'utf8');

// Reemplazar placeholders con variables de Vercel
content = content
  .replace('SUPABASE_URL_PLACEHOLDER', process.env.SUPABASE_URL || '')
  .replace('SUPABASE_ANON_KEY_PLACEHOLDER', process.env.SUPABASE_ANON_KEY || '');

// Escribir AMBOS archivos que necesita Angular
fs.writeFileSync('./src/enviroments/enviroment.ts', content);
fs.writeFileSync('./src/enviroments/enviroment.prod.ts', content);

console.log('URL:', process.env.SUPABASE_URL ? 'OK' : 'FALTA');
console.log('KEY:', process.env.SUPABASE_ANON_KEY ? 'OK' : 'FALTA');
