import fs from "node:fs";
const directory = new URL("../docs/performance/", import.meta.url);
const samples = fs
  .readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({
    name,
    ...JSON.parse(fs.readFileSync(new URL(name, directory), "utf8")),
  }));
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rows = [];
const fence = String.fromCharCode(96).repeat(3);
for (const project of ["desktop", "mobile"])
  for (const route of ["home", "catalog"]) {
    const before = samples.find(
      (item) =>
        item.name.startsWith("baseline-") &&
        item.project === project &&
        item.route === route,
    );
    const final = samples.filter(
      (item) =>
        item.name.startsWith("final-") &&
        item.project === project &&
        item.route === route,
    );
    if (
      !before ||
      final.length !== 3 ||
      final.some((item) => !item.deploymentId)
    )
      throw new Error(`Faltan muestras completas para ${project}/${route}`);
    const sec = (value) => (value / 1000).toFixed(2);
    rows.push(
      `| ${project} / ${route} | ${sec(before.lcp)} | ${sec(median(final.map((item) => item.lcp)))} | ${before.cls.toFixed(3)} | ${median(final.map((item) => item.cls)).toFixed(3)} | ${sec(median(final.map((item) => item.fcp)))} | ${median(final.map((item) => item.longTasks)).toFixed(0)} |`,
    );
  }
const text = `# Rendimiento en producción — 9 de octubre de 2026

## Método

URL pública: https://biblioteca-campus-capstone-dpstacks-projects.vercel.app. Chrome instalado y Playwright, un trabajador, página al frente, contexto nuevo por muestra. Inicio y catálogo con Tolkien. Se observa hasta diez segundos después de aparecer la primera tarjeta. Escritorio: 1440×900 sin limitación artificial. Móvil: Pixel 7, latencia 150 ms, descarga 1,6 Mbps, subida 0,75 Mbps y CPU cuatro veces más lenta mediante CDP.

Hay una muestra de referencia por combinación y tres muestras finales; la tabla usa la mediana final. Es una comparación indicativa, no un estudio estadístico controlado. Las API externas, caché de red, navegador y carga de la computadora pueden variar. No se presenta un puntaje Lighthouse ni datos de usuarios reales.

Procedencia de las muestras finales: ${["home", "catalog"].map((route) => `${route}: ${[...new Set(samples.filter((item) => item.name.startsWith("final-") && item.route === route).map((item) => item.deploymentId))].join(", ")}`).join("; ")}. La última revisión separa el inventario del catálogo; la portada conserva el código del despliegue medido anteriormente.

## Resultados

LCP y FCP en segundos. CLS es la suma de desplazamientos sin interacción durante la observación; no implementa ventanas de sesión de toda una visita. Bloqueo suma el exceso sobre 50 ms de tareas largas durante la observación; no es TBT de Lighthouse.

| Pantalla | LCP referencia (1 muestra) | LCP final (mediana de 3) | CLS referencia | CLS final | FCP final | Bloqueo final (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join("\n")}

Las metas de campo de referencia son LCP ≤2,5 s y CLS ≤0,1 para el percentil 75, según [web.dev LCP](https://web.dev/articles/lcp) y [web.dev CLS](https://web.dev/articles/cls). Tres muestras sintéticas no permiten certificar ese percentil ni medir INP real. Un LCP móvil superior a 2,5 s sigue siendo una oportunidad de mejora bajo la limitación utilizada; no se oculta ni se declara rendimiento perfecto.

## Cambios

- SDK Supabase separado de la entrada inicial: se restaura la sesión después de cargar el módulo; rutas privadas esperan la restauración. La entrada y su dependencia estática suman 281,48 KB (91,26 KB gzip), frente a 494,37 KB (145,15 KB gzip) antes de separar autenticación. El SDK diferido añade 214,34 KB (55,09 KB gzip): se reduce el trabajo inicial, no se elimina esa descarga.
- Portadas decorativas M en lugar de L, precarga de la portada principal y preconnect al servidor de portadas. Las imágenes de tarjetas siguen usando lazy.
- Fuentes con display=optional: si tardan, se conserva la fuente de respaldo para evitar intercambio tardío y cambios de geometría. La apariencia puede usar Georgia/Arial en la primera visita con red lenta.
- Encabezado persistente y espacio mínimo del contenido: el pie no aparece arriba mientras se carga una ruta y después se desplaza fuera de pantalla.
- Se eliminó el campo subject de resultados de búsqueda, que no se muestra en tarjetas; los temas de la ficha siguen solicitándose a la obra.
- El catálogo presenta metadatos públicos sin esperar a cargar el SDK y consultar inventario. La disponibilidad se añade al completarse esa consulta independiente.

## Reproducir

En PowerShell, después de npm ci y con Chrome instalado:

${fence}powershell
$env:BASE_URL='https://biblioteca-campus-capstone-dpstacks-projects.vercel.app'
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:PERFORMANCE_AUDIT='1'
$env:AUDIT_LABEL='final'
$env:AUDIT_DEPLOYMENT_ID='${samples.find((item) => item.name.startsWith("final-")).deploymentId}'
npm run test:e2e
node scripts/summarize-performance.mjs
${fence}

Retira PERFORMANCE_AUDIT para volver a la suite funcional. No ejecutes otras suites simultáneamente con la medición. Los resultados crudos, fuentes del LCP, desplazamientos y tiempos están en docs/performance/*.json. baseline corresponde a la referencia, intermediate al despliegue intermedio que reveló el desplazamiento del pie y final a la versión corregida. Cada JSON indica el despliegue. Las capturas audit-* están en docs/screenshots.
`;
fs.writeFileSync(new URL("../docs/PERFORMANCE.md", import.meta.url), text);
process.stdout.write(rows.join("\n") + "\n");
