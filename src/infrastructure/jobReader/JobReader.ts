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

import { IJobReader } from "./IJobReader";
import { injectable } from "inversify";
import { IJobs } from "../../models";
import { injectQueueClient } from "@symlinkde/eco-os-pk-core";
import { PkCore } from "@symlinkde/eco-os-pk-models";
import { Log, LogLevel } from "@symlinkde/eco-os-pk-log";

@injectQueueClient
@injectable()
export class JobReader implements IJobReader {
  private queueClient!: PkCore.IEcoQueueClient;

  public async getCurrentJobsFromQueue(): Promise<Array<IJobs>> {
    try {
      const result = await this.queueClient.getAllJobs();
      if (result.data.length < 1) {
        Log.log("no jobs in queue", LogLevel.warning);
        return [];
      }

      return result.data;
    } catch (err) {
      Log.log(err, LogLevel.error);
      throw new Error(err);
    }
  }
}
