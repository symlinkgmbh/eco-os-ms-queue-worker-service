/**
 * Copyright 2018-2020 Symlink GmbH
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 */




import { IJobWorker } from "./IJobWorker";
import { injectable, inject } from "inversify";
import { IJobReducer } from "../jobReducer";
import { WORKERTYPES } from "../workerTypes";
import util from "util";
const setTimeoutPromise = util.promisify(setTimeout);
import { IJobs } from "../../models";
import { Log, LogLevel } from "@symlinkde/eco-os-pk-log";
import { injectQueueClient, dynamicClientContainer, ECO_OS_PK_CORE_TYPES } from "@symlinkde/eco-os-pk-core";
import { PkCore, PkHttp, MsQueue } from "@symlinkde/eco-os-pk-models";
import { StaticJobUtils } from "../jobUtils";

@injectQueueClient
@injectable()
export class JobWorker implements IJobWorker {
  private queueClient!: PkCore.IEcoQueueClient;
  private jobReducer: IJobReducer;
  private dynamicClient: PkCore.IDynamicClient;

  public constructor(@inject(WORKERTYPES.IJobReducer) reducer: IJobReducer) {
    this.jobReducer = reducer;
    this.dynamicClient = dynamicClientContainer.get<PkCore.IDynamicClient>(ECO_OS_PK_CORE_TYPES.IDynamicClient);
  }

  public async initWorkerLoop(): Promise<void> {
    Log.log("load jobs from queue", LogLevel.info);
    Log.log("resolve holding", LogLevel.info);
    try {
      const jobs = await this.jobReducer.getFilteredJobs();
      if (jobs.length > 0) {
        this.process(jobs[0]);
      } else {
        const delay = StaticJobUtils.getArtificiallyDelay();
        Log.log(`check for new jobs in ${delay} milliseconds`, LogLevel.warning);
        await setTimeoutPromise(delay);
        this.initWorkerLoop();
      }
    } catch (err) {
      Log.log(err, LogLevel.error);
      Log.log("retry connection to queue service", LogLevel.warning);
      await setTimeoutPromise(1000);
      this.initWorkerLoop();
    }
  }

  private async process(job: IJobs): Promise<void> {
    await this.updateJobStatus(job, MsQueue.QueueStates.processing);

    Log.log(`process job ${job.id}`, LogLevel.info);
    await setTimeoutPromise(500);

    if (job.status === MsQueue.QueueStates.failover) {
      Log.log("execute failover job", LogLevel.info);
      const failoverClient = await this.processTarget(job.failover.target);

      if (failoverClient === null) {
        await this.queueClient.updateJob(job.id, {
          status: MsQueue.QueueStates.crashed,
          trace: `can´t resolve ${job.failover.target}`,
        });
        this.initWorkerLoop();
        return;
      }
      Log.log("wait 1s before try again", LogLevel.info);
      await setTimeoutPromise(1000);
      await this.executeFailoverJob(failoverClient, job);
      this.initWorkerLoop();
      return;
    }

    const client = await this.processTarget(job.job.target);
    if (client === null) {
      await this.queueClient.updateJob(job.id, {
        status: MsQueue.QueueStates.crashed,
        trace: `can´t resolve ${job.job.target}`,
      });
      this.initWorkerLoop();
      return;
    }

    await this.executeJob(client, job);
    Log.log("get next job", LogLevel.info);
    this.initWorkerLoop();
    return;
  }

  private async updateJobStatus(job: IJobs, status: string, err?: string): Promise<void> {
    Log.log(`update job ${job.id} as ${status}`, LogLevel.info);
    await this.queueClient.updateJob(job.id, { status, trace: err === undefined ? "" : err });
    return;
  }

  private async processTarget(target: string): Promise<PkHttp.IHttpClient | null> {
    Log.log("resolve job target", LogLevel.info);
    if (target === undefined || target === null || target === "") {
      return null;
    }
    return await this.dynamicClient.getClient(target);
  }

  private async executeJob(client: PkHttp.IHttpClient, task: IJobs): Promise<void> {
    switch (task.job.method) {
      case "POST":
        try {
          await client.getClient().post(task.job.path, task.job.payload.body);
          this.updateJobStatus(task, MsQueue.QueueStates.finished);
          Log.log("job successfully executed", LogLevel.info);
          return;
        } catch (err) {
          Log.log("job failed", LogLevel.error);
          Log.log(err, LogLevel.error);
          task.job.trace = err;
          this.updateJobStatus(task, MsQueue.QueueStates.failover, err.message);
          return;
        }
      case "PUT":
        try {
          await client.getClient().put(task.job.path, task.job.payload.body);
          this.updateJobStatus(task, MsQueue.QueueStates.finished);
          Log.log("job successfully executed", LogLevel.info);
          return;
        } catch (err) {
          Log.log("job failed", LogLevel.error);
          Log.log(err, LogLevel.error);
          task.job.trace = err;
          this.updateJobStatus(task, MsQueue.QueueStates.failover);
          return;
        }
      case "DELETE": {
        try {
          await client.getClient().delete(task.job.path);
          this.updateJobStatus(task, MsQueue.QueueStates.finished);
          Log.log("job successfully executed", LogLevel.info);
          return;
        } catch (err) {
          Log.log("job failed", LogLevel.error);
          Log.log(err, LogLevel.error);
          task.job.trace = err;
          this.updateJobStatus(task, MsQueue.QueueStates.failover);
          return;
        }
      }
      default:
        return;
    }
  }

  private async executeFailoverJob(client: PkHttp.IHttpClient, task: IJobs): Promise<void> {
    switch (task.failover.method) {
      case "POST":
        try {
          await client.getClient().post(task.failover.path, task.failover.payload.body);
          this.updateJobStatus(task, MsQueue.QueueStates.error);
          Log.log("job successfully executed", LogLevel.info);
          return;
        } catch (err) {
          Log.log("job failed", LogLevel.error);
          Log.log(err, LogLevel.error);
          task.failover.trace = err;
          this.updateJobStatus(task, MsQueue.QueueStates.crashed, err.message);
          return;
        }
      case "PUT":
        try {
          await client.getClient().put(task.failover.path, task.failover.payload.body);
          this.updateJobStatus(task, MsQueue.QueueStates.error);
          Log.log("job successfully executed", LogLevel.info);
          return;
        } catch (err) {
          Log.log("job failed", LogLevel.error);
          Log.log(err, LogLevel.error);
          task.failover.trace = err;
          this.updateJobStatus(task, MsQueue.QueueStates.crashed);
          return;
        }
      case "DELETE": {
        try {
          await client.getClient().delete(task.failover.path);
          this.updateJobStatus(task, MsQueue.QueueStates.error);
          Log.log("job successfully executed", LogLevel.info);
          return;
        } catch (err) {
          Log.log("job failed", LogLevel.error);
          Log.log(err, LogLevel.error);
          task.failover.trace = err;
          this.updateJobStatus(task, MsQueue.QueueStates.crashed);
          return;
        }
      }
      default:
        return;
    }
  }
}
