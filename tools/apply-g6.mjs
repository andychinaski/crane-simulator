/**
 * Additive, idempotent G6 registration. Existing code and history are NOT replaced.
 * Usage from repository root: node tools/apply-g6.mjs
 * The script preflights all expected files before writing any changes.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const marker = '<!-- G6:REGISTERED -->'
const prerequisites = [
  'AGENTS.md', 'docs/SPEC.md', 'docs/ARCHITECTURE.md', 'docs/QA.md',
  '.agent/TASKS.md', '.agent/STATE.md', '.agent/DECISIONS.md',
  'docs/G6_MODES_AND_GUIDE.md', '.agent/G6_IMPLEMENTATION.md',
  'config/g6-route.json',
]
for (const relative of prerequisites) {
  if (!existsSync(resolve(root, relative))) {
    throw new Error(`Missing ${relative}. Unpack G6 files at the CURRENT repository root, then retry.`)
  }
}
const additions = new Map([
  ['AGENTS.md', `## G6 — выбор режима и ручной сценарий

- G1–G5 уже приняты; **не пересоздавай приложение и не переделывай G5**. Источник G6: \`docs/G6_MODES_AND_GUIDE.md\`, инженерный маршрут: \`.agent/G6_IMPLEMENTATION.md\`.
- После любого завершения/пропуска стартового G5 показывай выбор: \`Демонстрация\` или \`Попробовать вручную\` с опциональной галочкой \`С подсказками\`. По принятому G5 стартовое обучение открывается при **каждой** загрузке страницы.
- Приоритет — фактические положения механизмов и состояние груза. Нельзя засчитывать ручной шаг по HTML-input или заданному target; нельзя двигать кран автоматически внутри guided mode.
- Перенеси старые сообщения-подсказки под правые регуляторы; убери Demo/Stop из правой панели, помести действия сценария в верхний правый угол сцены. **Reset сценария и reset камеры — разные операции.**
- Сохрани механику и маршрут G1–G4, принятый внешний вид и G5 onboarding. Выполни регрессию, приложи screenshots \`evidence/G6/\`.
- **G6 — обязательная приёмка:** по итогам проверки статус \`AWAITING_APPROVAL\` и остановка до явного «G6 принято». G7 не начинать; без указания не делать commit/push.`],
  ['docs/SPEC.md', `## G6 — выбор демонстрации и ручного режима

После любого завершения или пропуска G5 — режимный экран с двумя кнопками: \`Демонстрация\` и \`Попробовать вручную\`; для ручного режима чекбокс \`С подсказками\`. Справа под семью регуляторами размещаются сообщения состояния и (в guided mode) зелёная пошаговая карточка с проверкой фактической механики, значком «Выполнено», обратной проверкой после отката и кнопкой \`Далее\`. Demo/Stop убираются из боковой панели и доступны в инструментах сцены; отдельный reset сценария не изменяет reset камеры.

**Нормативный UX/поведенческий контракт:** \`docs/G6_MODES_AND_GUIDE.md\`. Исходные требования G1–G5 не отменяются.`],
  ['docs/ARCHITECTURE.md', `## G6 — orchestration UI без второго движка

Добавить слой выбора режима и типизированное read-only описание шагов ручного обучения. Vue управляет только режимом/подсказками; \`Simulator\` владеет фактическим состоянием приводов, грузом, стартом/стопом demo и reset сценария. \`DemoSequence\` остаётся единственным механизмом автоматической демонстрации. В guide состояние успеха вычисляется по фактическим значениям (actual + cargo), не по DOM-ползункам; действия гайда не подменяют команды оператора. Можно выделить Vue компоненты ModeSelection/GuidedSteps и чистые функции проверки шагов. С G5 onboarding — общий жизненный цикл слоёв без одновременных modal overlays. Не менять render loop/Three.js-геометрию. Контракт: \`docs/G6_MODES_AND_GUIDE.md\`.`],
  ['docs/QA.md', `## G6 — дополнительные критерии R18–R25

| ID | Проверка | Метод |
|---|---|---|
| R18 | После G5 (пропуск, завершение, Escape) показывается режимный экран на каждой загрузке | E2E; G5 repeat-on-load не теряется |
| R19 | Выбор demo запускает действующий маршрут; Stop сохраняет позу/груз | E2E + запись фактической позы |
| R20 | Manual guided: one-step card, 10 действий и явный Next после actual completion | Unit evaluator + E2E route |
| R21 | Revert до Next убирает Completed, запрещает Next; контекстные инварианты после Next | Unit + E2E отклонений |
| R22 | Manual free не показывает guided карточек; обычные статусы работают | E2E |
| R23 | В правой панели нет Demo/Stop; статусы и зелёная карточка под рычагами | Visual screenshots + DOM assertions |
| R24 | Scene action toolbar: Stop/reset сценария/выбрать режим; camera reset независим | E2E |
| R25 | G1–G5 regression, keyboard/accessibility и 1672×941, 1440×900, 1280×720, 390px | npm run check; npm run test:e2e; реальные screenshots |

После проверок вывести доказательства в \`evidence/G6/\`, перевести G6 в \`AWAITING_APPROVAL\`, дождаться решения владельца.`],
  ['.agent/TASKS.md', `## S06 · Режимы и пошаговые подсказки — TODO → G6

- Изучить принятый G5 (обучение при каждой загрузке) и актуальные Vue/Three.js файлы.
- После закрытия G5 добавить \`MODE_SELECT\`: demo / ручной режим с галочкой \`С подсказками\`.
- Убрать Demo/Stop из правой панели; переместить статус/подсказки под регуляторы; добавить сценовый toolbar со Stop, reset сценария и выбором режима.
- Реализовать проверяемый manual guided маршрут из \`config/g6-route.json\`: значения по \`actual\`, условия \`CargoController\`, 10 шагов, \`Completed\`/rollback, ручная кнопка \`Далее\`.
- Гарантировать manual free без карточек и без нежелательного изменения состояния.
- Проверить demo/stop/cargo/camera reset/G5 regression, responsive, keyboard; сохранить реальные снимки в \`evidence/G6/\`.
- **G6 STOP:** \`AWAITING_APPROVAL\` после проверки; G7 не начинать до явного принятия. Полная спецификация: \`docs/G6_MODES_AND_GUIDE.md\`; маршрут работы: \`.agent/G6_IMPLEMENTATION.md\`.`],
  ['.agent/STATE.md', `## Новая итерация — G6 (после принятого G5)

- **Опорная версия:** G1–G5 приняты; G5 влит в \`master\` через PR #1 (merge \`772129d\`). Готовый исходный код не заменять, перед правками сверить \`git status\` и активную ветку.
- **Новая задача:** S06 TODO / G6 PENDING. Создать режимы demo/manual, green guided-route под регуляторами и сценовые действия.
- **G5 актуально:** обучение предлагается при каждой загрузке страницы, без запоминания через localStorage; после завершения/пропуска показывается G6 mode select.
- **Правило:** менять состояние G6 только после фактической реализации и проверки; не проставлять DONE/ACCEPTED до владельца.
- **Следующий шаг:** выполнить \`.agent/G6_IMPLEMENTATION.md\`; после тестов запросить приёмку G6.`],
  ['.agent/DECISIONS.md', `### ADR-016 · G6: сценарный UI поверх принятой механики

**Контекст:** после G5 пользователь должен выбрать демонстрацию или ручное взаимодействие, при необходимости проходить доставку ящика с пошаговым контролем. Статусы должны быть рядом с правыми рычагами.

**Решение:** Vue владеет режимами, карточками и их прогрессом; фактические состояния приводов/груза остаются в существующем Simulator, а \`DemoSequence\` — единственным автоматом. Ручной guide читает actual и проверяет cargo-инварианты, не подставляет управляющие команды. Значения маршрута повторяют принятый G3/G4 сценарий; предельный трос динамический. Demo/Stop переносятся из правой панели в сценовый toolbar, reset сценария не смешивается с reset камеры. При G5 repeat-from-help возвращаемся к прежнему режиму без сброса позы.

**Альтернативы:** новый движок, автозаполнение sliders, постоянный tutorial overlay — отклонены. **Последствия:** нужен read-only snapshot симуляции и дополнительные unit/e2e/визуальные проверки. Детали в \`docs/G6_MODES_AND_GUIDE.md\`.`],
])

// Stage every change in memory; reject incompatible baseline before any write.
const planned = []
for (const [relative, block] of additions) {
  const path = resolve(root, relative)
  const original = readFileSync(path, 'utf8')
  if (original.includes(marker)) {
    console.log(`skip: ${relative} already registered`)
    continue
  }
  let next = original
  if (relative === '.agent/TASKS.md') {
    const lines = next.split(/\r?\n/)
    if (lines.some(line => /^\|\s*G6\s*\|\s*S06\s*\|/i.test(line))) {
      throw new Error('TASKS already has G6 row without registration marker; inspect manually instead of duplicating')
    }
    const g5Index = lines.findIndex(line => /^\|\s*G5\s*\|\s*S05\s*\|/i.test(line))
    if (g5Index < 0) {
      throw new Error('Cannot locate existing G5 gate table row in .agent/TASKS.md; inspect and update manually')
    }
    lines.splice(g5Index + 1, 0, '| G6 | S06 | PENDING | — |')
    next = lines.join('\n')
  }
  next = next.trimEnd() + '\n\n' + marker + '\n' + block + '\n'
  planned.push({ path, relative, content: next })
}
for (const item of planned) {
  writeFileSync(item.path, item.content, 'utf8')
  console.log(`updated: ${item.relative}`)
}
console.log('G6 registered. Inspect git diff; no source code, commit or push performed.')
