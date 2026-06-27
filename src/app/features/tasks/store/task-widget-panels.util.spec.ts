import { buildEisenhowerTaskWidgetPanels } from './task-widget-panels.util';
import { Task } from '../task.model';
import { IMPORTANT_TAG, URGENT_TAG } from '../../tag/tag.const';

const mkTask = (id: string, tagIds: string[], isDone = false): Task =>
  ({
    id,
    title: id,
    tagIds,
    projectId: 'p1',
    timeSpentOnDay: {},
    attachments: [],
    timeEstimate: 0,
    timeSpent: 0,
    isDone,
    created: 1,
    subTaskIds: [],
  }) as Task;

describe('buildEisenhowerTaskWidgetPanels', () => {
  it('builds translated desktop widget panels from the default Eisenhower matrix board', () => {
    const tasks = [
      mkTask('both', [URGENT_TAG.id, IMPORTANT_TAG.id]),
      mkTask('important-only', [IMPORTANT_TAG.id]),
      mkTask('urgent-only', [URGENT_TAG.id]),
      mkTask('neither', []),
    ];

    const panels = buildEisenhowerTaskWidgetPanels(tasks, (key) => `translated:${key}`);

    expect(panels.map((panel) => panel.id)).toEqual([
      'URGENT_AND_IMPORTANT',
      'NOT_URGENT_AND_IMPORTANT',
      'URGENT_AND_NOT_IMPORTANT',
      'NOT_URGENT_AND_NOT_IMPORTANT',
    ]);
    expect(panels[0].title).toBe('translated:F.BOARDS.DEFAULT.URGENT_IMPORTANT');
    expect(panels.map((panel) => panel.tasks.map((task) => task.id))).toEqual([
      ['both'],
      ['important-only'],
      ['urgent-only'],
      ['neither'],
    ]);
  });

  it('keeps completed tagged tasks visible and marks them as done', () => {
    const panels = buildEisenhowerTaskWidgetPanels([
      mkTask('done-important', [IMPORTANT_TAG.id], true),
    ]);

    expect(panels[1].tasks).toEqual([
      jasmine.objectContaining({ id: 'done-important', isDone: true }),
    ]);
  });

  it('hides settled completed tasks after their matrix tags are removed', () => {
    const panels = buildEisenhowerTaskWidgetPanels([
      mkTask('settled-done', [], true),
      mkTask('open-neither', [], false),
    ]);

    expect(panels[3].tasks.map((task) => task.id)).toEqual(['open-neither']);
  });
});
