let schedulerRunning = false;

export const isSchedulerRunning = (): boolean => schedulerRunning;
export const setSchedulerRunning = (v: boolean): void => {
  schedulerRunning = v;
};
