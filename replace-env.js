const fs = require('fs');

let content = fs.readFileSync('./src/enviroments/enviroment.prod.ts', 'utf8');

content = content
  .replace('SUPABASE_URL_PLACEHOLDER', process.env.SUPABASE_URL || '')
  .replace('SUPABASE_ANON_KEY_PLACEHOLDER', process.env.SUPABASE_ANON_KEY || '');

fs.writeFileSync('./src/enviroments/enviroment.prod.ts', content);
console.log('Variables reemplazadas:', 
  'URL=' + (process.env.SUPABASE_URL ? 'OK' : 'FALTA'),
  'KEY=' + (process.env.SUPABASE_ANON_KEY ? 'OK' : 'FALTA')
);
