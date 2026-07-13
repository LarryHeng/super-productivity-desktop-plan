import { EMPTY, Observable } from 'rxjs';
import { Action } from '@ngrx/store';

import { GlobalConfigState } from '../config/global-config.model';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { TaskService } from '../tasks/task.service';
import { WorkContextService } from '../work-context/work-context.service';
import { ShepherdService } from './shepherd.service';
import { SHEPHERD_STEPS, TourId } from './shepherd-steps.const';

describe('SHEPHERD_STEPS', () => {
  it('presents the create-task guide in Chinese', () => {
    const steps = SHEPHERD_STEPS(
      {} as ShepherdService,
      { keyboard: {} } as GlobalConfigState,
      EMPTY as Observable<Action>,
      { isShowAddTaskBar$: EMPTY } as unknown as LayoutService,
      {} as TaskService,
      { mainListTasks$: EMPTY } as unknown as WorkContextService,
    );
    const createTaskStep = steps.find((step) => step.id === TourId.CreateTask);

    expect(createTaskStep?.title).toBe('创建任务');
    expect(createTaskStep?.text).toContain('添加任务栏');
    expect(createTaskStep?.buttons?.[0].text).toBe('打开添加任务栏');
  });
});
