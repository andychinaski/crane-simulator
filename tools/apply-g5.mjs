/**
 * Register G5 in current crane-simulator harness without overwriting historical decisions.
 * Run from anywhere: node tools/apply-g5.mjs
 * Idempotent marker-based append; makes no changes to source code or Git.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const documents = [
  'AGENTS.md', 'docs/SPEC.md', 'docs/ARCHITECTURE.md', 'docs/QA.md',
  '.agent/TASKS.md', '.agent/STATE.md', '.agent/DECISIONS.md',
  'docs/G5_ONBOARDING.md', '.agent/G5_IMPLEMENTATION.md',
];
for (const rel of documents) {
  if (!existsSync(resolve(root, rel))) throw new Error(`Required file not found: ${rel}. Unpack G5 archive directly in repository root.`);
}

const marker = '<!-- G5:REGISTERED -->';
function update(rel, edit, block) {
  const path = resolve(root, rel);
  const source = readFileSync(path, 'utf8');
  if (source.includes(marker)) { console.log(`skip: ${rel} already registered`); return; }
  let updated = edit ? edit(source) : source;
  if (updated === null) throw new Error(`Unexpected content in ${rel}. Stopped to protect existing harness.`);
  updated = updated.trimEnd() + '\n\n' + marker + '\n' + block.trim() + '\n';
  writeFileSync(path, updated, 'utf8');
  console.log(`updated: ${rel}`);
}
function replaceStrict(oldValue, newValue) {
  return (text) => text.includes(oldValue) ? text.replace(oldValue, newValue) : null;
}

update('AGENTS.md', text => {
  if (!text.includes('На рубежах G1–G4') || !text.includes('Работа завершена только после G4')) return null;
  return text
    .replace('На рубежах G1–G4', 'На рубежах G1–G5')
    .replace('Работа завершена только после G4, явного принятия пользователем, сохранения рабочего исходного кода и успешного прохождения доступных проверок из `docs/QA.md`. До этого нельзя говорить «проект готов» без квалификации.',
      'Версия G1–G4 уже принята владельцем и считается базовой. Новая итерация G5 завершена только после проверки `docs/G5_ONBOARDING.md`, доступных тестов из `docs/QA.md` и явного «G5 принято». До этого нельзя говорить «G5 готов» без квалификации.');
}, `## Дополнение G5 — onboarding

- Начинай новые задачи с проверки состояния существующей реализации, **не выполняй S00–S04 заново**.
- Читай \`docs/G5_ONBOARDING.md\` и \`.agent/G5_IMPLEMENTATION.md\` перед G5; это расширение, а не замена визуального контракта G1–G4.
- Контрольная точка **G5 обязательна**: после проверки — \`AWAITING_APPROVAL\`, ждать явного подтверждения владельца. Без приёмки G5 не начинать G6.
- Приоритет: неизменность работающего симулятора и интерфейса G1–G4; G5 добавляет только управляемый DOM/UI overlay и помощь пользователю.`);

update('docs/SPEC.md', null, `## 8. Расширение G5 — интерактивное обучение

Добавляется стартовое модальное затемнение с кнопками «Пройти обучение» и «Пропустить обучение», затем три шага подсветки фактических зон: нижняя панель камеры, 3D-сцена, правая панель крана. Возврат к прежнему интерфейсу без изменения симуляции. Повторное обучение через существующую «Справку».

**Полный обязательный UX-контракт и границы G5:** \`docs/G5_ONBOARDING.md\`. Исходные R01–R11 остаются в силе.`);

update('docs/ARCHITECTURE.md', null, `## 9. G5 — презентационный слой обучения

Обучение — только Vue/DOM поверх существующего интерфейса. В текущем \`src/App.vue\` целевые зоны имеют классы \`.viewport\`, \`.camera-panel\` и \`.crane-panel\`. Возможен отдельный \`src/components/OnboardingTour.vue\`, без глобального store, роутера, нового canvas и нового Three.js render loop.

Позиционирование spotlight привязать к реальным DOM-границам и адаптировать к resize; существующие компоненты не переносить/клонировать. В активном туре блокировать управление underlying UI/OrbitControls, а после закрытия гарантированно восстанавливать. Не менять механику крана и демонстрации. Подробности в \`docs/G5_ONBOARDING.md\`.`);

update('docs/QA.md', null, `## Дополнительная трассировка G5

| ID | Требование | Как проверять |
|---|---|---|
| R12 | Первый вход: затемнение + два выбора | Playwright, чистый localStorage, screenshot welcome |
| R13 | Пропуск и закрытие полностью восстанавливают интерфейс | E2E, управляющий ввод после закрытия |
| R14 | Тур из 3 реальных spotlight-зон и пояснений | E2E selectors + screenshots каждой зоны |
| R15 | Навигация назад/далее/завершить, Escape, фокус | E2E и keyboard smoke |
| R16 | Первый выбор запоминается и обучение повторяется из «Справки» | reload + clear storage + повторный запуск |
| R17 | G1–G4 не пострадали; корректный resize | npm run check, npm run test:e2e, визуальная приёмка 3 размеров |

### G5 — интерактивное вводное обучение

Критерии целиком в \`docs/G5_ONBOARDING.md\`. Снять реальные скриншоты \`evidence/G5/welcome-1672x941.png\`, \`scene-1672x941.png\`, \`camera-1672x941.png\`, \`crane-1672x941.png\`; подтвердить видимость и отсутствие обрезки в 1440×900 и 1280×720. Изолировать первоначальное окно onboarding от прежних E2E-кейсов без изменения семантики симулятора. Сначала проверки, затем **G5 AWAITING_APPROVAL**, ждать пользователя.`);

update('.agent/TASKS.md', text => {
  // Insert new pending gate next to historical G4 row in existing table.
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex(line => /^G4\s*\|\s*S04\s*\|/.test(line));
  if (index < 0 || lines.some(line => /^G5\s*\|\s*S05\s*\|/.test(line))) return null;
  lines.splice(index + 1, 0, 'G5 | S05 | PENDING | —');
  return lines.join('\n');
}, `## S05 · Интерактивное обучение — TODO → G5

- Реализовать затемнение приложения с выбором \`Пройти обучение\` / \`Пропустить обучение\`.
- Реализовать 3 spotlight-шага по \`.viewport\`, \`.camera-panel\`, \`.crane-panel\` и соответствующие подсказки, навигацию и выход.
- Сохранить первый выбор в localStorage, предусмотреть повторное обучение из существующей «Справки».
- Не изменять логику крана, груза и демонстрации; проверить регрессии G1–G4.
- Прогнать typecheck/unit/build/E2E, визуально проверить 1672×941, 1440×900, 1280×720, приложить \`evidence/G5/\`.
- **ОСТАНОВКА G5**: после проверок \`AWAITING_APPROVAL\`, ждать явного «G5 принято», только потом отмечать \`DONE\`/\`ACCEPTED\`. Без перехода к G6.

Детальная постановка: \`docs/G5_ONBOARDING.md\`. Технический маршрут: \`.agent/G5_IMPLEMENTATION.md\`.`);

update('.agent/STATE.md', text => text.replace('Рабочая папка без Git-репозитория.', 'Git-репозиторий опубликован на GitHub; локальный git status проверять перед новой работой.'), `## Следующая итерация — G5

- Текущий статус: \`S05 TODO / G5 PENDING\`, ещё **не реализован и не принят**.
- Цель: стартовое интерактивное обучение и подсветка трёх областей, повторный запуск через «Справку».
- Источник: \`docs/G5_ONBOARDING.md\`, маршрут \`.agent/G5_IMPLEMENTATION.md\`.
- G1–G4 остаются принятой базой. Следующее действие: реализовать S05 и предъявить владельцу G5 для приёмки.
- Не начинать G6 до явной приёмки G5.`);

update('.agent/DECISIONS.md', text => text.includes('ADR-014') && !text.includes('ADR-015') ? text : null, `### ADR-015 · G5 как отдельный UI-слой (новая итерация)

Ситуация: к принятой WebGL-сцене добавляется короткий onboarding со стартовым выбором и подсветкой трёх существующих секций.

Решение: реализация только в Vue/DOM без перезапуска WebGL и без изменения кинематики. Не клонировать и не переставлять canvas и панели. После пропуска/завершения вернуть управление без сброса состояния. Выбранный реализационный default — показать автоматически до первого выбора и сохранить его в localStorage; повторный запуск — через «Справку».

Альтернативы: отдельная страница, 3D-копии элементов, полная система интерактивных заданий — отвергнуты как избыточные. Последствия: нужен стабильный overlay, позиционирование spotlight при resize, keyboard/E2E-проверки.

Источник идеи и трёх зон: владелец. Детали localStorage/повторного запуска — обратимые проектные defaults до приёмки G5.`);

console.log('G5 registered. Review git diff and continue with START_G5.txt.');
