/**
 * Copyright 2018-2019 Symlink GmbH
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



import { IJobReducer } from "./IJobReducer";
import { injectable, inject } from "inversify";
import { IJobs } from "../../models";
import { IJobReader } from "../jobReader";
import { WORKERTYPES } from "../workerTypes";

@injectable()
export class JobReducer implements IJobReducer {
  private jobReader: IJobReader;

  public constructor(@inject(WORKERTYPES.IJobReader) reader: IJobReader) {
    this.jobReader = reader;
  }

  public async getFilteredJobs(): Promise<Array<IJobs>> {
    const jobs = await this.jobReader.getCurrentJobsFromQueue();
    return jobs.filter((job: IJobs) => {
      return (
        job.status === "scheduled" ||
        (job.status === "crashed" && job.attempts <= 3) ||
        (job.status === "failover" && job.attempts <= 3)
      );
    });
  }
}
