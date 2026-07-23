<div align="center">

# Agent Reflection

[English](README.md) · [Русский](README.ru.md) · **Español**

**Auditoría de sesiones local-first y recomendaciones de flujo de trabajo para agentes en [Claude Code](https://claude.com/claude-code).**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org)
[![Offline](https://img.shields.io/badge/network-zero%20requests-blue.svg)](#garantías-de-privacidad)

</div>

Agent Reflection observa tus sesiones de agente de programación a través de los
hooks de Claude Code, almacena **telemetría local respetuosa con la privacidad**,
detecta flujos de trabajo ineficientes del agente y produce recomendaciones
basadas en evidencia después de cada sesión.

```text
[███░░░░░░░] 32% 65K · ↻ 521K
```

---

## Contenido

- [Por qué](#por-qué)
- [Qué es — y qué no es](#qué-es--y-qué-no-es)
- [Instalación](#instalación)
- [Uso del CLI](#uso-del-cli)
- [Cómo funcionan los informes](#cómo-funcionan-los-informes)
- [Agentes incluidos](#agentes-incluidos)
- [Leer el informe desde Claude Code](#leer-el-informe-desde-claude-code)
- [Medidor de contexto en la statusline](#medidor-de-contexto-en-la-statusline)
- [Garantías de privacidad](#garantías-de-privacidad)
- [Eliminar todos los datos locales](#eliminar-todos-los-datos-locales)
- [Limitaciones](#limitaciones)

## Por qué

Una sesión termina, el contexto ha crecido hasta el 80% y no tienes ni idea de
qué se lo comió. ¿Las veinte lecturas de archivos antes de la primera edición?
¿El test que falló seis veces seguidas? ¿La compactación de la mitad del camino?

Y la factura no es lineal: cada petición reenvía toda la conversación, así que un
volcado de archivos basura al principio se sigue pagando en cada turno posterior.
El coste crece con el *cuadrado* de la duración de la sesión: el ruido eliminado
pronto vale mucho más que el ruido eliminado tarde.

Agent Reflection es un **bucle de retroalimentación para quien desarrolla, no
para el modelo**: un post-mortem breve y basado en evidencia de tu propia sesión
—a dónde fueron los tokens, qué partes fueron caras, cuáles de ellas podría haber
absorbido un subagent barato de solo lectura— escrito localmente, sin que ningún
prompt ni código salga de la máquina.

## Qué es — y qué no es

Agent Reflection te ayuda a reducir el **coste total del trabajo exitoso**, no
simplemente el número de tokens. Fomenta un flujo de trabajo sencillo:

1. Usa un modelo barato para exploración acotada de solo lectura.
2. Usa un modelo estándar para implementaciones bien delimitadas.
3. Escala a un modelo de razonamiento más potente solo cuando la evidencia lo
   justifique.
4. Mantén las operaciones ruidosas fuera de la ventana de contexto principal.

> [!IMPORTANT]
> **Esto no es un optimizador de modelos garantizado.** Agent Reflection nunca
> afirma conocer el modelo universalmente óptimo, ni afirma que un modelo
> distinto *habría* producido un resultado más barato o mejor. Solo expone
> **señales observables** —exploración de solo lectura en el contexto principal,
> bucles de fallos repetidos, presión de contexto y segmentos de exploración
> acotada— y presenta cada recomendación como una candidata para que tú la
> juzgues.

Todo se ejecuta **completamente offline** después de la instalación. Agent
Reflection no hace ninguna petición de red y no envía a ningún sitio código,
prompts, salida de herramientas, telemetría ni metadatos del repositorio.

## Instalación

**Requisitos:** Node.js 22+, pnpm, Claude Code.

El repositorio funciona además como marketplace de Claude Code
(`.claude-plugin/marketplace.json`), así que se instala directamente desde GitHub
—sin ningún registro de por medio—. `dist/` está versionado, así que no hay nada
que compilar.

### Instalación rápida

Pega esto en una sesión de Claude Code —cualquier repositorio, cualquier
`CLAUDE_CONFIG_DIR`— y deja que el agente haga la instalación por ti:

````text
Install the "agent-reflection" Claude Code plugin
(https://github.com/mikhkonkov/agent-reflection) for me:

1. Determine my Claude config directory: use $CLAUDE_CONFIG_DIR if that env
   var is set, otherwise default to ~/.claude. Use this directory for every
   path below.

2. Run:
   claude plugin marketplace add mikhkonkov/agent-reflection
   claude plugin install agent-reflection@agent-reflection --scope user

3. Hooks run from the version-scoped plugin cache, which ships without
   node_modules. Find the newest directory under
   <config-dir>/plugins/cache/agent-reflection/agent-reflection/ and run:
   pnpm install --prod --dir <that-directory>

4. The CLI lives in a separate copy, the marketplace clone at
   <config-dir>/plugins/marketplaces/agent-reflection, which needs its own
   dependencies:
   pnpm install --prod --dir <config-dir>/plugins/marketplaces/agent-reflection

5. Optionally symlink the CLI onto my PATH (ask which directory, default
   ~/.local/bin):
   ln -sf <config-dir>/plugins/marketplaces/agent-reflection/dist/cli/index.js \
     <path-on-PATH>/agent-reflection

6. Verify with `claude plugin list` that agent-reflection loaded.

7. `agent-reflection init` prompts interactively (storage setup, optional
   statusline), so it needs a real TTY. Don't run it yourself — tell me to run
   it in my own terminal, in each repository I want observed.

8. Tell me to restart Claude Code so the hooks take effect.

If any step fails or an expected path doesn't exist, stop and show me the
error instead of guessing.
````

### Instalación manual

```bash
claude plugin marketplace add mikhkonkov/agent-reflection
claude plugin install agent-reflection@agent-reflection --scope user

# runtime dependencies for the installed copy (better-sqlite3 is native).
# Hooks run from the version-scoped plugin cache, not from the marketplace clone:
pnpm install --prod --dir \
  "$(ls -d ~/.claude/plugins/cache/agent-reflection/agent-reflection/*/ | tail -1)"
```

Sin ese paso, los hooks no encuentran `better-sqlite3`, no registran nada y salen
con `0` en silencio; por eso hay que repetirlo después de cada actualización del
plugin, que instala en un nuevo directorio de versión.

Reinicia Claude Code después para que los hooks se carguen.

Para tener el CLI `agent-reflection` en tu `PATH`, enlázalo desde el clon del
marketplace. Ese clon es una **segunda copia**, distinta de la caché del plugin
anterior, así que necesita sus propias dependencias:

```bash
pnpm install --prod --dir ~/.claude/plugins/marketplaces/agent-reflection

ln -sf ~/.claude/plugins/marketplaces/agent-reflection/dist/cli/index.js \
  ~/.local/bin/agent-reflection
```

Si te saltas el `pnpm install`, el CLI muere con `Cannot find package 'commander'`
mientras los hooks siguen funcionando sin problema: las dos copias fallan de
forma independiente.

Sirve cualquier directorio que esté en tu `PATH`; `~/.local/bin` es solo un valor
por defecto habitual.

Después, en cada repositorio que quieras observar:

```bash
agent-reflection init
```

Esto es opcional: el almacenamiento se crea automáticamente en la primera sesión
de un repositorio. `init` solo escribe el archivo de configuración por adelantado
y ofrece instalar la statusline (`--statusline` / `--skip-statusline` para
responder de forma no interactiva).

Verifícalo con `claude plugin list`.

<details>
<summary>Si ejecutas Claude Code con un <code>CLAUDE_CONFIG_DIR</code> personalizado</summary>

Los plugins se instalan por directorio de configuración. Un perfil aparte —por
ejemplo, un alias de shell que define `CLAUDE_CONFIG_DIR=~/.claude-work`— tiene su
propia lista de plugins, y una instalación en `~/.claude` le resulta invisible: la
skill y los hooks nunca aparecen.

Exporta la misma variable y luego ejecuta la instalación con las rutas ajustadas:

```bash
export CLAUDE_CONFIG_DIR=~/.claude-work

claude plugin marketplace add mikhkonkov/agent-reflection
claude plugin install agent-reflection@agent-reflection --scope user
pnpm install --prod --dir \
  "$(ls -d "$CLAUDE_CONFIG_DIR"/plugins/cache/agent-reflection/agent-reflection/*/ | tail -1)"
```

El enlace simbólico del `PATH` sigue la misma regla: el clon del marketplace vive
también bajo ese directorio de configuración:

```bash
pnpm install --prod --dir "$CLAUDE_CONFIG_DIR"/plugins/marketplaces/agent-reflection

ln -sf "$CLAUDE_CONFIG_DIR"/plugins/marketplaces/agent-reflection/dist/cli/index.js \
  ~/.local/bin/agent-reflection
```

Un solo enlace simbólico basta sin importar cuántos directorios de configuración
tengas; cualquier clon sirve el mismo CLI, siempre que ese clon tenga sus
dependencias instaladas.

Repítelo para cada directorio de configuración que uses. Si `claude plugin list`
informa `✘ failed to load … not found in marketplace`, ese directorio de
configuración conserva una entrada obsoleta: elimina el plugin y su marketplace y
vuelve a instalar.

</details>

> [!NOTE]
> `claude plugin marketplace update agent-reflection` descarga una versión nueva;
> vuelve a ejecutar siempre después la línea de `pnpm install --prod`: la
> actualización aterriza en un directorio de versión nuevo y vacío dentro de la
> caché del plugin.

> [!NOTE]
> `better-sqlite3` es un módulo nativo. Si tu versión de Node no tiene binario
> precompilado, pnpm lo compila desde el código fuente (los scripts de build están
> en la lista permitida de `package.json`). Ante un error "Could not locate the
> bindings file", ejecuta `pnpm rebuild better-sqlite3`.

### Desinstalación

```bash
claude plugin uninstall agent-reflection@agent-reflection --scope user --yes
claude plugin marketplace remove agent-reflection
```

Desinstalar el plugin detiene toda la recolección.

### Hooks

Los hooks se registran en `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse`, `SubagentStop`, `PreCompact` y `SessionEnd`. Cada evento ejecuta
`hooks/hook-router.mjs`, que lee el JSON del hook por stdin, lo normaliza en un
evento respetuoso con la privacidad y lo persiste localmente. El router **siempre
sale con `0`**, de modo que un problema de telemetría nunca puede bloquear a
Claude Code ni a una llamada de herramienta.

## Uso del CLI

```bash
agent-reflection init                              # create local storage + config
agent-reflection report latest                     # print the most recent session report
agent-reflection report current                    # the session in progress right now
agent-reflection report previous                   # the last session that finished
agent-reflection report <session-id>               # print a specific report
agent-reflection sessions                          # list recent sessions
agent-reflection sessions --repo .                 # scope to the current repository
agent-reflection stats --days 30                   # aggregate stats (no cost estimates)
agent-reflection config show
agent-reflection config set privacy.storeRawPayloads false
```

## Cómo funcionan los informes

En `SessionEnd`, Agent Reflection:

1. Carga todos los eventos de la sesión.
2. Construye métricas agregadas deterministas.
3. Ejecuta cinco comprobaciones locales basadas en reglas.
4. Guarda las recomendaciones y escribe un informe Markdown en
   `.agent-reflection/reports/<YYYY-MM-DD>-<session-id>.md`.
5. Opcionalmente imprime un resumen de una línea.

| Regla | Señal |
|---|---|
| `excessive-main-context-exploration` | Mucho descubrimiento de solo lectura en el contexto principal |
| `repeated-execution-failure` | Un bucle de edición → fallo de ejecución |
| `model-escalation-candidate` | Un bucle improductivo que puede justificar un diagnóstico independiente |
| `context-pressure` | Compactación y/o gran volumen de salida observada |
| `cheap-subagent-candidate` | Un segmento de exploración acotada de solo lectura |

Los informes son **deterministas**: eventos de entrada idénticos producen un
cuerpo de informe byte a byte idéntico.

## Agentes incluidos

Tres subagents codifican el enrutamiento que esta herramienta fomenta:

| Agente | Modelo | Propósito |
|---|---|---|
| `explore-cheap` | Haiku, solo lectura | Localizar archivos, seguir rutas de código, resumir módulos, recopilar evidencia. Sin ediciones, sin Bash. |
| `implement-standard` | Sonnet | Implementación bien delimitada, con validación estrecha y cambios mínimos. |
| `architect-escalation` | Opus, solo lectura | Diagnóstico independiente de fallos repetidos, arquitectura ambigua, migraciones, concurrencia o depuración difícil *antes* de seguir editando. |

Agent Reflection nunca lanza un subagent ni cambia la configuración por su
cuenta; las skills siempre preguntan primero.

## Leer el informe desde Claude Code

No hace falta salir de la sesión para ver el resultado. Ejecuta la skill incluida
al final de una:

```text
/agent-reflection:agent-reflection-report
```

Carga el último informe y repasa las principales recomendaciones con su evidencia
—el mismo contenido que `agent-reflection report latest`, pero en contexto, donde
puedes hacer preguntas de seguimiento sobre un hallazgo.

## Medidor de contexto en la statusline

El informe te dice a dónde fueron los tokens *después* de la sesión; la
statusline te lo dice **mientras todavía está ocurriendo**. De otro modo, el
crecimiento del contexto es invisible: nada te avisa hasta que Claude Code
compacta, descarta la primera mitad de la conversación y el agente vuelve a leer
archivos que ya conocía:

```text
[███░░░░░░░] 32% 65K · ↻ 521K
```

Barra de llenado, porcentaje de la ventana de contexto en uso, tokens que hay
actualmente en ella y, tras `↻`, el total de la sesión incluyendo todo lo que ya
se ha compactado.

Verde por debajo del 60%, amarillo hasta el 85%, rojo por encima: la franja en la
que la compactación se vuelve probable. El amarillo es la señal para actuar mientras
aún tienes margen: termina el hilo actual, delega la siguiente exploración a un
subagent barato de solo lectura o empieza una sesión nueva en lugar de dejar que
una compactación decida qué se olvida.

Mientras hay subagents en ejecución, cada fila del panel de agentes recibe su
propio medidor, referido al contexto de ese agente y no al principal:

```text
explore-cheap        [██░░░░░░░░] 18% 36K · locate auth middleware
architect-escalation [█████████░] 85% 170K · diagnose repeated failure
```

Las **filas de subagents se instalan solas** con el plugin (`settings.json` →
`subagentStatusLine`). La **statusline principal no puede ser registrada por un
plugin** en Claude Code —vive en tu propio archivo de configuración—, así que el
plugin la menciona **una vez**, en la primera sesión de un repositorio, y solo la
configura si dices que sí:

```bash
agent-reflection init                    # asks before touching your settings
agent-reflection init --statusline       # install it, no prompt (scripts, CI)
agent-reflection init --skip-statusline  # leave the statusline alone

agent-reflection config set statusline.promptOnSessionStart false   # never ask
```

Una `statusLine` existente no se pisa: se traslada a
`AGENT_REFLECTION_STATUSLINE_CHAIN`, se renderiza como prefijo y se restaura al
desinstalar. Los scripts se copian en `~/.claude/agent-reflection/statusline/` y
`statusLine` apunta a esa copia, de modo que mover o borrar el checkout no rompe
el medidor.

Son bash + awk puros (`statusline/`), porque una statusline se vuelve a renderizar
constantemente y el arranque de node es latencia visible. Las lecturas provienen
de los campos `context_window` que Claude Code pasa por stdin —los mismos números
que `/context`—, con un respaldo que analiza el transcript en versiones antiguas.

## Garantías de privacidad

Por defecto, Agent Reflection **nunca persiste**: el texto completo de los
prompts, la entrada completa de las herramientas, la salida completa de las
herramientas, el código fuente, la salida de terminal o de tests, valores de
entorno, secretos, claves de API, rutas absolutas completas ni URLs externas.

Solo almacena telemetría agregada y no sensible: id de sesión, un identificador
hasheado del repositorio, el nombre base del repositorio, el nombre de la rama, el
nombre del evento, marcas de tiempo, el nombre y la clasificación de la
herramienta, indicadores de éxito, **longitudes en caracteres** de entrada/salida,
duraciones, rutas relativas (solo cuando se pueden derivar con seguridad de
`cwd`), recuentos de rutas, categorías de error normalizadas, el ciclo de vida de
los subagents, los disparadores de compactación y un **hash** SHA-256 de cada
prompt (nunca su texto).

El almacenamiento de payloads en bruto existe únicamente como una opción
explícitamente desactivada por defecto (`privacy.storeRawPayloads`,
`privacy.storePromptText`, `privacy.storeToolOutput` —todas en `false`). Incluso
cuando está activada, los posibles secretos (claves de API, bearer tokens, claves
privadas, contraseñas, asignaciones de entorno `KEY=value`) se redactan antes de
escribir nada.

### Disposición del almacenamiento

Local al repositorio cuando hay permiso de escritura:

```text
<repository-root>/.agent-reflection/
├── agent-reflection.db        # SQLite database
├── config.json
├── events/<session-id>.jsonl
└── reports/<YYYY-MM-DD>-<session-id>.md
```

En caso contrario, un respaldo por repositorio indexado por un SHA-256 estable de
la ruta absoluta del repositorio (la ruta en sí nunca se guarda en el nombre del
directorio):

```text
~/.agent-reflection/projects/<repository-hash>/
```

## Eliminar todos los datos locales

Todos los datos son locales. Para borrarlos:

```bash
rm -rf .agent-reflection                        # repository-local storage
rm -rf ~/.agent-reflection/projects/<hash>      # fallback storage for a repo
rm -rf ~/.agent-reflection                      # every project's fallback storage
```

## Limitaciones

- **Las recomendaciones son heurísticas, no veredictos.** Señalan patrones
  observables; no demuestran que otro modelo u otra ruta habrían sido mejores.
- **La contabilidad de tokens a dólares se omite intencionadamente.** Los tamaños
  se miden en caracteres/bytes de la entrada/salida observada, no en tokens
  facturados.
- **Mapeo de hooks.** El Claude Code real no expone `PostToolUseFailure` ni un
  hook de inicio de subagent. Agent Reflection deriva el *fallo* de una
  herramienta a partir de los payloads de `PostToolUse` y trata una invocación
  `Task` en `PreToolUse` como señal de inicio de subagent. Son señales derivadas y
  pueden variar entre versiones de Claude Code.
- Los "turnos" estimados son una heurística documentada (`prompts + main-agent
  tool calls`), no un recuento exacto de turnos de conversación.
- **Sin bucle de retroalimentación de resultados.** Cada regla es una heurística
  puntuada solo a partir de la forma de la sesión; nada registra si el trabajo
  realmente salió bien, así que una sesión ruidosa pero exitosa se ve igual que
  una atascada. Las etiquetas manuales de resultado (`accepted` / `rework` /
  `failed`) llegaron a existir y fueron eliminadas: nadie hace la tarea de
  etiquetar sesión por sesión, así que los datos nunca estaban ahí cuando las
  reglas los necesitaban. Habrá que retomarlo como resultado **inferido**: un
  commit después de la sesión, la siguiente sesión reabriendo los mismos
  archivos, fallos agrupados al final. La columna sin usar
  `sessions.user_outcome` se conserva para eso.
- Solo se admite Claude Code, no Cursor, Codex, Windsurf ni otros CLIs.
- Sin nube, sin panel de control, sin autenticación, sin cambio automático de
  modelo y sin cambios automáticos de código ni ejecución automática de
  subagents.

## Contribuir

La configuración de desarrollo, el ciclo de vida del plugin con `Makefile` y los
flags del instalador de la statusline están en [CLAUDE.md](./CLAUDE.md).

## Licencia

MIT — ver [LICENSE](./LICENSE).
