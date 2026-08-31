import { defineConfig } from 'tsup';

// Configuração de build compartilhada. Nenhuma lógica de produto — apenas empacotamento.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  sourcemap: true,
});
