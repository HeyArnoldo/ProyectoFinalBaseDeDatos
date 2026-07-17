# Informe académico en LaTeX

Este directorio contiene el informe técnico derivado de `openspec/`. La redacción presenta la arquitectura y las funciones como una aplicación implementada; las evidencias cuantitativas deben provenir siempre de ejecuciones reproducibles.

## Antes de entregar

1. Complete institución, autores, asignatura, docente, ciudad y fecha en `datos.tex`.
2. Incorpore al capítulo de validación las salidas y mediciones obtenidas de la ejecución final.
3. Incorpore las figuras o capturas finales en `figuras/` y cítelas desde el capítulo correspondiente.
4. Revise que toda afirmación técnica tenga respaldo en una referencia o en evidencia del proyecto.
5. Elimine esta guía del paquete final si la institución solicita únicamente el PDF y sus fuentes.

## Estructura

| Ruta | Contenido |
|---|---|
| `main.tex` | Configuración tipográfica y orden del documento. |
| `datos.tex` | Datos editables de portada. |
| `capitulos/` | Desarrollo académico del informe. |
| `apendices/` | Trazabilidad, API y lista de verificación. |
| `referencias.bib` | Fuentes académicas y documentación oficial en formato BibLaTeX. |
| `build/` | Salida de compilación; no se versiona. |

## Compilación

La opción más simple es importar la carpeta `docs/informe/` en Overleaf y seleccionar `main.tex` como documento principal. El compilador debe ser pdfLaTeX y la bibliografía debe procesarse con Biber.

Con una distribución TeX completa y `latexmk` instalados:

```powershell
latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=build main.tex
```

La secuencia manual equivalente es:

```powershell
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=build main.tex
biber --input-directory=build --output-directory=build main
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=build main.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=build main.tex
```

Los comandos se ejecutan desde `docs/informe/`. La máquina actual no tiene instalados `pdflatex`, `latexmk` ni `biber`; por eso la compilación local requiere instalar TeX Live o MiKTeX, o utilizar Overleaf.

## Criterio académico

El documento usa referencias APA, requisitos identificables, trazabilidad, diagramas propios y un protocolo reproducible de evaluación. Las referencias oficiales sustentan comportamiento de producto; los libros y artículos sustentan las decisiones conceptuales. OpenSpec se trata como fuente interna del diseño, no como prueba de que el sistema ya funciona.
