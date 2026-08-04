/**
 * 스케줄러가 뛰는 간격. `schedule-scheduler`(서버 전용, `node:fs`·게시 코드를 끌고 온다)와
 * `scheduler-health` 가 **같은 값**을 써야 해서 따로 뺐다 — 한쪽이 다른 쪽을 import 하면
 * 맥박만 읽고 싶은 곳까지 게시 코드가 딸려 온다.
 */
export const TICK_MS = 60 * 1000;
